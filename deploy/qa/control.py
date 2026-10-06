"""Bounded wake/sleep control for the QA Compose project. No arbitrary commands."""
import hmac
import json
import os
import re
import shutil
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path('/opt/saluna/qa')
STATE = ROOT / 'state/session.json'
TOKEN = os.environ.get('QA_CONTROL_TOKEN', '')
COMPOSE = ['docker', 'compose', '--project-name', 'saluna-qa', '--env-file', str(ROOT / '.env.qa.local'), '-f', str(ROOT / 'compose.yaml')]
SERVICES = ['gateway', 'pwa', 'web', 'api', 'postgres']
LOCK = threading.RLock()
BOOT_PROCESS = None
SESSION_SECONDS = 60 * 60
PRODUCTION = ['saluna-api', 'saluna-pwa', 'saluna-web', 'saluna-postgres', 'saluna-gateway']


def command(args, timeout=30):
    # Compose must read the current release from its env file on every wake.
    # A controller created before a release must not override that revision.
    environment = {key: value for key, value in os.environ.items() if key != 'QA_REVISION'}
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=True, env=environment)
    return result.stdout


def headroom():
    fields = dict(line.split(':', 1) for line in Path('/proc/meminfo').read_text().splitlines())
    return {
        'available_memory_mb': int(fields['MemAvailable'].split()[0]) // 1024,
        'free_disk_mb': shutil.disk_usage(ROOT).free // (1024 * 1024),
        'load_1m': os.getloadavg()[0],
        'cpu_count': os.cpu_count() or 1,
    }


def pressure_reason(resources, starting=False):
    if resources['available_memory_mb'] < (1700 if starting else 650):
        return 'insufficient_memory'
    if resources['free_disk_mb'] < 5 * 1024:
        return 'insufficient_disk'
    if resources['load_1m'] > resources['cpu_count'] * (0.7 if starting else 0.9):
        return 'host_busy'
    return None


def production_healthy():
    data = [json.loads(line) for line in command(['docker', 'inspect', '--format', '{{json .State}}', *PRODUCTION]).splitlines()]
    return len(data) == len(PRODUCTION) and all(item['Running'] and item.get('Health', {}).get('Status') == 'healthy' for item in data)


def read_state():
    try:
        return json.loads(STATE.read_text())
    except (OSError, ValueError):
        return {'state': 'asleep', 'deadline': 0}


def deployment():
    try:
        data = json.loads((STATE.parent / 'deployment.json').read_text())
        return {key: data.get(key) for key in ('revision', 'source_commit', 'source_ref', 'source_dirty', 'focus')}
    except (OSError, ValueError):
        revision = next((line.split('=', 1)[1] for line in (ROOT / '.env.qa.local').read_text().splitlines() if line.startswith('QA_REVISION=')), None)
        return {'revision': revision}


def save_state(data):
    STATE.parent.mkdir(exist_ok=True)
    temporary = STATE.with_suffix('.tmp')
    temporary.write_text(json.dumps(data))
    temporary.replace(STATE)


def read_document(name):
    try:
        return json.loads((STATE.parent / name).read_text())
    except FileNotFoundError:
        return None


def save_document(name, data):
    target = STATE.parent / name
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False))
    temporary.replace(target)


def pending_job():
    job = read_document('job.json')
    report = read_document('report.json')
    if not job or report and report.get('job_id') == job['id']:
        return None
    if job['revision'] != deployment().get('revision'):
        raise ValueError('job_revision_not_installed')
    claim = read_document('job-claim.json')
    return {**job, 'state': 'claimed' if claim and claim.get('job_id') == job['id'] else 'ready'}


def record_report(body):
    with LOCK:
        job = read_document('job.json')
        claim = read_document('job-claim.json')
        previous = read_document('report.json')
        if previous and previous.get('job_id') == body.get('job_id'):
            if previous.get('run_id') == body.get('run_id'):
                return previous  # retry a lost acknowledgement without duplicating findings
            raise ValueError('job_already_reported')
        if not job or not claim or body.get('job_id') != job['id'] or claim.get('job_id') != job['id'] or body.get('run_id') != claim.get('run_id'):
            raise ValueError('report_does_not_own_job')
        if body.get('revision') != job['revision'] or deployment().get('revision') != job['revision']:
            raise ValueError('report_revision_mismatch')
        if read_state().get('state') != 'asleep':
            raise ValueError('sleep_before_reporting')
        outcome = body.get('outcome')
        coverage = body.get('coverage')
        if outcome not in ('pass', 'fail', 'blocked') or not isinstance(coverage, list) or len(coverage) > 30:
            raise ValueError('invalid_report')
        expected = {j['area'] for j in job['plan']['journeys']}
        if any(not isinstance(c, dict) for c in coverage) or {c.get('area') for c in coverage} != expected or len(coverage) != len(expected) or any(c.get('status') not in ('pass', 'fail', 'blocked') or not isinstance(c.get('summary'), str) or len(c['summary']) > 2000 for c in coverage):
            raise ValueError('report_missing_coverage')
        blocked = bool(job['plan'].get('coverage_gaps')) or any(c['status'] == 'blocked' for c in coverage)
        failed = any(c['status'] == 'fail' for c in coverage)
        if outcome != ('blocked' if blocked else 'fail' if failed else 'pass'):
            raise ValueError('report_outcome_disagrees_with_coverage')
        issues = body.get('issues', [])
        if not isinstance(issues, list) or len(issues) > 20 or any(not isinstance(url, str) or not re.fullmatch(r'https://github.com/mohamad-nikzad/saluna/issues/[0-9]+', url) for url in issues):
            raise ValueError('invalid_issue_links')
        report = {'job_id': job['id'], 'run_id': body['run_id'], 'revision': job['revision'], 'source_commit': job['source_commit'], 'outcome': outcome, 'coverage': coverage, 'issues': issues, 'reported_at': time.time()}
        serialized = json.dumps(report)
        env = dict(line.split('=', 1) for line in (ROOT / '.env.qa.local').read_text().splitlines() if '=' in line and not line.startswith('#'))
        secrets = [TOKEN, *(value for key, value in env.items() if any(word in key for word in ('PASSWORD', 'SECRET', 'TOKEN')))]
        if any(len(secret) >= 8 and secret in serialized for secret in secrets):
            raise ValueError('report_contains_credential')
        save_document('report.json', report)
        save_document('report-' + job['id'] + '.json', report)
        if not blocked and not job.get('source_dirty') and job.get('source_branch') == 'main':
            save_document('last-tested.json', {'source_commit': job['source_commit'], 'job_id': job['id']})
        return report


def sleep(reason, run_id=None):
    global BOOT_PROCESS
    with LOCK:
        session = read_state()
        if run_id and session.get('state') != 'asleep' and session.get('run_id') != run_id:
            raise ValueError('another_qa_session_is_active')
        try:
            if BOOT_PROCESS is not None and BOOT_PROCESS.poll() is None:
                BOOT_PROCESS.terminate()
                try:
                    BOOT_PROCESS.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    BOOT_PROCESS.kill()
                    BOOT_PROCESS.wait(timeout=5)
            command(COMPOSE + ['stop', '--timeout', '10', *SERVICES], timeout=90)
            save_state({'state': 'asleep', 'deadline': 0, 'reason': reason, 'updated_at': time.time()})
        except Exception:
            # Keep an overdue lease so the watchdog retries rather than declaring sleep.
            save_state({'state': 'stop_failed', 'deadline': 1, 'reason': reason})
            raise


def start(run_id, job_id=None):
    with LOCK:
        session = read_state()
        if session.get('state') in ('starting', 'awake'):
            if session.get('run_id') == run_id:
                return session  # retries must never extend the lease
            raise ValueError('another_qa_session_is_active')
        if session.get('state') != 'asleep':
            raise ValueError('qa_cleanup_required')
        if BOOT_PROCESS is not None:
            raise ValueError('startup_cleanup_in_progress')
        if job_id:
            job = pending_job()
            if not job or job['id'] != job_id:
                raise ValueError('job_not_pending')
        reason = pressure_reason(headroom(), starting=True)
        if reason or not production_healthy():
            raise ValueError(reason or 'production_unhealthy')
        session = {'state': 'starting', 'run_id': run_id, 'started_at': time.time(), 'deadline': time.time() + SESSION_SECONDS}
        save_state(session)
        if job_id:
            save_document('job-claim.json', {'job_id': job_id, 'run_id': run_id})
        threading.Thread(target=boot, args=(session,), daemon=True).start()
        return session


def boot(session):
    global BOOT_PROCESS
    with LOCK:
        if read_state().get('run_id') != session['run_id']:
            return
        BOOT_PROCESS = subprocess.Popen(COMPOSE + ['up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '150', *SERVICES], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        process = BOOT_PROCESS
    # Release the lock while starting so the pressure watchdog can interrupt startup.
    try:
        code = process.wait(timeout=180)
    except subprocess.TimeoutExpired:
        code = -1
    with LOCK:
        if code or read_state().get('run_id') != session['run_id']:
            sleep('startup_failed')
        else:
            session['state'] = 'awake'
            save_state(session)
        BOOT_PROCESS = None


def watch():
    pressure_count = 0
    while True:
        time.sleep(15)
        with LOCK:
            session = read_state()
            if session.get('state') == 'asleep':
                pressure_count = 0
                continue
            reason = None
            try:
                if time.time() >= session.get('deadline', 0):
                    reason = 'session_expired'
                else:
                    reason = pressure_reason(headroom())
                    if not production_healthy():
                        reason = 'production_unhealthy'
                pressure_count = pressure_count + 1 if reason else 0
                if reason == 'session_expired' or pressure_count >= 2:
                    sleep(reason)
            except Exception:
                # Failure to observe the host is also a reason to stop QA.
                try:
                    sleep('monitor_failed')
                except Exception:
                    pass


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass  # never log credentials, headers, or request bodies

    def reply(self, status, data):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        if TOKEN and hmac.compare_digest(self.headers.get('X-Saluna-QA-Key', ''), TOKEN):
            return True
        self.reply(401, {'error': 'unauthorized'})
        return False

    def do_GET(self):
        if not self.authorized():
            return
        if self.path not in ('/_qa/status', '/_qa/job'):
            self.reply(404, {'error': 'not_found'})
            return
        try:
            self.reply(200, {'job': pending_job()} if self.path == '/_qa/job' else {**read_state(), **deployment(), 'resources': headroom()})
        except Exception:
            self.reply(503, {'error': 'monitor_unavailable'})

    def do_POST(self):
        if not self.authorized():
            return
        if self.path not in ('/_qa/wake', '/_qa/sleep', '/_qa/report'):
            self.reply(404, {'error': 'not_found'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 0 or length > (65536 if self.path == '/_qa/report' else 2048):
                raise ValueError('invalid_body_size')
            body = json.loads(self.rfile.read(length)) if length else {}
            if not isinstance(body, dict):
                raise ValueError('invalid_body')
            if self.path == '/_qa/report':
                self.reply(200, record_report(body))
            elif self.path == '/_qa/sleep':
                sleep('requested', body.get('run_id'))
                self.reply(200, read_state())
            else:
                run_id = body.get('run_id', '')
                if not isinstance(run_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', run_id):
                    raise ValueError('invalid_run_id')
                self.reply(202, start(run_id, body.get('job_id')))
        except ValueError as error:
            self.reply(409, {'error': str(error)})
        except Exception:
            self.reply(503, {'error': 'qa_control_failed'})


if __name__ == '__main__':
    if len(TOKEN) < 32:
        raise SystemExit('A random QA_CONTROL_TOKEN is required.')
    # A host reboot or controller restart must not leave an unowned test run active.
    sleep('controller_restarted')
    threading.Thread(target=watch, daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0', 8086), Handler).serve_forever()

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


def start(run_id):
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
        reason = pressure_reason(headroom(), starting=True)
        if reason or not production_healthy():
            raise ValueError(reason or 'production_unhealthy')
        session = {'state': 'starting', 'run_id': run_id, 'started_at': time.time(), 'deadline': time.time() + SESSION_SECONDS}
        save_state(session)
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
        if self.path != '/_qa/status':
            self.reply(404, {'error': 'not_found'})
            return
        try:
            self.reply(200, {**read_state(), **deployment(), 'resources': headroom()})
        except Exception:
            self.reply(503, {'error': 'monitor_unavailable'})

    def do_POST(self):
        if not self.authorized():
            return
        if self.path not in ('/_qa/wake', '/_qa/sleep'):
            self.reply(404, {'error': 'not_found'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 0 or length > 2048:
                raise ValueError('invalid_body_size')
            body = json.loads(self.rfile.read(length)) if length else {}
            if self.path == '/_qa/sleep':
                sleep('requested', body.get('run_id'))
                self.reply(200, read_state())
            else:
                run_id = body.get('run_id', '')
                if not isinstance(run_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}', run_id):
                    raise ValueError('invalid_run_id')
                self.reply(202, start(run_id))
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

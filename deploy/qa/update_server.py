"""Install a workstation-built QA release inside an existing bounded QA lease."""
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlparse

import control

def main(revision, run_id):
    if not re.fullmatch(r'qa-[a-f0-9]{8}-[a-f0-9]{12}', revision):
        raise SystemExit('Invalid QA revision')
    root = Path('/opt/saluna/qa')
    env = root / '.env.qa.local'
    archive = root / (revision + '.tar.gz')
    metadata = root / (revision + '.json')


    def check_lease():
        session = control.read_state()
        if session.get('run_id') != run_id or session.get('state') != 'awake' or session.get('deadline', 0) - time.time() < 240:
            raise RuntimeError('The QA deployment lease is unavailable or about to expire')
        reason = control.pressure_reason(control.headroom())
        if reason or not control.production_healthy():
            raise RuntimeError(reason or 'Production is unhealthy')


    def replace_env(text):
        temp = env.with_suffix('.update.tmp')
        temp.write_text(text)
        temp.chmod(0o600)
        temp.replace(env)


    old_env = env.read_text()
    values = dict(line.split('=', 1) for line in old_env.splitlines() if '=' in line and not line.startswith('#'))
    database = urlparse(values.get('DATABASE_URL', ''))
    if database.username != 'saluna_qa' or database.hostname != 'postgres' or database.path != '/saluna_qa' or values.get('DATABASE_URL_DIRECT') != values.get('DATABASE_URL'):
        raise SystemExit('QA deployment requires the isolated saluna_qa database')
    if values.get('SALUNA_ENVIRONMENT') != 'qa' or any(values.get(key) != 'false' for key in ('SMS_ENABLED', 'BALE_ENABLED', 'BALE_SAFIR_ENABLED', 'TELEGRAM_ENABLED')):
        raise SystemExit('QA deployment requires disabled external delivery')
    try:
        check_lease()
        control.command(['nice', '-n', '19', 'ionice', '-c', '3', 'docker', 'load', '-i', str(archive)], timeout=180)
        check_lease()
        control.command(control.COMPOSE + ['stop', '--timeout', '10', 'gateway', 'pwa', 'web', 'api'], timeout=90)
        updated = re.sub(r'^QA_REVISION=.*$', 'QA_REVISION=' + revision, old_env, flags=re.MULTILINE)
        if not re.search(r'^QA_REVISION=', old_env, flags=re.MULTILINE):
            raise RuntimeError('QA revision setting is missing')
        replace_env(updated)
        control.command(control.COMPOSE + ['run', '--rm', '--no-deps', 'tools', 'migrate.cjs'], timeout=180)
        check_lease()
        control.command(control.COMPOSE + ['up', '-d', '--no-build', '--pull', 'never', '--wait', '--wait-timeout', '150', *control.SERVICES], timeout=180)
        control.command(control.COMPOSE + ['exec', '-T', 'api', 'node', '-e', "Promise.all(['http://saluna-qa-web:3001/salons/saluna/','http://saluna-qa-pwa/','http://127.0.0.1:3002/health'].map(async u=>{const r=await fetch(u);if(!r.ok)throw Error('QA readiness failed')})).catch(()=>process.exit(1))"], timeout=60)
        check_lease()
        release = json.loads(metadata.read_text())
        if release['revision'] != revision:
            raise RuntimeError('Release metadata differs')
        state = root / 'state/deployment.json'
        temp = state.with_suffix('.tmp')
        temp.write_text(json.dumps(release))
        temp.replace(state)
        print('QA release ready:', revision)
    except Exception:
        replace_env(old_env)
        raise
    finally:
        control.command(control.COMPOSE + ['stop', '--timeout', '10', *control.SERVICES], timeout=90)
        archive.unlink(missing_ok=True)


if __name__ == '__main__':
    main(*sys.argv[1:])

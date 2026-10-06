"""Install hosted-runner images and publish a revision-bound QA job on the VPS."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import time
from pathlib import Path

import control
import journeys

ROOT = Path('/opt/saluna/qa')


def controller(action, data=None):
    # Read the existing token inside its controller; never copy it to GitHub secrets.
    script = "import os,sys,json,urllib.request,urllib.error; p=json.load(sys.stdin); r=urllib.request.Request('http://127.0.0.1:8086/_qa/'+p['action'],headers={'X-Saluna-QA-Key':os.environ['QA_CONTROL_TOKEN'],'Content-Type':'application/json'},data=None if p['data'] is None else json.dumps(p['data']).encode()); print(urllib.request.urlopen(r,timeout=30).read().decode())"
    result = subprocess.run(['docker', 'exec', '-i', 'saluna-qa-control-control-1', 'python', '-c', script], input=json.dumps({'action': action, 'data': data}), text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError('QA controller refused ' + action + '; preserve active sessions and inspect status')
    return json.loads(result.stdout)


def load_metadata(directory):
    paths = list(directory.glob('qa-*.json'))
    if len(paths) != 1:
        raise RuntimeError('Expected one release metadata file')
    data = json.loads(paths[0].read_text())
    if not re.fullmatch(r'qa-[a-f0-9]{8}-[a-f0-9]{12}', data.get('revision', '')) or not re.fullmatch(r'[a-f0-9]{40}', data.get('source_commit', '')) or data.get('source_dirty') is not False:
        raise RuntimeError('Automation requires a committed QA release')
    if not re.fullmatch(r'[a-f0-9]{64}', data.get('archive_sha256', '')) or any(not isinstance(data.get(k), int) or data[k] <= 0 for k in ('archive_bytes', 'images_bytes')):
        raise RuntimeError('Missing archive integrity or disk requirements')
    return paths[0], data


def retire_images():
    """Remove only unreferenced QA release tags, preserving the installed release."""
    if controller('status')['state'] != 'asleep':
        return
    protected = {control.deployment().get('revision')}
    env = (ROOT / '.env.qa.local').read_text()
    protected.update(line.split('=', 1)[1] for line in env.splitlines() if line.startswith('QA_REVISION='))
    references = set(control.command(['docker', 'ps', '-aq']).splitlines())
    used_images = set()
    if references:
        used_images.update(control.command(['docker', 'inspect', '--format', '{{.Image}}', *sorted(references)]).splitlines())
    images = control.command(['docker', 'image', 'ls', '--no-trunc', '--format', '{{.Repository}}:{{.Tag}} {{.ID}}', 'saluna-qa-*'])
    for line in images.splitlines():
        tag, image_id = line.split()
        match = re.fullmatch(r'saluna-qa-(?:api|tools|pwa|web):(qa-[a-f0-9]{8}-[a-f0-9]{12}|[a-f0-9]{8})', tag)
        if match and match[1] not in protected and image_id not in used_images:
            # No force or global prune: Docker also refuses removal of a used image.
            control.command(['nice', '-n', '19', 'ionice', '-c', '3', 'docker', 'image', 'rm', tag], timeout=60)


def preflight(metadata, downloaded=False):
    # Scoped image retirement can leave a short load-average tail. Wait asleep
    # for that tail, without weakening the normal startup threshold.
    for attempt in range(11):
        reason = control.pressure_reason(control.headroom(), starting=True)
        if not control.production_healthy():
            raise RuntimeError('production_unhealthy')
        if reason != 'host_busy' or attempt == 10:
            break
        time.sleep(15)
    if reason:
        raise RuntimeError(reason)
    # Reserve both downloaded zip/extracted archive, image expansion, and 5 GiB.
    if shutil.disk_usage(ROOT).free < metadata['archive_bytes'] * (1 if downloaded else 2) + metadata['images_bytes'] + 5 * 1024**3:
        raise RuntimeError('insufficient_disk_for_release; keep the 5 GiB reserve and retry after QA cleanup')


def plan_for(head, repository):
    baseline_path = ROOT / 'state/last-tested.json'
    if not baseline_path.exists():
        baseline_path = ROOT / 'state/initial-baseline.json'
        if not baseline_path.exists():
            # Installing a validation/blocked release must not move the baseline
            # before the first completed main report exists.
            initial = json.loads((ROOT / 'state/deployment.json').read_text()).get('source_commit')
            if not re.fullmatch(r'[a-f0-9]{40}', initial or ''):
                raise RuntimeError('A verified baseline commit is required')
            temporary = baseline_path.with_suffix('.tmp')
            temporary.write_text(json.dumps({'source_commit': initial}))
            temporary.replace(baseline_path)
    base = json.loads(baseline_path.read_text()).get('source_commit')
    if not base or not re.fullmatch(r'[a-f0-9]{40}', base):
        raise RuntimeError('A verified baseline commit is required')
    result = subprocess.run(['git', '-C', str(repository), 'diff', '--no-renames', '--name-only', base, head], text=True, capture_output=True, check=True)
    return base, journeys.select(result.stdout.splitlines())


def install(directory, repository, run_number, attempt, source_branch='main'):
    metadata_path, metadata = load_metadata(directory)
    base, plan = plan_for(metadata['source_commit'], repository)
    if not plan['required']:
        print('No product changes since the last tested release; staging stays asleep.')
        return
    archive = directory / (metadata['revision'] + '.tar.gz')
    with archive.open('rb') as source:
        if archive.stat().st_size != metadata['archive_bytes'] or hashlib.file_digest(source, 'sha256').hexdigest() != metadata['archive_sha256']:
            raise RuntimeError('QA archive integrity mismatch')
    # Wait for the owned lease to finish; never cancel a browser session.
    for _ in range(240):
        state = controller('status')
        if state['state'] == 'asleep':
            break
        time.sleep(15)
    else:
        raise RuntimeError('QA session is still busy; retry the workflow')
    revision = metadata['revision']
    job_id = 'gh-' + run_number + '-' + attempt
    run_id = 'deploy-' + job_id
    preflight(metadata, downloaded=True)
    shutil.copy2(archive, ROOT / archive.name)
    shutil.copy2(metadata_path, ROOT / metadata_path.name)
    for name in ('update_server.py', 'control.py'):
        shutil.copy2(Path(__file__).with_name(name), ROOT / name)
    owned = False
    try:
        controller('wake', {'run_id': run_id})
        owned = True
        for _ in range(60):
            state = controller('status')
            if state.get('run_id') != run_id or state.get('state') not in ('starting', 'awake'):
                raise RuntimeError('QA deployment lease ended')
            if state['state'] == 'awake':
                break
            time.sleep(3)
        else:
            raise RuntimeError('QA startup timed out')
        subprocess.run(['python3', str(ROOT / 'update_server.py'), revision, run_id], check=True)
    finally:
        try:
            controller('sleep', {'run_id': run_id})
        except RuntimeError:
            if owned:
                raise
        (ROOT / archive.name).unlink(missing_ok=True)
    state = controller('status')
    if state['state'] != 'asleep' or state.get('revision') != revision:
        raise RuntimeError('QA release or sleep could not be verified')
    smoke_id = 'smoke-' + job_id
    smoke = 'blocked'
    try:
        controller('wake', {'run_id': smoke_id})
        for _ in range(60):
            state = controller('status')
            if state.get('run_id') != smoke_id or state.get('state') not in ('starting', 'awake'):
                raise RuntimeError('Smoke lease ended')
            if state['state'] == 'awake':
                break
            time.sleep(3)
        else:
            raise RuntimeError('Smoke startup timed out')
        result = subprocess.run(['python3', str(Path(__file__).with_name('smoke.py')), '--local-gateway', '--access-file', str(ROOT / 'access.local.json')], timeout=300)
        smoke = 'pass' if result.returncode == 0 else 'fail'
    finally:
        controller('sleep', {'run_id': smoke_id})
    if controller('status')['state'] != 'asleep':
        raise RuntimeError('Smoke cleanup did not sleep staging')
    job = {'id': job_id, 'revision': revision, 'source_commit': metadata['source_commit'], 'source_branch': source_branch, 'source_dirty': False, 'baseline_commit': base, 'plan': plan, 'api_smoke': smoke, 'created_at': time.time(), 'workflow_url': 'https://github.com/mohamad-nikzad/saluna/actions/runs/' + run_number}
    control.save_document('job.json', job)
    print('Ready QA job:', job_id, revision)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['plan', 'preflight', 'install'])
    parser.add_argument('--directory', type=Path, required=True)
    parser.add_argument('--repository', type=Path)
    parser.add_argument('--run-number')
    parser.add_argument('--attempt')
    parser.add_argument('--head')
    parser.add_argument('--source-branch', default='main')
    args = parser.parse_args()
    if args.action == 'plan':
        if not args.repository or not re.fullmatch(r'[a-f0-9]{40}', args.head or ''):
            parser.error('plan needs repository and a full commit SHA')
        base, plan = plan_for(args.head, args.repository)
        args.directory.mkdir(parents=True, exist_ok=True)
        (args.directory / 'plan.json').write_text(json.dumps({'baseline_commit': base, 'source_commit': args.head, **plan}, ensure_ascii=False, indent=2))
        print('required=' + str(plan['required']).lower())
    elif args.action == 'preflight':
        retire_images()
        preflight(load_metadata(args.directory)[1])
    else:
        if not args.repository or not re.fullmatch(r'[0-9]+', args.run_number or '') or not re.fullmatch(r'[0-9]+', args.attempt or ''):
            parser.error('install needs repository, numeric run number and attempt')
        install(args.directory, args.repository, args.run_number, args.attempt, args.source_branch)

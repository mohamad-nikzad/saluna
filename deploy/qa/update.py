"""Build a selected Git revision or local working tree, then update only QA."""
import argparse
import base64
import hashlib
import io
import json
import os
import re
import shlex
import shutil
import subprocess
import tarfile
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from network import opener

HERE = Path(__file__).resolve().parent
CHECKOUT = HERE.parents[1]


def command(args, cwd=None, capture=False):
    return subprocess.run(args, cwd=cwd, check=True, text=capture, stdout=subprocess.PIPE if capture else None).stdout


def snapshot(source, destination, ref, working_tree):
    commit = command(['git', 'rev-parse', ref if not working_tree else 'HEAD'], cwd=source, capture=True).strip()
    if working_tree:
        paths = command(['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=source, capture=True).split('\0')
        for name in paths:
            if not name or any(part == '.codex' or part.startswith('.env') for part in Path(name).parts):
                continue
            origin = source / name
            if origin.is_file():
                target = destination / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(origin, target)
        dirty = bool(command(['git', 'status', '--porcelain'], cwd=source, capture=True).strip())
    else:
        archive = subprocess.run(['git', 'archive', commit], cwd=source, check=True, stdout=subprocess.PIPE).stdout
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            members = [m for m in tar.getmembers() if not any(part == '.codex' or part.startswith('.env') for part in Path(m.name).parts)]
            tar.extractall(destination, members=members, filter='data')
        dirty = False
    return commit, dirty


def prepare_qa(source):
    # Apply only the QA hooks, preserving the selected revision's product changes.
    substitutions = {
        'scripts/db-seed.ts': [("const SEED_PASSWORD = 'admin123'", "const SEED_PASSWORD = process.env.SEED_PASSWORD?.trim() || 'admin123'")],
        'apps/web/src/lib/public-api.ts': [('configureGeneratedApiClient({ baseUrl: PUBLIC_API_URL })', "configureGeneratedApiClient({ baseUrl: import.meta.env.SSR ? process.env.API_INTERNAL_URL || PUBLIC_API_URL : PUBLIC_API_URL })")],
        'apps/web/src/pages/salons-sitemap.xml.ts': [("new URL('/api/v1/public/salons', PUBLIC_API_URL)", "new URL('/api/v1/public/salons', process.env.API_INTERNAL_URL || PUBLIC_API_URL)")],
    }
    for name, changes in substitutions.items():
        path = source / name
        text = path.read_text()
        for old, new in changes:
            if old in text:
                text = text.replace(old, new)
            elif new not in text and 'API_INTERNAL_URL' not in text and 'process.env.SEED_PASSWORD' not in text:
                raise RuntimeError('QA integration needs review for ' + name)
        path.write_text(text)
    shutil.copytree(HERE, source / 'deploy/qa', dirs_exist_ok=True, ignore=shutil.ignore_patterns('__pycache__', '.env*'))
    shutil.copy2(CHECKOUT / 'scripts/qa-seed.ts', source / 'scripts/qa-seed.ts')
    with (source / '.dockerignore').open('a') as output:
        output.write('\n.codex\n.env*\n**/.env*\n')


def source_digest(source):
    digest = hashlib.sha256()
    for path in sorted(source.rglob('*')):
        if path.is_file():
            digest.update(str(path.relative_to(source)).encode() + b'\0')
            digest.update(path.read_bytes())
    return digest.hexdigest()[:12]


def control_request(access, action, run_id):
    basic = base64.b64encode(f"{access['gateway_username']}:{access['gateway_password']}".encode()).decode()
    request = urllib.request.Request(
        'https://staging-app.saluna.ir/_qa/' + action,
        headers={'Authorization': 'Basic ' + basic, 'X-Saluna-QA-Key': access['control_token'], 'Content-Type': 'application/json'},
        data=None if action == 'status' else json.dumps({'run_id': run_id}).encode(),
    )
    for attempt in range(3):
        try:
            with opener().open(request, timeout=20) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            try:
                reason = json.load(error).get('error', 'unavailable')
            except (ValueError, AttributeError):
                reason = 'unavailable'
            raise RuntimeError('QA control refused the update: ' + reason) from None
        except (OSError, urllib.error.URLError):
            if attempt == 2:
                raise RuntimeError('QA connection unavailable; inspect status before continuing') from None
            time.sleep(2)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path.cwd())
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--ref', default='main')
    group.add_argument('--working-tree', action='store_true')
    parser.add_argument('--focus')
    parser.add_argument('--resume', type=Path, help='Deploy a previously built release metadata file')
    parser.add_argument('--ssh-key', type=Path, default=Path('/Users/mohamad/Projects/saluna/.codex/deploy/saluna_vps_ed25519'))
    parser.add_argument('--access-file', type=Path, default=CHECKOUT / '.codex/qa/qa-access.local.json')
    parser.add_argument('--build-only', action='store_true')
    args = parser.parse_args()
    if args.resume:
        deploy_release(args.resume.resolve(), args)
        return
    if not args.focus:
        parser.error('--focus is required when building a new release')
    source = args.source.resolve()
    release_dir = CHECKOUT / '.codex/qa/releases' / uuid.uuid4().hex
    snapshot_dir = release_dir / 'source'
    snapshot_dir.mkdir(parents=True)
    commit, dirty = snapshot(source, snapshot_dir, args.ref, args.working_tree)
    prepare_qa(snapshot_dir)
    revision = 'qa-' + commit[:8] + '-' + source_digest(snapshot_dir)
    metadata = {'revision': revision, 'source_commit': commit, 'source_ref': 'working-tree' if args.working_tree else args.ref, 'source_dirty': dirty, 'focus': args.focus}
    metadata_path = release_dir / (revision + '.json')
    metadata_path.write_text(json.dumps(metadata, indent=2))
    print('Building QA release', revision, flush=True)

    def build(dockerfile, image, *options):
        command(['docker', 'build', '--platform', 'linux/amd64', '-f', dockerfile, '-t', image, *options, '.'], cwd=snapshot_dir)

    build('apps/api/Dockerfile', 'saluna-qa-api-build:' + revision, '--target', 'build')
    build('apps/api/Dockerfile', 'saluna-qa-api:' + revision)
    build('deploy/qa/Dockerfile.tools', 'saluna-qa-tools:' + revision, '--build-arg', 'QA_BUILD_IMAGE=saluna-qa-api-build:' + revision)
    build('apps/pwa/Dockerfile', 'saluna-qa-pwa:' + revision,
          '--build-arg', 'VITE_API_BASE_URL=https://staging-app.saluna.ir', '--build-arg', 'VITE_APP_URL=https://staging-app.saluna.ir',
          '--build-arg', 'VITE_WEB_URL=https://staging.saluna.ir', '--build-arg', 'VITE_PWA_ASSET_VERSION=' + revision)
    build('apps/web/Dockerfile', 'saluna-qa-web:' + revision,
          '--build-arg', 'PUBLIC_APP_URL=https://staging.saluna.ir', '--build-arg', 'PUBLIC_API_URL=https://staging.saluna.ir',
          '--build-arg', 'PUBLIC_MANAGER_APP_URL=https://staging-app.saluna.ir')
    if args.build_only:
        print('Build complete. Staging was not changed. Metadata:', metadata_path)
        return
    try:
        deploy_release(metadata_path, args)
    except Exception:
        print('Resume this built release with:', flush=True)
        print('python3 ' + shlex.quote(str(HERE / 'update.py')) + ' --resume ' + shlex.quote(str(metadata_path)), flush=True)
        raise


def deploy_release(metadata_path, args):
    metadata = json.loads(metadata_path.read_text())
    revision = metadata['revision']
    if not re.fullmatch(r'qa-[a-f0-9]{8}-[a-f0-9]{12}', revision):
        raise RuntimeError('Invalid QA release revision')
    release_dir = metadata_path.parent
    archive = release_dir / (revision + '.tar.gz')
    images = ['saluna-qa-' + service + ':' + revision for service in ('api', 'tools', 'pwa', 'web')]
    if not archive.exists():
        with archive.open('wb') as output:
            save = subprocess.Popen(['docker', 'save', '--platform', 'linux/amd64', *images], stdout=subprocess.PIPE)
            compress = subprocess.Popen(['gzip', '-1'], stdin=save.stdout, stdout=output)
            save.stdout.close()
            if compress.wait() or save.wait():
                raise RuntimeError('Image export failed')
    ssh = ['ssh', '-i', str(args.ssh_key), '-o', 'BatchMode=yes', 'deploy@195.177.255.24']
    scp = ['scp', '-l', '12000', '-i', str(args.ssh_key)]
    if interface := os.environ.get('SALUNA_QA_NETWORK_INTERFACE'):
        ssh[1:1] = ['-o', 'BindInterface=' + interface, '-o', 'ConnectTimeout=15']
        scp[1:1] = ['-o', 'BindInterface=' + interface, '-o', 'ConnectTimeout=15']
    free_disk = int(command(ssh + ["python3 -c \"import shutil; print(shutil.disk_usage('/opt/saluna/qa').free)\""], capture=True).strip())
    image_sizes = command(['docker', 'image', 'inspect', '--format', '{{.Size}}', *images], capture=True)
    required_disk = archive.stat().st_size + sum(int(value) for value in image_sizes.splitlines()) + 5 * 1024**3
    if free_disk < required_disk:
        raise RuntimeError('Not enough VPS disk for this release while retaining the 5 GiB reserve')
    remote_hash = command(ssh + ["nice -n 19 ionice -c 3 python3 -c \"import hashlib,pathlib; p=pathlib.Path('/opt/saluna/qa/" + revision + ".tar.gz'); print(hashlib.file_digest(p.open('rb'),'sha256').hexdigest() if p.exists() else '')\""], capture=True).strip()
    with archive.open('rb') as source:
        local_hash = hashlib.file_digest(source, 'sha256').hexdigest()
    if remote_hash != local_hash:
        command(scp + [str(archive), 'deploy@195.177.255.24:/opt/saluna/qa/'])
    command(scp + [str(metadata_path), str(HERE / 'update_server.py'), str(HERE / 'control.py'), 'deploy@195.177.255.24:/opt/saluna/qa/'])
    access = json.loads(args.access_file.read_text())
    run_id = 'deploy-' + uuid.uuid4().hex[:16]
    try:
        control_request(access, 'wake', run_id)
        for _ in range(60):
            state = control_request(access, 'status', run_id)
            if state.get('run_id') != run_id or state.get('state') not in ('starting', 'awake'):
                raise RuntimeError('QA deployment lease ended before startup')
            if state['state'] == 'awake':
                break
            time.sleep(3)
        else:
            raise RuntimeError('QA startup timed out')
        # Generated IDs have only fixed prefixes and hexadecimal characters.
        command(ssh + ['python3 /opt/saluna/qa/update_server.py ' + revision + ' ' + run_id])
    finally:
        control_request(access, 'sleep', run_id)
    state = control_request(access, 'status', run_id)
    if state.get('state') != 'asleep' or state.get('revision') != revision:
        raise RuntimeError('New QA revision or sleep could not be verified')
    print('Staging updated and asleep. Send in #saluna-reviews:', flush=True)
    print('RUN QA REV ' + revision + ' FOCUS ' + (args.focus or metadata['focus']))


if __name__ == '__main__':
    main()

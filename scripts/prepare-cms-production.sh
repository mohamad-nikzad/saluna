#!/usr/bin/env bash
set -euo pipefail

# Run on the VPS from /opt/saluna before deploying the first CMS image.
# Provisioning does not start or replace the public web service.
export ENV_FILE="${ENV_FILE:-.env.production}"
python3 - <<'PY'
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
from datetime import datetime, timezone

env = Path(os.environ['ENV_FILE'])
text = env.read_text()
values = {}
for line in text.splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        name, value = line.split('=', 1)
        values[name.strip()] = value.strip().strip('\"\'')
names = ['CMS_POSTGRES_PASSWORD', 'CMS_DATABASE_URL', 'EMDASH_ENCRYPTION_KEY']
present = [name for name in names if values.get(name)]
if present and len(present) != len(names):
    raise SystemExit('Partial CMS credentials exist; complete them without rotating existing secrets.')
if not present:
    # Refuse to generate replacement credentials for an existing CMS database.
    result = subprocess.run([
        'docker', 'exec', 'saluna-postgres', 'sh', '-c',
        'exec psql -X -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At',
    ], input="SELECT datname FROM pg_database WHERE datname = 'saluna_cms';\n", text=True, capture_output=True, check=True)
    if result.stdout.strip():
        raise SystemExit('CMS database already exists. Recover its credentials instead of generating new ones.')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    backup = env.parent / 'cms-provision-backups' / stamp
    backup.mkdir(parents=True, mode=0o700)
    shutil.copyfile(env, backup / 'env-before')
    os.chmod(backup / 'env-before', 0o600)
    password = secrets.token_hex(32)
    generated = {
        'CMS_POSTGRES_PASSWORD': password,
        'CMS_DATABASE_URL': f'postgresql://saluna_cms:{password}@postgres:5432/saluna_cms',
        # EmDash 1.1.0's native generator uses 32 cryptographically random bytes
        # encoded as unpadded base64url with this versioned prefix.
        'EMDASH_ENCRYPTION_KEY': 'emdash_enc_v1_' + secrets.token_urlsafe(32),
    }
    lines = [line for line in text.splitlines() if line.split('=', 1)[0].strip() not in names]
    new_text = '\n'.join(lines) + '\n\n# EmDash production persistence\n'
    new_text += ''.join(f'{name}={generated[name]}\n' for name in names)
    temporary = env.with_name(env.name + '.cms-preparing')
    with temporary.open('x') as output:
        os.chmod(temporary, 0o600)
        output.write(new_text)
    temporary.replace(env)
    print('Fresh CMS secrets saved; previous environment backed up. No secret values printed.')
else:
    if not re.fullmatch(r'emdash_enc_v1_[A-Za-z0-9_-]{43}', values['EMDASH_ENCRYPTION_KEY']):
        raise SystemExit('Existing encryption key does not match the pinned EmDash key format.')
    print('Existing CMS secrets retained.')
os.chmod(env, 0o600)
PY

bash scripts/provision-cms.sh

"""QA status/wake/sleep without putting credentials in command arguments."""
import argparse
import base64
import json
import urllib.error
import urllib.request
from pathlib import Path
from network import opener

parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['status', 'wake', 'sleep'])
parser.add_argument('--run-id')
parser.add_argument('--access-file', type=Path, default=Path('.codex/qa/qa-access.local.json'))
args = parser.parse_args()
if args.action == 'wake' and not args.run_id:
    parser.error('wake requires --run-id')
access = json.loads(args.access_file.read_text())
basic = base64.b64encode(f"{access['gateway_username']}:{access['gateway_password']}".encode()).decode()
body = None if args.action == 'status' else json.dumps({'run_id': args.run_id}).encode()
request = urllib.request.Request(
    'https://staging-app.saluna.ir/_qa/' + args.action,
    data=body,
    headers={'Authorization': 'Basic ' + basic, 'X-Saluna-QA-Key': access['control_token'], 'Content-Type': 'application/json'},
)
try:
    with opener().open(request, timeout=30) as response:
        print(response.read().decode())
except urllib.error.HTTPError as error:
    print(error.read().decode())
    raise SystemExit(1)

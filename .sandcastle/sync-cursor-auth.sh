#!/usr/bin/env bash
# Export host Cursor Agent session tokens into a file the Linux sandbox can read.
# Keychain JWTs are session tokens — they are NOT valid CURSOR_API_KEY values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AUTH_DIR="$ROOT/.sandcastle/cursor-auth"
AUTH_FILE="$AUTH_DIR/auth.json"
ENV_FILE="$ROOT/.sandcastle/.env"

ACCESS="$(security find-generic-password -s 'cursor-access-token' -a 'cursor-user' -w 2>/dev/null || true)"
REFRESH="$(security find-generic-password -s 'cursor-refresh-token' -a 'cursor-user' -w 2>/dev/null || true)"

if [[ -z "${ACCESS}" || -z "${REFRESH}" ]]; then
  echo "Could not read cursor access/refresh tokens from Keychain." >&2
  echo "Run \`cursor-agent login\` on the host, then retry." >&2
  echo "Or set a real CURSOR_API_KEY (from cursor.com dashboard) in .sandcastle/.env" >&2
  exit 1
fi

mkdir -p "$AUTH_DIR"
chmod 700 "$AUTH_DIR"

python3 - "$AUTH_FILE" "$ACCESS" "$REFRESH" <<'PY'
import json, sys
path, access, refresh = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path, "w", encoding="utf-8") as f:
    json.dump(
        {
            "accessToken": access,
            "refreshToken": refresh,
        },
        f,
        indent=2,
    )
PY
chmod 600 "$AUTH_FILE"

# Prefer file-session auth in the sandbox. Keep CURSOR_API_KEY empty unless the
# user intentionally sets a dashboard API key.
if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^CURSOR_API_KEY=' "$ENV_FILE"; then
    # Clear any previously synced Keychain JWT mistaken for an API key.
    tmp="$(mktemp)"
    awk '
      /^CURSOR_API_KEY=/ { print "CURSOR_API_KEY="; next }
      { print }
    ' "$ENV_FILE" >"$tmp"
    mv "$tmp" "$ENV_FILE"
  fi
  if ! grep -q '^AGENT_CLI_CREDENTIAL_STORE=' "$ENV_FILE"; then
    printf '\nAGENT_CLI_CREDENTIAL_STORE=file\n' >>"$ENV_FILE"
  fi
else
  printf 'CURSOR_API_KEY=\nAGENT_CLI_CREDENTIAL_STORE=file\n' >"$ENV_FILE"
fi
chmod 600 "$ENV_FILE"

echo "Wrote session auth to .sandcastle/cursor-auth/auth.json"
echo "Sandbox will mount it at /home/agent/.config/cursor/auth.json"

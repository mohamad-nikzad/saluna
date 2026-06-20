#!/usr/bin/env bash
set -Eeuo pipefail

RUNNER_VERSION="${RUNNER_VERSION:-2.335.1}"
RUNNER_SHA256="${RUNNER_SHA256:-4ef2f25285f0ae4477f1fe1e346db76d2f3ebf03824e2ddd1973a2819bf6c8cf}"
ICU_VERSION="${ICU_VERSION:-76.1-4}"
ICU_SHA256="${ICU_SHA256:-c1bf762996de9ecba9b9d871e4928a8090f023a3e9e7fa3240b3d90f892a01dc}"
RUNNER_ROOT="${RUNNER_ROOT:-/opt/saluna/github-runner}"
REPOSITORY_URL="${REPOSITORY_URL:-https://github.com/mohamad-nikzad/aravira}"
RUNNER_NAME="${RUNNER_NAME:-saluna-production-deploy}"

: "${GITHUB_RUNNER_TOKEN:?Set GITHUB_RUNNER_TOKEN to a repository runner registration token}"

if [[ -e "$RUNNER_ROOT/.runner" ]]; then
  echo "Runner is already configured at ${RUNNER_ROOT}." >&2
  exit 1
fi

mkdir -p "$RUNNER_ROOT"
archive="$(mktemp)"
icu_archive="$(mktemp)"
trap 'rm -f "$archive" "$icu_archive"' EXIT

if [[ ! -x "$RUNNER_ROOT/bin/Runner.Listener" ]]; then
  curl --fail --location --show-error \
    "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
    --output "$archive"
  printf '%s  %s\n' "$RUNNER_SHA256" "$archive" | sha256sum --check --status
  tar -xzf "$archive" -C "$RUNNER_ROOT"
fi

# Debian 13 does not install ICU by default. Keep the dependency private to the
# runner so the unprivileged deployment account needs no sudo access.
curl --fail --location --show-error \
  "https://deb.debian.org/debian/pool/main/i/icu/libicu76_${ICU_VERSION}_amd64.deb" \
  --output "$icu_archive"
printf '%s  %s\n' "$ICU_SHA256" "$icu_archive" | sha256sum --check --status
mkdir -p "$RUNNER_ROOT/.deps"
dpkg-deb --extract "$icu_archive" "$RUNNER_ROOT/.deps"

cd "$RUNNER_ROOT"
export LD_LIBRARY_PATH="$RUNNER_ROOT/.deps/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
./config.sh --unattended --replace \
  --url "$REPOSITORY_URL" \
  --token "$GITHUB_RUNNER_TOKEN" \
  --name "$RUNNER_NAME" \
  --labels saluna-deploy \
  --work _work

cat > start-runner.sh <<'SCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail
cd /opt/saluna/github-runner
export LD_LIBRARY_PATH="/opt/saluna/github-runner/.deps/usr/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
exec flock -n /tmp/saluna-github-runner.lock ./run.sh
SCRIPT
chmod 755 start-runner.sh

cron_line='* * * * * /opt/saluna/github-runner/start-runner.sh >> /opt/saluna/github-runner/runner.log 2>&1'
(
  crontab -l 2>/dev/null | grep -v '/opt/saluna/github-runner/start-runner.sh' || true
  printf '%s\n' "$cron_line"
) | crontab -

nohup ./start-runner.sh >> runner.log 2>&1 &
echo "GitHub deployment runner installed and started."

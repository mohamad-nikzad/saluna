#!/usr/bin/env bash
# Local Next-vs-Hono comparison runner.
#
# Boots both stacks in production mode against the local Postgres
# (.env.database.local), runs all k6 scenarios against each, then writes
# a side-by-side comparison.
#
# Prereqs:
#   - k6 installed (brew install k6)
#   - Local Postgres running and seeded: pnpm db:push:local && pnpm db:seed:local
#   - apps/app already built for prod: pnpm --filter @repo/app build:local
#     (re-run after any code change; the runner reminds you but does not rebuild)
#
# Usage:
#   ./benchmarks/run-compare.sh                    # all scenarios
#   ./benchmarks/run-compare.sh 01-cheap-read      # single scenario
#
# Result tags:
#   nextjs-api-routes-local   → benchmarks/results/local/nextjs-api-routes-local/
#   hono-node-local           → benchmarks/results/local/hono-node-local/
#   COMPARE-nextjs-api-routes-local-vs-hono-node-local.md
set -uo pipefail

if ! command -v k6 >/dev/null 2>&1; then
  echo "k6 not installed. Run: brew install k6" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

NEXT_PORT=3000
HONO_PORT=3002
NEXT_URL="http://localhost:${NEXT_PORT}"
HONO_URL="http://localhost:${HONO_PORT}"
BENCH_PHONE="${BENCH_PHONE:-09120000000}"
BENCH_PASSWORD="${BENCH_PASSWORD:-admin123}"

LOG_DIR="$REPO_ROOT/benchmarks/results/local/_logs"
mkdir -p "$LOG_DIR"
NEXT_LOG="$LOG_DIR/next.log"
HONO_LOG="$LOG_DIR/hono.log"

NEXT_PID=""
HONO_PID=""

cleanup() {
  echo
  echo "Shutting down servers..."
  [[ -n "$NEXT_PID" ]] && kill "$NEXT_PID" 2>/dev/null && wait "$NEXT_PID" 2>/dev/null
  [[ -n "$HONO_PID" ]] && kill "$HONO_PID" 2>/dev/null && wait "$HONO_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

wait_for() {
  local url="$1" label="$2" log="$3"
  echo -n "Waiting for $label at $url "
  for i in {1..90}; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$url" 2>/dev/null || echo "000")
    if [[ "$code" != "000" && "$code" != "5"* ]]; then
      echo " ready (HTTP $code)"
      return 0
    fi
    sleep 1
    echo -n "."
  done
  echo " TIMEOUT"
  echo "--- $label log ---"
  tail -50 "$log" 2>/dev/null || true
  return 1
}

# Sanity: ensure the Next prod build exists.
if [[ ! -d "apps/app/.next" ]] || [[ ! -f "apps/app/.next/BUILD_ID" ]]; then
  echo "Next prod build not found." >&2
  echo "Run: pnpm --filter @repo/app build:local" >&2
  exit 1
fi

echo "==> Starting Next (prod) on :${NEXT_PORT}"
( pnpm --filter @repo/app start:local >"$NEXT_LOG" 2>&1 ) &
NEXT_PID=$!

# Hono request-logger is off by default (Next's `next start` also doesn't log
# per request in prod). Set HONO_LOG_REQUESTS=1 to enable.
HONO_DISABLE_LOG=1
[[ "${HONO_LOG_REQUESTS:-0}" == "1" ]] && HONO_DISABLE_LOG=0
echo "==> Starting Hono (prod) on :${HONO_PORT} (DISABLE_REQUEST_LOG=${HONO_DISABLE_LOG})"
( DISABLE_REQUEST_LOG="$HONO_DISABLE_LOG" pnpm --filter @repo/api start:local >"$HONO_LOG" 2>&1 ) &
HONO_PID=$!

wait_for "${NEXT_URL}/api/auth/me" "Next" "$NEXT_LOG" || exit 1
wait_for "${HONO_URL}/health" "Hono" "$HONO_LOG" || exit 1

# Warm up both stacks (JIT, connection pool, route compile).
echo "==> Warming up..."
for i in 1 2 3; do
  curl -fsS "${NEXT_URL}/api/services" -H "Cookie: warmup=1" >/dev/null 2>&1 || true
  curl -fsS "${HONO_URL}/api/v1/services" -H "Cookie: warmup=1" >/dev/null 2>&1 || true
done

SCENARIO_ARG="${1:-}"

run_stack() {
  local stack="$1" base="$2" prefix="$3"
  echo
  echo "================================================================"
  echo "  STACK: $stack  ($base prefix=$prefix)"
  echo "================================================================"
  BASE_URL="$base" STACK="$stack" API_PREFIX="$prefix" \
    BENCH_PHONE="$BENCH_PHONE" BENCH_PASSWORD="$BENCH_PASSWORD" \
    ./benchmarks/run.sh ${SCENARIO_ARG:+"$SCENARIO_ARG"}
}

run_stack "nextjs-api-routes-local" "$NEXT_URL"  "/api"
run_stack "hono-node-local"         "$HONO_URL"  "/api/v1"

echo
echo "==> Comparing..."
node benchmarks/compare.mjs local nextjs-api-routes-local hono-node-local

echo
echo "Done. Server logs: $NEXT_LOG  $HONO_LOG"

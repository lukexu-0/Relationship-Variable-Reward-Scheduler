#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"

START_WORKER=1
USE_DOCKER=1
SYNC_SCHEDULER=1
INSTALL_DEPS=1

print_usage() {
  cat <<'USAGE'
Usage: tools/local/run-local.sh [options]

Starts the full local stack:
- Mongo + Redis (docker compose)
- Python scheduler service
- API service
- Web service
- Worker service (optional)

Options:
  --no-worker     Do not start worker service
  --skip-docker   Do not run `docker compose up -d mongo redis`
  --skip-sync     Skip `python3 -m uv sync --group dev`
  --no-install    Skip `corepack pnpm install`
  -h, --help      Show this help
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-worker)
      START_WORKER=0
      shift
      ;;
    --skip-docker)
      USE_DOCKER=0
      shift
      ;;
    --skip-sync)
      SYNC_SCHEDULER=0
      shift
      ;;
    --no-install)
      INSTALL_DEPS=0
      shift
      ;;
    -h|--help)
      print_usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      print_usage
      exit 1
      ;;
  esac
done

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

require_file() {
  if [[ ! -f "$1" ]]; then
    echo "Missing required file: $1" >&2
    echo "Create it from .env.example before starting." >&2
    exit 1
  fi
}

cd "$REPO_ROOT"

require_cmd corepack
require_cmd python3

if [[ "$USE_DOCKER" -eq 1 ]]; then
  require_cmd docker
fi

require_file "apps/api/.env"
require_file "apps/web/.env"
require_file "apps/scheduler-py/.env"
if [[ "$START_WORKER" -eq 1 ]]; then
  require_file "apps/worker/.env"
fi

if [[ "$INSTALL_DEPS" -eq 1 ]]; then
  echo "[local] Installing workspace dependencies..."
  corepack pnpm install
fi

if [[ "$USE_DOCKER" -eq 1 ]]; then
  echo "[local] Starting mongo + redis via docker compose..."
  docker compose up -d mongo redis
else
  echo "[local] Skipping docker compose start."
fi

if [[ "$SYNC_SCHEDULER" -eq 1 ]]; then
  echo "[local] Syncing python scheduler environment..."
  (
    cd apps/scheduler-py
    python3 -m uv sync --group dev
  )
else
  echo "[local] Skipping scheduler uv sync."
fi

declare -a PIDS=()

action_cleanup() {
  local exit_code=$?

  for pid in "${PIDS[@]:-}"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done

  wait || true

  if [[ $exit_code -ne 0 ]]; then
    echo "[local] Exiting due to service failure (code $exit_code)." >&2
  fi
}

trap action_cleanup EXIT
trap 'exit 130' INT TERM

start_service() {
  local name="$1"
  shift

  echo "[local] Starting ${name}..."
  "$@" &
  PIDS+=("$!")
}

start_service "scheduler" bash -lc "cd '$REPO_ROOT/apps/scheduler-py' && python3 -m uv run uvicorn scheduler_py.main:app --reload --host 0.0.0.0 --port 8000"
start_service "api" bash -lc "cd '$REPO_ROOT' && corepack pnpm --filter @reward/api dev"
start_service "web" bash -lc "cd '$REPO_ROOT' && corepack pnpm --filter @reward/web dev"

if [[ "$START_WORKER" -eq 1 ]]; then
  start_service "worker" bash -lc "cd '$REPO_ROOT' && corepack pnpm --filter @reward/worker dev"
fi

echo "[local] Stack is starting."
echo "[local] Web: http://localhost:5173"
echo "[local] API: http://localhost:3001/healthz"
echo "[local] Scheduler: http://localhost:8000/healthz"
echo "[local] Press Ctrl+C to stop all processes."

wait_for_any_service_exit() {
  while true; do
    local pid
    for pid in "${PIDS[@]:-}"; do
      if [[ -n "$pid" ]] && ! kill -0 "$pid" >/dev/null 2>&1; then
        if wait "$pid"; then
          return 0
        fi
        return $?
      fi
    done

    sleep 1
  done
}

if ! wait_for_any_service_exit; then
  exit $?
fi

exit 0

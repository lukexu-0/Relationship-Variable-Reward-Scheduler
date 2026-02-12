# Start App Locally

This file is the canonical local startup and validation runbook.

Repository root:
`/Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler`

## 1. Prerequisites
- Node 20+
- Python 3
- `uv` (`python3 -m pip install --user uv`)
- For containerized DB/services: Docker Desktop
- Alternative if Docker is unavailable: local MongoDB + Redis via Homebrew

## 2. Install dependencies (no `corepack enable`)
Do not run `corepack enable` if your machine blocks writes to `/usr/local/bin`.

```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
corepack pnpm install
```

Fallback if `corepack pnpm` is unavailable:
```bash
npx pnpm@10.5.2 install
```

## 3. Create environment files
```bash
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env
cp apps/scheduler-py/.env.example apps/scheduler-py/.env
```

Set at minimum:
- `apps/api/.env`
  - `JWT_ACCESS_SECRET` = 32+ chars
  - `JWT_REFRESH_SECRET` = 32+ chars
  - `CORS_ORIGINS=http://localhost:5173`
- `apps/worker/.env`
  - same JWT secrets as API
- `apps/web/.env`
  - `VITE_API_BASE_URL=http://localhost:3001`

For local non-AWS testing, placeholders are fine:
- `AWS_REGION=us-east-1`
- `SES_FROM_EMAIL=test@example.com`

## 4. Start Mongo and Redis

### Option A: Docker
```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
docker compose up -d mongo redis
```

### Option B: No Docker (Homebrew)
```bash
brew tap mongodb/brew
brew install mongodb-community@8.0 redis
brew services start mongodb-community@8.0
brew services start redis
```

## 5. Start application services
Use separate terminals.

### Terminal 1: Scheduler (Python FastAPI)
```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler/apps/scheduler-py
python3 -m uv sync --group dev
python3 -m uv run uvicorn scheduler_py.main:app --reload --host 0.0.0.0 --port 8000
```

### Terminal 2: API (Express)
```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
corepack pnpm --filter @reward/api dev
```

### Terminal 3: Web (React + Vite)
```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
corepack pnpm --filter @reward/web dev
```

### Terminal 4: Worker (BullMQ)
Start this only if you want queue and reminder processing locally.
```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
corepack pnpm --filter @reward/worker dev
```

### One-command local startup script
You can launch the full stack in one terminal:

```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
corepack pnpm local:start
```

Useful variants:

```bash
corepack pnpm local:start:no-worker
bash tools/local/run-local.sh --skip-docker --skip-sync
```

Ctrl+C stops all started services.

## 5.1 One-time event-config normalization (existing databases)
Run this once when upgrading an existing database to the event-config model.

```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
corepack pnpm --filter @reward/api exec tsx ../../tools/migrations/normalize-event-configs.ts
```

What it does:
- backfills/normalizes event config slugs per profile
- deduplicates conflicting event configs and reassigns linked events
- enforces one active upcoming event per event config
- backfills `hasExplicitTime=false` for historical events
- backfills `recurringBlackoutWeekdays=[]` where missing

## 6. Smoke-check locally
```bash
curl -s http://localhost:3001/healthz
curl -s http://localhost:8000/healthz
```

Open:
- `http://localhost:5173`

Minimum manual flow:
1. Register user.
2. In `Profiles`, expand `New profile` and create a profile.
3. Confirm default event configs are present in the left `Events` list.
4. Open `Event Builder`, then create/edit/delete an event.
5. Verify upcoming-event row delete works directly from the trash button (no confirm prompt).
6. Mark an event missed and load/apply missed options.
7. Verify adjustment history and calendar day highlighting update.
8. Open `Schedule Settings` from calendar top-right and save allowed-window/blackout changes.

## 7. Run full pre-deploy validation
```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
corepack pnpm -r build
corepack pnpm -r test
```

Web e2e workflows (requires local stack running, including API; worker required for auto-generation checks):
```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
corepack pnpm --filter @reward/web exec playwright install chromium
corepack pnpm --filter @reward/web test:e2e
```

If web is running on a non-default Vite port, set:
```bash
E2E_BASE_URL=http://localhost:5174 corepack pnpm --filter @reward/web test:e2e
```

Python scheduler coverage gate:
```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler/apps/scheduler-py
python3 -m uv run pytest --cov=src/scheduler_py --cov-report=term --cov-fail-under=80
```

Security checks:
```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
corepack pnpm audit --audit-level=low
python3 -m pip_audit -r apps/scheduler-py/requirements.audit.txt
```

Optional waiver gate emulation:
```bash
mkdir -p .security/reports
corepack pnpm audit --json > .security/reports/npm-audit.json
python3 -m pip_audit -r apps/scheduler-py/requirements.audit.txt -f json > .security/reports/pip-audit.json
node tools/security/check-waivers.mjs --reports .security/reports/npm-audit.json .security/reports/pip-audit.json
```

## 8. Stop local environment

If using Docker:
```bash
cd /Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler
docker compose down
```

If using Homebrew services:
```bash
brew services stop mongodb-community@8.0
brew services stop redis
```

## 9. Common local issues
- `EACCES` from `corepack enable`:
  - skip `corepack enable`
  - use `corepack pnpm ...` directly
- Docker not installed:
  - use Homebrew Mongo + Redis path above
- No AWS credentials locally:
  - API/web/scheduler still run
  - worker email delivery is optional for local testing
- Dashboard shows `UI failed to render`:
  - hard refresh
  - clear local storage key `reward-auth`
  - restart local stack

# Future Agent Handbook

This document is the complete handoff guide for future agents working in this repository.

Repository root:
`/Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler`

## 1. Product and locked decisions
This project is a multi-user relationship variable reward scheduler with:
- Authenticated user accounts.
- Multiple relationship profiles per user.
- Category sets backed by reward templates.
- Adaptive scheduling with Python logic.
- Missed-date recovery (`ASAP` and `DELAYED`) with user-driven apply.
- Full audit history for adjusted/rescheduled events.
- Optional email reminders via SES and queue workers.

Locked domain decisions:
- Sentiment scale: `VERY_POOR | POOR | NEUTRAL | WELL | VERY_WELL`
- Event statuses: `SCHEDULED | COMPLETED | MISSED | RESCHEDULED | CANCELED`
- Missed events are not direct negative training signal.
- Every date change appends immutable adjustment metadata.
- Single reminder per event reminder timestamp (`eventId + reminderAt` idempotency key).
- Per-user timezone is first-class.
- Exactly one template per `(profileId, category)` is allowed.
- Exactly one active upcoming event per `(profileId, category)` is allowed.

## 2. Stack
- Web: React + TypeScript + Vite + React Query
- API: Express + TypeScript + Mongoose + JWT + Argon2
- Worker: BullMQ + Redis + SES v2 client
- Scheduler service: FastAPI + Pydantic + NumPy
- DB: MongoDB
- Deploy: Kubernetes (Helm), AWS (ECR, EKS, Secrets Manager, SES, ElastiCache, Atlas externally)

## 3. Repository layout
- `apps/web` React UI (feature-split modules)
- `apps/api` Express API and domain models
- `apps/worker` queue workers and email sender
- `apps/scheduler-py` adaptive scheduler service
- `packages/shared-types` cross-service domain types
- `packages/shared-validation` zod contracts
- `packages/shared-config` env loading/validation
- `packages/shared-email` reminder email formatting
- `deploy/helm/relationship-reward` Kubernetes chart
- `docs` architecture, deployment, security, cost, and this guide
- `.github/workflows` CI, deploy, monthly dependency updates
- `.security` waiver config and scanner report outputs

## 4. Critical runtime contracts

### API base routes
- `/api/v1/auth/register`
- `/api/v1/auth/login`
- `/api/v1/auth/refresh`
- `/api/v1/auth/logout`
- `/api/v1/auth/me`
- `/api/v1/profiles`
- `/api/v1/profiles/:profileId`
- `/api/v1/profiles/:profileId/templates`
- `/api/v1/templates/:templateId`
- `/api/v1/profiles/:profileId/schedule-settings`
- `/api/v1/profiles/:profileId/events`
- `/api/v1/events/:eventId/complete`
- `/api/v1/events/:eventId/miss`
- `/api/v1/events/:eventId/missed-options`
- `/api/v1/events/:eventId/missed-options/:optionId/apply`
- `/api/v1/events/:eventId/reschedule`
- `/api/v1/events/:eventId` (`PATCH` update, `DELETE` hard delete)

### Scheduler service routes
- `GET /healthz`
- `POST /v1/scheduler/recommend-next`
- `POST /v1/scheduler/missed-options`
- `POST /v1/scheduler/recompute-state`

### Queue names
- `schedule-generation`
- `email-reminders`
- `event-followups`

### Mongo collections
- `users`
- `refresh_tokens`
- `profiles`
- `reward_templates`
- `schedule_settings`
- `reward_events`
- `scheduler_state`
- `email_logs`
- `idempotency_keys`

## 5. Core domain behavior

### Default templates
Created on profile creation:
- `flowers`
- `nice_date`
- `activity`
- `thoughtful_message`

### Event lifecycle
1. Event starts as `SCHEDULED`.
2. Completion marks `COMPLETED`, stores sentiment.
3. Missing marks `MISSED`, stores `missedAt`, then fetches options.
4. Applying option marks `RESCHEDULED`, appends immutable adjustment entry.
5. Manual reschedule also marks `RESCHEDULED` and appends adjustment.
6. Direct event edit supports notes and/or scheduled time updates.
7. Event hard delete permanently removes the event record.

### Missed-option determinism
- Missed option generation uses deterministic seed and `missedAt` anchor.
- Option IDs must remain stable between fetch and apply.
- Missed option endpoints now enforce `event.status === MISSED`.

### Scheduler logic
- Adaptive interval = base interval adjusted by weighted recent sentiment.
- Jitter applied within configured percentage bounds.
- Candidate times constrained by:
  - timezone
  - min-gap
  - allowed windows
  - blackout dates
- Missed options return both `ASAP` and `DELAYED` with rationale and one recommended option.
- Worker scheduling is category-aware; at most one future active event is created per category.

## 6. Local development workflows

Primary startup doc:
- `START_APP.md`

Common commands:
```bash
corepack pnpm install
corepack pnpm -r build
corepack pnpm -r test
```

Category-set data normalization command (upgrade existing DBs):
```bash
corepack pnpm --filter @reward/api exec tsx ../../tools/migrations/normalize-category-sets.ts
```

Python scheduler tests:
```bash
cd apps/scheduler-py
python3 -m uv sync --group dev
python3 -m uv run pytest --cov=src/scheduler_py --cov-report=term --cov-fail-under=80
```

## 7. Testing and coverage expectations
- API tests: high-coverage integration tests in `apps/api/src/app.test.ts`.
- Worker tests: queue and email behavior in `apps/worker/src/**/*.test.ts`.
- Web tests: feature-level integration and state tests in `apps/web/src/**/*.test.tsx`.
- Scheduler tests: logic + endpoint tests in `apps/scheduler-py/tests`.

Coverage policy:
- Maintain 80%+ coverage thresholds in package test configs and Python coverage gate.
- Do not lower thresholds to make failures disappear.

## 8. Security expectations
- JS audit: `pnpm audit --audit-level=low`
- Python audit: `pip_audit -r apps/scheduler-py/requirements.audit.txt`
- Container/FS scan: Trivy in CI
- Waivers are temporary only and validated by:
  - `tools/security/check-waivers.mjs`
  - `.security/waivers.yaml`

Important compatibility note:
- `apps/scheduler-py/requirements.audit.txt` intentionally includes Python-version markers for NumPy to keep audits compatible with older local Python runtimes and CI Python 3.12+.

## 9. CI/CD behavior

### CI (`.github/workflows/ci.yml`)
- Installs dependencies.
- Builds all packages.
- Runs JS test suites.
- Runs scheduler Python tests with coverage gate.
- Runs security scans.
- Enforces waiver policy.

### Deploy (`.github/workflows/deploy.yml`)
- Manual trigger with `dev`/`prod`.
- Builds and pushes all service images to ECR with commit-derived tag.
- Configures kube context.
- Deploys via Helm with environment-specific values.

### Monthly updates (`.github/workflows/monthly-dependency-update.yml`)
- Upgrades JS deps and Python lock.
- Syncs scheduler audit requirements.
- Rebuilds, retests, re-audits.
- Opens PR with `dependencies` and `security` labels.

## 10. Deployment and infrastructure docs
- Step-by-step deployment:
  - `docs/deployment.md`
- AWS cost controls:
  - `docs/aws-cost-guardrails.md`
- Security policy:
  - `docs/security.md`

## 11. Cost guardrails that must not be regressed
- Dev ingress disabled by default.
- Conservative replica counts.
- Resource requests/limits explicitly set.
- Budget/anomaly detection required before sustained usage.
- Keep emergency scale-to-zero and cluster teardown documented and usable.

## 12. Safe-change checklist for future agents
Before merging any non-trivial change:
1. Update shared types and validation schemas together.
2. Keep route contracts aligned with web client usage.
3. Preserve scheduler determinism for equal seed/input.
4. Preserve missed-option and adjustment audit behavior.
5. Preserve category-set uniqueness constraints (template + active upcoming event).
6. Run build + tests + coverage + audits locally.
7. Update docs when behavior, env vars, or workflows change.
8. Avoid weakening security gates without explicit owner approval.

## 13. Known local pitfalls
- `corepack enable` can fail with `EACCES`; use `corepack pnpm ...` directly.
- Docker may be unavailable; use local Mongo/Redis services via Homebrew.
- SES is optional for local testing; worker can be skipped for local no-email runs.
- If `pip_audit` uses an older system Python, rely on version-marked requirements and CI for canonical security check.

## 14. Definition of done for feature work
A feature is not done unless all of the following are true:
1. Implementation is complete across relevant services.
2. Automated tests cover success and failure paths.
3. Coverage gates still pass.
4. Security scans still pass.
5. Local startup and docs remain accurate.
6. Deployment impact is reflected in Helm/workflows/docs as needed.

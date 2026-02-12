# Future Agent Handbook

Repository root:
`/Users/lukexu/cs-projects/Relationship-Variable-Reward-Scheduler`

## 1. Product and locked decisions
This project is a multi-user relationship variable reward scheduler with:
- Authenticated user accounts
- Multiple relationship profiles per user
- Event configs (event-centric model; replaces template/category sets)
- Adaptive scheduling with Python logic
- Missed-date recovery (`ASAP` / `DELAYED`) with user-driven apply
- Immutable adjustment history for schedule changes
- Optional email reminders via queue worker
- Calendar-first scheduling UX with modal schedule settings
- Quick upcoming-event delete from hover affordance (no confirm prompt)

Locked domain decisions:
- Sentiment scale: `VERY_POOR | POOR | NEUTRAL | WELL | VERY_WELL`
- Event statuses: `SCHEDULED | COMPLETED | MISSED | RESCHEDULED | CANCELED`
- Missed events are not direct negative training signal
- Date/time changes append immutable adjustments
- One active upcoming event per `(profileId, eventConfigId)`
- Event config uniqueness per profile slug/name
- Date-only events are supported; explicit time is optional (`hasExplicitTime`)

## 2. Stack
- Web: React + TypeScript + Vite + React Query
- API: Express + TypeScript + Mongoose + JWT + Argon2
- Worker: BullMQ + Redis + SES v2 client
- Scheduler service: FastAPI + Pydantic + NumPy
- DB: MongoDB
- Deploy: Kubernetes (Helm), AWS (ECR, EKS, Secrets Manager, SES, ElastiCache, Atlas externally)

## 3. Repository layout
- `apps/web` React UI
- `apps/api` Express API and domain models
- `apps/worker` queue workers and email sender
- `apps/scheduler-py` adaptive scheduler service
- `packages/shared-types` cross-service domain types
- `packages/shared-validation` zod contracts
- `docs` architecture/deployment/security/cost/runbooks
- `tools/migrations` data normalization scripts

## 4. Critical runtime contracts

### API routes (current)
- `/api/v1/auth/register`
- `/api/v1/auth/login`
- `/api/v1/auth/refresh`
- `/api/v1/auth/logout`
- `/api/v1/auth/me`
- `/api/v1/profiles`
- `/api/v1/profiles/:profileId`
- `/api/v1/profiles/:profileId/event-configs`
- `/api/v1/event-configs/:eventConfigId`
- `/api/v1/profiles/:profileId/schedule-settings`
- `/api/v1/profiles/:profileId/events`
- `/api/v1/events/:eventId`
- `/api/v1/events/:eventId/complete`
- `/api/v1/events/:eventId/miss`
- `/api/v1/events/:eventId/missed-options`
- `/api/v1/events/:eventId/missed-options/:optionId/apply`
- `/api/v1/events/:eventId/reschedule`

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
- `reward_templates` (event-config semantics)
- `schedule_settings`
- `reward_events`
- `scheduler_state`
- `email_logs`
- `idempotency_keys`

## 5. Core behavior

### Default event configs
Created on profile creation:
- `Flowers` (`flowers`)
- `Date Night` (`date-night`)
- `Shared Activity` (`shared-activity`)
- `Thoughtful Message` (`thoughtful-message`)

### Event lifecycle
1. Event starts as `SCHEDULED`.
2. Completion marks `COMPLETED` and stores sentiment.
3. Missing marks `MISSED` and computes options.
4. Applying option marks `RESCHEDULED` and appends adjustment.
5. Manual reschedule also marks `RESCHEDULED` and appends adjustment.
6. Direct edit supports notes and/or date/time updates.
7. Hard delete permanently removes event record.

### Scheduling triggers
API enqueues schedule generation after:
- profile create
- event-config create/update/delete
- settings save
- event completion/miss/missed-option apply/delete/reschedule/schedule-changing edit

Worker behavior:
- immediate jobs handle near-real-time regeneration
- daily fallback scan preserves schedule continuity

## 6. Migration notes
Current normalization script:
```bash
corepack pnpm --filter @reward/api exec tsx ../../tools/migrations/normalize-event-configs.ts
```

What it enforces:
- slug backfill + dedupe per profile
- event reassignment from removed configs
- one active upcoming event per event config
- `hasExplicitTime=false` backfill for old events
- `recurringBlackoutWeekdays=[]` backfill for settings docs

## 7. Local workflows
See `START_APP.md` for canonical startup/testing.

Common commands:
```bash
corepack pnpm install
corepack pnpm local:start
corepack pnpm -r build
corepack pnpm -r test
corepack pnpm --filter @reward/web exec playwright install chromium
corepack pnpm --filter @reward/web test:e2e
```

If Vite runs on a non-default port:
```bash
E2E_BASE_URL=http://localhost:5174 corepack pnpm --filter @reward/web test:e2e
```

## 8. Coverage and quality gates
- Keep package coverage thresholds at or above configured gates (80% where configured).
- Do not lower thresholds to bypass failures.
- Keep docs updated for any contract/behavior changes.
- Keep API security regression tests green in `apps/api/src/security.test.ts`.

## 9. Security expectations
- JS audit: `pnpm audit --audit-level=low`
- Python audit: `pip_audit -r apps/scheduler-py/requirements.audit.txt`
- Trivy scans in CI
- Temporary waivers only via `.security/waivers.yaml`

## 10. Change checklist
Before merging:
1. Align shared types, shared validation, API routes, and web client methods.
2. Preserve event-config uniqueness + active-upcoming uniqueness invariants.
3. Keep missed-option determinism and adjustment history behavior.
4. Run build/tests (and e2e where applicable).
5. Update docs (`README.md`, `START_APP.md`, `docs/*`) for behavior/API changes.

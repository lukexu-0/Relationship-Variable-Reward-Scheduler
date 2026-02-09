# Relationship Variable Reward Scheduler

Monorepo for a multi-user relationship variable reward scheduler with:
- React + TypeScript web app
- Express + TypeScript API
- Python FastAPI scheduler logic service
- BullMQ worker for reminders
- MongoDB persistence
- Kubernetes + AWS deployment path

## Current Product Shape
- Category-set dashboard with a left list + inspector workflow.
- One template per category (per profile).
- One active upcoming event per category (`SCHEDULED` or `RESCHEDULED`, future-dated).
- Event editor supports API-backed update and hard delete.
- Blackout dates are managed in structured add/edit/delete rows instead of raw JSON text editing.

## Start Here
- Local startup and test runbook: `START_APP.md`
- Complete handoff guide for future agents: `docs/FUTURE_AGENTS.md`
- One-command local stack startup: `corepack pnpm local:start`

## Documentation Index
- System architecture: `docs/architecture.md`
- Step-by-step AWS + Kubernetes deployment: `docs/deployment.md`
- AWS bill-shock prevention guardrails: `docs/aws-cost-guardrails.md`
- Security policy and vulnerability gates: `docs/security.md`

## Repository Layout
- `apps/web`: React web client
- `apps/api`: Express API
- `apps/worker`: BullMQ queue workers and reminder sender
- `apps/scheduler-py`: FastAPI adaptive scheduling service
- `packages/shared-types`: shared domain types and enums
- `packages/shared-validation`: shared Zod schemas
- `packages/shared-config`: shared env/config loading
- `packages/shared-email`: reminder email formatting
- `deploy/helm/relationship-reward`: Helm chart for web/api/worker/scheduler

## Security and Dependency Policy
- Use lockfile-pinned dependencies.
- CI scans JS/Python/deployment artifacts for vulnerabilities.
- CI fails on known vulnerabilities unless explicitly waived in `.security/waivers.yaml`.
- Waivers are temporary and must include owner, justification, and expiry.

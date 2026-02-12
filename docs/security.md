# Security and Vulnerability Policy

## Enforcement
CI fails on any detected vulnerability unless there is an active waiver entry.

## Waiver File
Path: `.security/waivers.yaml`

Required fields per waiver:
- `id`
- `ecosystem`
- `package`
- `justification`
- `owner`
- `expires_on`

Expired waivers fail CI automatically.

## Scanners in CI
- `pnpm audit`
- `pip-audit`
- `trivy fs`
- `trivy image` for `api`, `worker`, `web`, `scheduler-py`

## API Safety Invariants
- All event/event-config writes are ownership-guarded through profile ownership checks.
- Event-config writes enforce unique slug/name per profile.
- Event writes enforce one active upcoming event per `(profileId, eventConfigId)`.
- Event hard delete is explicit (`DELETE /api/v1/events/:eventId`) and requires authenticated ownership.
- Schedule-changing event edits require a reason and append immutable adjustment history.
- CORS is allowlist-enforced (`CORS_ORIGINS`), with disallowed origins rejected.

## Regression Test Coverage
- API security regressions live in `apps/api/src/security.test.ts`.
- Current checks include:
  - disallowed vs allowed CORS origin behavior
  - malformed bearer token rejection
  - NoSQL-style object payload rejection on auth/event-config paths
  - mass-assignment prevention on profile creation

## Update Cadence
Monthly dependency update workflow opens a PR with latest stable JS and Python updates.

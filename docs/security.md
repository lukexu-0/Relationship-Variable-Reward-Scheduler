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
- All event/template writes are ownership-guarded through profile ownership checks.
- Template writes enforce one template per `(profileId, category)`.
- Event writes enforce one active upcoming event per `(profileId, category)`.
- Event hard delete is explicit (`DELETE /api/v1/events/:eventId`) and requires authenticated ownership.

## Update Cadence
Monthly dependency update workflow opens a PR with latest stable JS and Python updates.

# Documentation Index

Use this as the docs entrypoint.

## Core
- `docs/FUTURE_AGENTS.md`: Complete implementation and maintenance handbook for future agents.
- `docs/architecture.md`: Architecture, boundaries, and service responsibilities.
- `docs/deployment.md`: Step-by-step deployment for AWS + EKS + Helm.
- `docs/aws-cost-guardrails.md`: AWS spend controls, monitoring, and emergency cost shutdown runbook.
- `docs/security.md`: Vulnerability policy, waiver rules, and CI enforcement model.

## Local Development
- `START_APP.md` (repo root): Canonical local startup, testing, and troubleshooting flow.

## Operational Expectations
1. Keep API/web/worker/scheduler contracts aligned with shared types and shared validation.
2. Preserve missed-event option flow and immutable event adjustment history.
3. Preserve category-set invariants:
   - one template per profile/category
   - one active upcoming event per profile/category
4. Maintain 80%+ coverage and pass all security scans before release.
5. Update docs when changing behavior, infra, env vars, or workflows.

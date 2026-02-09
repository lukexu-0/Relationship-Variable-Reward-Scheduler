# Architecture

## Services
- `apps/web`: React frontend for auth, profile switching, category-set management, blackout editing, and event workflows.
- `apps/api`: Express API for auth, domain CRUD, and scheduler orchestration.
- `apps/worker`: BullMQ workers for schedule generation and email reminders.
- `apps/scheduler-py`: FastAPI service for adaptive scheduling and missed-date options.

## Core Data Flow
1. User signs in via API with email/password.
2. User configures category sets (template-backed), date windows, blackouts, and timezone.
3. Worker creates future events by category by calling scheduler service.
4. Worker queues single lead-time reminder emails via SES.
5. User edits/completes/misses/reschedules/deletes events in web UI.
6. Missed events generate ASAP/DELAYED options from Python logic.

## Key Domain Rules
- Missed events are tracked but do not directly train sentiment score as negative.
- Every reschedule writes immutable adjustment audit history.
- Scheduling enforces allowed windows, blackout dates, timezone, and minimum gap.
- Exactly one template exists per `(profile, category)`.
- Exactly one active upcoming event exists per `(profile, category)` where active is `SCHEDULED | RESCHEDULED` and upcoming is `scheduledAt > now`.
- API supports direct event edits (`PATCH /api/v1/events/:eventId`) and hard delete (`DELETE /api/v1/events/:eventId`).

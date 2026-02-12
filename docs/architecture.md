# Architecture

## Services
- `apps/web`: React frontend for auth, profile switching, event-config management, event CRUD, calendar, and schedule settings.
- `apps/api`: Express API for auth, profile/event-config/event CRUD, and schedule-generation enqueue triggers.
- `apps/worker`: BullMQ workers for schedule generation and reminder emails.
- `apps/scheduler-py`: FastAPI service for adaptive scheduling recommendations and missed-date options.

## Core Data Flow
1. User signs in via API with email/password.
2. User creates/selects a profile.
3. User manages event configs (name/slug/base interval/jitter/enabled).
4. User manages schedule settings (allowed windows, recurring blackout weekdays, date-range blackouts).
5. User creates/edits/completes/misses/reschedules/deletes events.
6. API enqueues `schedule-generation` on relevant mutations.
7. Worker generates future events by event config and keeps one active upcoming event per config.
8. Worker queues reminder jobs; scheduler-py handles adaptive timing and missed-option generation.

## Domain Model
- **Event config** (`reward_templates` collection, event-config semantics):
  - `profileId`, `name`, `slug`, `baseIntervalDays`, `jitterPct`, `enabled`
  - unique per profile on both `slug` and `name`
- **Reward event**:
  - `eventConfigId` (legacy `templateId` retained for compatibility paths)
  - `scheduledAt`, `originalScheduledAt`, `status`, `notes`, `adjustments`
  - `hasExplicitTime` controls date-only vs explicit-time display/serialization
- **Schedule settings**:
  - `timezone`, `reminderLeadHours`, `minGapHours`
  - `allowedWindows`
  - `recurringBlackoutWeekdays`
  - `blackoutDates`

## Key Invariants
- Exactly one active upcoming event exists per `(profileId, eventConfigId)` where:
  - active = `SCHEDULED | RESCHEDULED`
  - upcoming = `scheduledAt > now`
- Event configs are unique by normalized slug per profile.
- Every schedule-changing event edit/reschedule appends immutable adjustment history.
- Missed options are only available and applicable for events in `MISSED` status.
- Schedule settings cannot fully block all scheduling space.

## API Surface (current)
- Auth:
  - `/api/v1/auth/register`
  - `/api/v1/auth/login`
  - `/api/v1/auth/refresh`
  - `/api/v1/auth/logout`
  - `/api/v1/auth/me`
- Profiles:
  - `/api/v1/profiles`
  - `/api/v1/profiles/:profileId`
- Event configs:
  - `GET/POST /api/v1/profiles/:profileId/event-configs`
  - `PATCH/DELETE /api/v1/event-configs/:eventConfigId`
- Schedule settings:
  - `GET/PUT /api/v1/profiles/:profileId/schedule-settings`
- Events:
  - `GET/POST /api/v1/profiles/:profileId/events`
  - `PATCH/DELETE /api/v1/events/:eventId`
  - `PATCH /api/v1/events/:eventId/complete`
  - `PATCH /api/v1/events/:eventId/miss`
  - `GET /api/v1/events/:eventId/missed-options`
  - `POST /api/v1/events/:eventId/missed-options/:optionId/apply`
  - `PATCH /api/v1/events/:eventId/reschedule`

## Scheduling Behavior
- **Immediate generation:** API enqueues `schedule-generation` after event/event-config/settings/profile mutations that affect future schedule completeness.
- **Daily fallback generation:** worker periodic scan ensures profiles still receive upcoming events.
- **Optional event time semantics:**
  - if user provides `scheduledTime`, event stores `hasExplicitTime=true`
  - date-only events resolve to allowed-window start (fallback `09:00`) and store `hasExplicitTime=false`

## Frontend UI Flow
- Left column:
  - profiles + compact expandable profile creation panel (`New profile`)
  - event list (event-config centric)
  - `Event Builder` toggle that reveals inspector/editor on demand
- Main column:
  - month calendar with event indicators, day-selection sync, and month jump
  - upcoming events panel (with past-events drawer below)
  - schedule settings modal launched from calendar top-right
- Event interactions:
  - hover-delete control for upcoming rows (direct delete, no confirmation prompt)
  - full event edit/delete from inspector editor
  - missed recovery options inline in inspector

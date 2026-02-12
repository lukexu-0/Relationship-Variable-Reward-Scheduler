import crypto from "node:crypto";

import { Router } from "express";
import {
  applyMissedOptionSchema,
  completeEventSchema,
  createEventSchema,
  missEventSchema,
  rescheduleEventSchema,
  updateEventSchema
} from "@reward/shared-validation";
import type { MissedRescheduleOption, SentimentLevel } from "@reward/shared-types";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../lib/http-error.js";
import { parseOrThrow } from "../lib/zod.js";
import { RewardEventModel, type RewardEventDocument } from "../models/reward-event.model.js";
import { RewardEventConfigModel } from "../models/reward-event-config.model.js";
import { ScheduleSettingsModel } from "../models/schedule-settings.model.js";
import {
  ACTIVE_UPCOMING_STATUSES,
  assertEventConfigUpcomingUnique
} from "../services/event-config-event-constraints.js";
import { getOwnedProfile } from "../services/profile-access.js";
import {
  getMissedOptions,
  recomputeSchedulerState,
  type SchedulerEventHistoryPayload,
  type SchedulerSettingsPayload,
  type SchedulerTemplatePayload
} from "../services/scheduler-client.js";
import { queueReminder, removeReminderJobsForEvent } from "../services/reminder-queue.js";
import { enqueueProfileScheduleGeneration } from "../services/schedule-generation-queue.js";

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

eventsRouter.get(
  "/profiles/:profileId/events",
  asyncHandler(async (req, res) => {
    const profileId = String(req.params.profileId);
    await getOwnedProfile(profileId, req.user!.id);

    const query: Record<string, unknown> = { profileId };
    if (typeof req.query.from === "string" || typeof req.query.to === "string") {
      query.scheduledAt = {};
      if (typeof req.query.from === "string") {
        (query.scheduledAt as Record<string, Date>).$gte = new Date(req.query.from);
      }
      if (typeof req.query.to === "string") {
        (query.scheduledAt as Record<string, Date>).$lte = new Date(req.query.to);
      }
    }

    const events = await RewardEventModel.find(query).sort({ scheduledAt: -1 }).limit(200).lean();
    res.json({ events });
  })
);

eventsRouter.post(
  "/profiles/:profileId/events",
  asyncHandler(async (req, res) => {
    const profileId = String(req.params.profileId);
    await getOwnedProfile(profileId, req.user!.id);
    const input = parseOrThrow(createEventSchema, req.body);

    const eventConfig = await RewardEventConfigModel.findOne({
      _id: input.eventConfigId,
      profileId
    });

    if (!eventConfig) {
      throw new HttpError(404, "Event config not found");
    }

    const schedule = await resolveScheduledAt({
      profileId,
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime
    });

    await assertEventConfigUpcomingUnique({
      profileId,
      eventConfigId: eventConfig.id,
      scheduledAt: schedule.scheduledAt,
      status: "SCHEDULED"
    });

    const event = await RewardEventModel.create({
      profileId,
      eventConfigId: eventConfig.id,
      // Legacy compatibility field for older worker/email paths.
      templateId: eventConfig.id,
      scheduledAt: schedule.scheduledAt,
      originalScheduledAt: schedule.scheduledAt,
      hasExplicitTime: schedule.hasExplicitTime,
      status: "SCHEDULED",
      notes: input.notes,
      adjustments: []
    });

    await queueReminderForActiveUpcomingEvent(
      event,
      req.user!.reminderPreferences.reminderLeadHours
    );

    res.status(201).json({ event });
  })
);

eventsRouter.patch(
  "/events/:eventId",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(updateEventSchema, req.body);
    const event = await getOwnedEvent(String(req.params.eventId), req.user!.id);
    const eventConfigId = getEventConfigId(event);

    const currentScheduledAt = event.scheduledAt;
    const profileId = event.profileId.toString();
    let scheduledChanged = false;

    if (input.scheduledDate || input.scheduledTime) {
      const settings = await ScheduleSettingsModel.findOne({ profileId }).lean();
      const timezone = settings?.timezone ?? "UTC";
      const scheduledDate = input.scheduledDate ?? isoToDateString(currentScheduledAt, timezone);

      const schedule = await resolveScheduledAt({
        profileId,
        scheduledDate,
        scheduledTime: input.scheduledTime
      });
      scheduledChanged = schedule.scheduledAt.getTime() !== currentScheduledAt.getTime();

      if (scheduledChanged) {
        await assertEventConfigUpcomingUnique({
          profileId,
          eventConfigId,
          scheduledAt: schedule.scheduledAt,
          status: event.status,
          excludeEventId: event.id
        });

        event.scheduledAt = schedule.scheduledAt;
        event.hasExplicitTime = schedule.hasExplicitTime;
        event.adjustments.push({
          fromAt: currentScheduledAt,
          toAt: schedule.scheduledAt,
          reason: input.reason as string,
          adjustedByUserId: req.user!.id,
          adjustedAt: new Date()
        });
      }
    }

    if (scheduledChanged && !input.reason) {
      throw new HttpError(400, "A reason is required when changing schedule date/time");
    }

    if (input.notes !== undefined) {
      event.notes = input.notes;
    }

    await event.save();

    if (scheduledChanged) {
      await syncReminderForEvent(
        event,
        req.user!.reminderPreferences.reminderLeadHours
      );
      await enqueueProfileScheduleGeneration(profileId).catch(() => undefined);
    }

    res.json({ event });
  })
);

eventsRouter.delete(
  "/events/:eventId",
  asyncHandler(async (req, res) => {
    const event = await getOwnedEvent(String(req.params.eventId), req.user!.id);
    await removeReminderJobsForEvent(event.id);
    await event.deleteOne();

    await enqueueProfileScheduleGeneration(event.profileId.toString()).catch(() => undefined);

    res.status(204).send();
  })
);

eventsRouter.patch(
  "/events/:eventId/complete",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(completeEventSchema, req.body);
    const event = await getOwnedEvent(String(req.params.eventId), req.user!.id);
    const eventConfigId = getEventConfigId(event);

    event.status = "COMPLETED";
    event.completedAt = new Date();
    event.sentimentLevel = input.sentimentLevel;
    event.notes = input.notes ?? event.notes;
    await event.save();

    await removeReminderJobsForEvent(event.id);
    await tryRecomputeSchedulerState(
      event.profileId.toString(),
      eventConfigId,
      input.sentimentLevel
    );
    await enqueueProfileScheduleGeneration(event.profileId.toString()).catch(() => undefined);

    res.json({ event });
  })
);

eventsRouter.patch(
  "/events/:eventId/miss",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(missEventSchema, req.body);
    const event = await getOwnedEvent(String(req.params.eventId), req.user!.id);

    event.status = "MISSED";
    event.missedAt = new Date();
    event.notes = input.reason ? `${event.notes ?? ""}\n[Missed Reason] ${input.reason}`.trim() : event.notes;
    await event.save();

    await removeReminderJobsForEvent(event.id);
    const options = await buildMissedOptions(event, req.user!.id);
    await enqueueProfileScheduleGeneration(event.profileId.toString()).catch(() => undefined);

    res.json({ event, options });
  })
);

eventsRouter.get(
  "/events/:eventId/missed-options",
  asyncHandler(async (req, res) => {
    const event = await getOwnedEvent(String(req.params.eventId), req.user!.id);
    if (event.status !== "MISSED") {
      throw new HttpError(400, "Missed options are only available for missed events");
    }
    const options = await buildMissedOptions(event, req.user!.id);
    res.json({ options });
  })
);

eventsRouter.post(
  "/events/:eventId/missed-options/:optionId/apply",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(applyMissedOptionSchema, req.body);
    const event = await getOwnedEvent(String(req.params.eventId), req.user!.id);
    const eventConfigId = getEventConfigId(event);
    if (event.status !== "MISSED") {
      throw new HttpError(400, "Only missed events can apply missed options");
    }

    const options = await buildMissedOptions(event, req.user!.id);
    const optionId = String(req.params.optionId);
    const selected = options.find((option) => option.optionId === optionId);

    if (!selected) {
      throw new HttpError(404, "Missed option not found");
    }

    const previousScheduledAt = event.scheduledAt;
    const proposedAt = new Date(selected.proposedAt);
    await assertEventConfigUpcomingUnique({
      profileId: event.profileId.toString(),
      eventConfigId,
      scheduledAt: proposedAt,
      status: "RESCHEDULED",
      excludeEventId: event.id
    });

    event.status = "RESCHEDULED";
    event.scheduledAt = proposedAt;
    event.hasExplicitTime = true;
    event.adjustments.push({
      fromAt: previousScheduledAt,
      toAt: proposedAt,
      reason: input.reason ?? `Applied ${selected.type} missed option`,
      adjustedByUserId: req.user!.id,
      adjustedAt: new Date()
    });
    await event.save();

    await syncReminderForEvent(
      event,
      req.user!.reminderPreferences.reminderLeadHours
    );
    await enqueueProfileScheduleGeneration(event.profileId.toString()).catch(() => undefined);

    res.json({ event, selectedOption: selected });
  })
);

eventsRouter.patch(
  "/events/:eventId/reschedule",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(rescheduleEventSchema, req.body);
    const event = await getOwnedEvent(String(req.params.eventId), req.user!.id);
    const eventConfigId = getEventConfigId(event);

    const previousScheduledAt = event.scheduledAt;
    const schedule = await resolveScheduledAt({
      profileId: event.profileId.toString(),
      scheduledDate: input.scheduledDate,
      scheduledTime: input.scheduledTime
    });

    await assertEventConfigUpcomingUnique({
      profileId: event.profileId.toString(),
      eventConfigId,
      scheduledAt: schedule.scheduledAt,
      status: "RESCHEDULED",
      excludeEventId: event.id
    });

    event.status = "RESCHEDULED";
    event.scheduledAt = schedule.scheduledAt;
    event.hasExplicitTime = schedule.hasExplicitTime;
    event.adjustments.push({
      fromAt: previousScheduledAt,
      toAt: schedule.scheduledAt,
      reason: input.reason,
      adjustedByUserId: req.user!.id,
      adjustedAt: new Date()
    });
    await event.save();

    await syncReminderForEvent(
      event,
      req.user!.reminderPreferences.reminderLeadHours
    );
    await enqueueProfileScheduleGeneration(event.profileId.toString()).catch(() => undefined);

    res.json({ event });
  })
);

async function getOwnedEvent(eventId: string, userId: string): Promise<RewardEventDocument> {
  const event = await RewardEventModel.findById(eventId);
  if (!event) {
    throw new HttpError(404, "Event not found");
  }

  await getOwnedProfile(event.profileId.toString(), userId);
  return event;
}

async function buildMissedOptions(
  event: RewardEventDocument,
  userId: string
): Promise<MissedRescheduleOption[]> {
  await getOwnedProfile(event.profileId.toString(), userId);
  const settingsDoc = await ScheduleSettingsModel.findOne({ profileId: event.profileId });
  const eventConfigDoc = await RewardEventConfigModel.findById(getEventConfigId(event));

  if (!settingsDoc || !eventConfigDoc) {
    throw new HttpError(400, "Missing settings or event config for event");
  }

  const eventConfigId = getEventConfigId(event);
  const historyDocs = await RewardEventModel.find({
    profileId: event.profileId,
    $or: [{ eventConfigId }, { templateId: eventConfigId }]
  })
    .sort({ scheduledAt: -1 })
    .limit(60)
    .lean();

  const settings: SchedulerSettingsPayload = {
    timezone: settingsDoc.timezone,
    minGapHours: settingsDoc.minGapHours,
    allowedWindows: settingsDoc.allowedWindows.map((window) => ({
      weekday: window.weekday,
      startLocalTime: window.startLocalTime,
      endLocalTime: window.endLocalTime
    })),
    recurringBlackoutWeekdays: settingsDoc.recurringBlackoutWeekdays ?? [],
    blackoutDates: settingsDoc.blackoutDates.map((blackout) => ({
      startAt: blackout.startAt.toISOString(),
      endAt: blackout.endAt?.toISOString(),
      allDay: blackout.allDay,
      note: blackout.note ?? undefined
    }))
  };

  const eventConfig: SchedulerTemplatePayload = {
    id: eventConfigDoc.id,
    name: eventConfigDoc.name,
    baseIntervalDays: eventConfigDoc.baseIntervalDays,
    jitterPct: eventConfigDoc.jitterPct
  };

  const eventHistory: SchedulerEventHistoryPayload[] = historyDocs.map((doc) => ({
    scheduledAt: doc.scheduledAt.toISOString(),
    status: doc.status,
    completedAt: doc.completedAt?.toISOString(),
    missedAt: doc.missedAt?.toISOString(),
    sentimentLevel: doc.sentimentLevel as SentimentLevel | undefined
  }));

  const options = await getMissedOptions({
    seed: deterministicSeed(event.id),
    now: (event.missedAt ?? new Date()).toISOString(),
    eventId: event.id,
    currentScheduledAt: event.scheduledAt.toISOString(),
    settings,
    eventConfig,
    eventHistory
  });

  return options.map((option) => ({
    ...option,
    profileId: event.profileId.toString()
  }));
}

async function tryRecomputeSchedulerState(
  profileId: string,
  eventConfigId: string,
  sentimentLevel: SentimentLevel
): Promise<void> {
  try {
    await recomputeSchedulerState({
      profileId,
      now: new Date().toISOString(),
      eventConfigSignals: [
        {
          eventConfigId,
          status: "COMPLETED",
          sentimentLevel,
          completedAt: new Date().toISOString()
        }
      ]
    });
  } catch {
    return;
  }
}

function deterministicSeed(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getEventConfigId(event: RewardEventDocument): string {
  const eventConfigId = event.eventConfigId?.toString() ?? event.templateId?.toString();
  if (!eventConfigId) {
    throw new HttpError(400, "Event is missing eventConfigId");
  }

  return eventConfigId;
}

interface ResolveScheduledAtInput {
  profileId: string;
  scheduledDate: string;
  scheduledTime?: string;
}

async function resolveScheduledAt({
  profileId,
  scheduledDate,
  scheduledTime
}: ResolveScheduledAtInput): Promise<{ scheduledAt: Date; hasExplicitTime: boolean }> {
  const settings = await ScheduleSettingsModel.findOne({ profileId }).lean();
  const timezone = settings?.timezone ?? "UTC";

  let effectiveTime = scheduledTime;
  let hasExplicitTime = Boolean(scheduledTime);

  if (!effectiveTime) {
    const weekday = weekdayFromDateString(scheduledDate);
    const allowedWindows = (settings?.allowedWindows ?? [])
      .filter((window) => window.weekday === weekday)
      .sort((left, right) => left.startLocalTime.localeCompare(right.startLocalTime));

    effectiveTime = allowedWindows[0]?.startLocalTime ?? "09:00";
    hasExplicitTime = false;
  }

  return {
    scheduledAt: zonedDateTimeToUtc(scheduledDate, effectiveTime, timezone),
    hasExplicitTime
  };
}

function weekdayFromDateString(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

function zonedDateTimeToUtc(dateString: string, timeString: string, timezone: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  const [hour, minute] = timeString.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  try {
    const zoned = new Date(utcGuess.toLocaleString("en-US", { timeZone: timezone }));
    const diffMs = utcGuess.getTime() - zoned.getTime();
    return new Date(utcGuess.getTime() + diffMs);
  } catch {
    return utcGuess;
  }
}

function isoToDateString(value: Date, timezone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });

    const parts = formatter.formatToParts(value);
    const year = parts.find((part) => part.type === "year")?.value ?? "1970";
    const month = parts.find((part) => part.type === "month")?.value ?? "01";
    const day = parts.find((part) => part.type === "day")?.value ?? "01";
    return `${year}-${month}-${day}`;
  } catch {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, "0");
    const day = String(value.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

async function syncReminderForEvent(
  event: RewardEventDocument,
  fallbackLeadHours: number
): Promise<void> {
  await removeReminderJobsForEvent(event.id);
  await queueReminderForActiveUpcomingEvent(event, fallbackLeadHours);
}

async function queueReminderForActiveUpcomingEvent(
  event: RewardEventDocument,
  fallbackLeadHours: number
): Promise<void> {
  if (!ACTIVE_UPCOMING_STATUSES.includes(event.status as (typeof ACTIVE_UPCOMING_STATUSES)[number])) {
    return;
  }

  if (event.scheduledAt.getTime() <= Date.now()) {
    return;
  }

  const settings = await ScheduleSettingsModel.findOne({ profileId: event.profileId });
  const leadHours = settings?.reminderLeadHours ?? fallbackLeadHours;
  await queueReminder(event.id, event.scheduledAt, leadHours);
}

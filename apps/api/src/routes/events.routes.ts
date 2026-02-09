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
import { RewardTemplateModel } from "../models/reward-template.model.js";
import { ScheduleSettingsModel } from "../models/schedule-settings.model.js";
import {
  ACTIVE_UPCOMING_STATUSES,
  assertCategoryUpcomingUnique,
  getCategoryFromTemplateId
} from "../services/category-event-constraints.js";
import { getOwnedProfile } from "../services/profile-access.js";
import {
  getMissedOptions,
  recomputeSchedulerState,
  type SchedulerEventHistoryPayload,
  type SchedulerSettingsPayload,
  type SchedulerTemplatePayload
} from "../services/scheduler-client.js";
import { queueReminder, removeReminderJobsForEvent } from "../services/reminder-queue.js";

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

    const template = await RewardTemplateModel.findOne({
      _id: input.templateId,
      profileId
    });

    if (!template) {
      throw new HttpError(404, "Template not found");
    }

    const scheduledAt = new Date(input.scheduledAt);
    await assertCategoryUpcomingUnique({
      profileId,
      category: template.category,
      scheduledAt,
      status: "SCHEDULED"
    });

    const event = await RewardEventModel.create({
      profileId,
      templateId: template.id,
      scheduledAt,
      originalScheduledAt: scheduledAt,
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

    const currentScheduledAt = event.scheduledAt;
    const nextScheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : currentScheduledAt;
    const scheduledChanged = nextScheduledAt.getTime() !== currentScheduledAt.getTime();

    if (scheduledChanged && !input.reason) {
      throw new HttpError(400, "A reason is required when changing scheduledAt");
    }

    if (scheduledChanged) {
      const category = await getCategoryFromTemplateId(event.templateId.toString());
      await assertCategoryUpcomingUnique({
        profileId: event.profileId.toString(),
        category,
        scheduledAt: nextScheduledAt,
        status: event.status,
        excludeEventId: event.id
      });

      event.scheduledAt = nextScheduledAt;
      event.adjustments.push({
        fromAt: currentScheduledAt,
        toAt: nextScheduledAt,
        reason: input.reason as string,
        adjustedByUserId: req.user!.id,
        adjustedAt: new Date()
      });
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
    res.status(204).send();
  })
);

eventsRouter.patch(
  "/events/:eventId/complete",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(completeEventSchema, req.body);
    const event = await getOwnedEvent(String(req.params.eventId), req.user!.id);

    event.status = "COMPLETED";
    event.completedAt = new Date();
    event.sentimentLevel = input.sentimentLevel;
    event.notes = input.notes ?? event.notes;
    await event.save();

    await removeReminderJobsForEvent(event.id);
    await tryRecomputeSchedulerState(event.profileId.toString(), event.templateId.toString(), input.sentimentLevel);

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
    const category = await getCategoryFromTemplateId(event.templateId.toString());
    const proposedAt = new Date(selected.proposedAt);
    await assertCategoryUpcomingUnique({
      profileId: event.profileId.toString(),
      category,
      scheduledAt: proposedAt,
      status: "RESCHEDULED",
      excludeEventId: event.id
    });

    event.status = "RESCHEDULED";
    event.scheduledAt = proposedAt;
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

    res.json({ event, selectedOption: selected });
  })
);

eventsRouter.patch(
  "/events/:eventId/reschedule",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(rescheduleEventSchema, req.body);
    const event = await getOwnedEvent(String(req.params.eventId), req.user!.id);

    const previousScheduledAt = event.scheduledAt;
    const nextScheduledAt = new Date(input.scheduledAt);
    const category = await getCategoryFromTemplateId(event.templateId.toString());
    await assertCategoryUpcomingUnique({
      profileId: event.profileId.toString(),
      category,
      scheduledAt: nextScheduledAt,
      status: "RESCHEDULED",
      excludeEventId: event.id
    });

    event.status = "RESCHEDULED";
    event.scheduledAt = nextScheduledAt;
    event.adjustments.push({
      fromAt: previousScheduledAt,
      toAt: nextScheduledAt,
      reason: input.reason,
      adjustedByUserId: req.user!.id,
      adjustedAt: new Date()
    });
    await event.save();

    await syncReminderForEvent(
      event,
      req.user!.reminderPreferences.reminderLeadHours
    );

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
  const templateDoc = await RewardTemplateModel.findById(event.templateId);

  if (!settingsDoc || !templateDoc) {
    throw new HttpError(400, "Missing settings or template for event");
  }

  const historyDocs = await RewardEventModel.find({
    profileId: event.profileId,
    templateId: event.templateId
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
    blackoutDates: settingsDoc.blackoutDates.map((blackout) => ({
      startAt: blackout.startAt.toISOString(),
      endAt: blackout.endAt?.toISOString(),
      allDay: blackout.allDay,
      note: blackout.note ?? undefined
    }))
  };

  const template: SchedulerTemplatePayload = {
    id: templateDoc.id,
    name: templateDoc.name,
    baseIntervalDays: templateDoc.baseIntervalDays,
    jitterPct: templateDoc.jitterPct
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
    template,
    eventHistory
  });

  return options.map((option) => ({
    ...option,
    profileId: event.profileId.toString()
  }));
}

async function tryRecomputeSchedulerState(
  profileId: string,
  templateId: string,
  sentimentLevel: SentimentLevel
): Promise<void> {
  try {
    await recomputeSchedulerState({
      profileId,
      now: new Date().toISOString(),
      templateSignals: [
        {
          templateId,
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

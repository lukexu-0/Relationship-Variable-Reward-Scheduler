import crypto from "node:crypto";

import type { Job, Queue } from "bullmq";
import type { SentimentLevel } from "@reward/shared-types";
import { pino } from "pino";

import { ProfileModel } from "../models/profile.model.js";
import { RewardEventModel } from "../models/reward-event.model.js";
import { RewardEventConfigModel } from "../models/reward-event-config.model.js";
import { ScheduleSettingsModel } from "../models/schedule-settings.model.js";
import { recommendNextSchedule } from "../services/scheduler-client.js";

const logger = pino({ name: "schedule-generation-worker" });

interface ScheduleJobData {
  profileId?: string;
}

export async function processScheduleGeneration(
  job: Job<ScheduleJobData>,
  emailReminderQueue: Queue<{ eventId: string; reminderAt: string }>
): Promise<void> {
  if (!job.data.profileId) {
    const profiles = await ProfileModel.find({ active: true }).lean();
    for (const profile of profiles) {
      await scheduleProfile(profile._id.toString(), emailReminderQueue);
    }

    return;
  }

  await scheduleProfile(job.data.profileId, emailReminderQueue);
}

async function scheduleProfile(
  profileId: string,
  emailReminderQueue: Queue<{ eventId: string; reminderAt: string }>
): Promise<void> {
  const profile = await ProfileModel.findById(profileId);
  if (!profile || !profile.active) {
    return;
  }

  const settings = await ScheduleSettingsModel.findOne({ profileId: profile.id });
  if (!settings) {
    logger.warn({ profileId: profile.id }, "Missing schedule settings");
    return;
  }

  const eventConfigs = await RewardEventConfigModel.find({ profileId: profile.id, enabled: true })
    .sort({ createdAt: -1 })
    .lean();

  for (const eventConfig of eventConfigs) {
    const existingUpcoming = await RewardEventModel.findOne({
      profileId: profile.id,
      $or: [{ eventConfigId: eventConfig._id }, { templateId: eventConfig._id }],
      status: { $in: ["SCHEDULED", "RESCHEDULED"] },
      scheduledAt: { $gt: new Date() }
    });

    if (existingUpcoming) {
      continue;
    }

    const historyDocs = await RewardEventModel.find({
      profileId: profile.id,
      $or: [{ eventConfigId: eventConfig._id }, { templateId: eventConfig._id }]
    })
      .sort({ scheduledAt: -1 })
      .limit(60)
      .lean();

    let recommendation: { scheduledAt: string; rationale: string };
    try {
      recommendation = await recommendNextSchedule({
        seed: deterministicSeed(`${profile.id}:${eventConfig._id.toString()}`),
        now: new Date().toISOString(),
        eventConfig: {
          id: eventConfig._id.toString(),
          name: eventConfig.name,
          baseIntervalDays: eventConfig.baseIntervalDays,
          jitterPct: eventConfig.jitterPct
        },
        settings: {
          timezone: settings.timezone,
          minGapHours: settings.minGapHours,
          allowedWindows: settings.allowedWindows.map((window) => ({
            weekday: window.weekday,
            startLocalTime: window.startLocalTime,
            endLocalTime: window.endLocalTime
          })),
          recurringBlackoutWeekdays: settings.recurringBlackoutWeekdays ?? [],
          blackoutDates: settings.blackoutDates.map((blackout) => ({
            startAt: blackout.startAt.toISOString(),
            endAt: blackout.endAt?.toISOString(),
            allDay: blackout.allDay,
            note: blackout.note ?? undefined
          }))
        },
        eventHistory: historyDocs.map((doc) => ({
          scheduledAt: doc.scheduledAt.toISOString(),
          status: doc.status,
          completedAt: doc.completedAt?.toISOString(),
          missedAt: doc.missedAt?.toISOString(),
          sentimentLevel: (doc.sentimentLevel as SentimentLevel | null) ?? undefined
        }))
      });
    } catch (error) {
      logger.warn(
        { profileId: profile.id, eventConfigId: eventConfig._id.toString(), error },
        "Failed to compute next schedule for event config"
      );
      continue;
    }

    const event = await RewardEventModel.create({
      profileId: profile.id,
      eventConfigId: eventConfig._id,
      templateId: eventConfig._id,
      scheduledAt: new Date(recommendation.scheduledAt),
      originalScheduledAt: new Date(recommendation.scheduledAt),
      hasExplicitTime: false,
      status: "SCHEDULED",
      adjustments: []
    });

    const reminderAt = new Date(event.scheduledAt.getTime() - settings.reminderLeadHours * 60 * 60 * 1000);
    const delay = Math.max(reminderAt.getTime() - Date.now(), 0);

    await emailReminderQueue.add(
      "send-reminder",
      { eventId: event.id, reminderAt: reminderAt.toISOString() },
      {
        jobId: `${event.id}:${reminderAt.toISOString()}`,
        delay,
        removeOnComplete: true,
        removeOnFail: false
      }
    );
  }
}

function deterministicSeed(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

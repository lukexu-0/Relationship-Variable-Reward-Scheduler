import crypto from "node:crypto";

import type { Job, Queue } from "bullmq";
import type { SentimentLevel } from "@reward/shared-types";
import { pino } from "pino";

import { ProfileModel } from "../models/profile.model.js";
import { RewardEventModel } from "../models/reward-event.model.js";
import { RewardTemplateModel } from "../models/reward-template.model.js";
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

  const templates = await RewardTemplateModel.find({ profileId: profile.id, enabled: true })
    .sort({ createdAt: -1 })
    .lean();
  const templatesByCategory = new Map<string, (typeof templates)[number]>();
  for (const template of templates) {
    if (!templatesByCategory.has(template.category)) {
      templatesByCategory.set(template.category, template);
    }
  }

  for (const [category, template] of templatesByCategory.entries()) {
    const categoryTemplateIds = templates
      .filter((candidate) => candidate.category === category)
      .map((candidate) => candidate._id);
    const existingUpcoming = await RewardEventModel.findOne({
      profileId: profile.id,
      templateId: { $in: categoryTemplateIds },
      status: { $in: ["SCHEDULED", "RESCHEDULED"] },
      scheduledAt: { $gt: new Date() }
    });

    if (existingUpcoming) {
      continue;
    }

    const historyDocs = await RewardEventModel.find({
      profileId: profile.id,
      templateId: template._id
    })
      .sort({ scheduledAt: -1 })
      .limit(60)
      .lean();

    const recommendation = await recommendNextSchedule({
      seed: deterministicSeed(`${profile.id}:${template._id.toString()}`),
      now: new Date().toISOString(),
      template: {
        id: template._id.toString(),
        name: template.name,
        baseIntervalDays: template.baseIntervalDays,
        jitterPct: template.jitterPct
      },
      settings: {
        timezone: settings.timezone,
        minGapHours: settings.minGapHours,
        allowedWindows: settings.allowedWindows.map((window) => ({
          weekday: window.weekday,
          startLocalTime: window.startLocalTime,
          endLocalTime: window.endLocalTime
        })),
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

    const event = await RewardEventModel.create({
      profileId: profile.id,
      templateId: template._id,
      scheduledAt: new Date(recommendation.scheduledAt),
      originalScheduledAt: new Date(recommendation.scheduledAt),
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

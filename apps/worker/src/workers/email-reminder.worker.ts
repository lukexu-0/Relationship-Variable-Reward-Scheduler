import type { Job } from "bullmq";
import { pino } from "pino";

import { sendReminderEmail } from "../services/email-sender.js";
import { EmailLogModel } from "../models/email-log.model.js";
import { IdempotencyKeyModel } from "../models/idempotency-key.model.js";
import { ProfileModel } from "../models/profile.model.js";
import { RewardEventModel } from "../models/reward-event.model.js";
import { RewardTemplateModel } from "../models/reward-template.model.js";
import { UserModel } from "../models/user.model.js";

const logger = pino({ name: "email-reminder-worker" });

interface EmailReminderJobData {
  eventId: string;
  reminderAt: string;
}

export async function processEmailReminder(job: Job<EmailReminderJobData>): Promise<void> {
  const { eventId, reminderAt } = job.data;
  const idempotencyKey = `${eventId}:${reminderAt}`;

  const existingKey = await IdempotencyKeyModel.findOne({ key: idempotencyKey });
  if (existingKey) {
    logger.info({ eventId, reminderAt }, "Skipping duplicate reminder send");
    return;
  }

  const event = await RewardEventModel.findById(eventId);
  if (!event || (event.status !== "SCHEDULED" && event.status !== "RESCHEDULED")) {
    logger.warn({ eventId }, "Event no longer eligible for reminder");
    return;
  }

  const profile = await ProfileModel.findById(event.profileId);
  const template = await RewardTemplateModel.findById(event.templateId);
  if (!profile || !template) {
    logger.warn({ eventId }, "Profile or template not found for reminder");
    return;
  }

  const user = await UserModel.findById(profile.userId);
  if (!user || !user.reminderPreferences.emailEnabled) {
    logger.info({ eventId }, "User disabled reminder emails");
    return;
  }

  const messageId = await sendReminderEmail({
    recipient: user.email,
    profileName: profile.profileName,
    templateName: template.name,
    scheduledAt: event.scheduledAt.toISOString(),
    timezone: user.timezone
  });

  await IdempotencyKeyModel.create({
    key: idempotencyKey,
    kind: "email-reminder",
    metadata: { eventId, reminderAt }
  });

  await EmailLogModel.create({
    eventId,
    recipient: user.email,
    template: template.name,
    status: "SENT",
    providerMessageId: messageId,
    sentAt: new Date()
  });
}

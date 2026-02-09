import { Queue } from "bullmq";
import { Redis } from "ioredis";

import { config } from "../config.js";

let connection: Redis | null = null;
let queue: Queue | null = null;

function getReminderQueue(): Queue {
  if (!connection) {
    connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  }
  if (!queue) {
    queue = new Queue("email-reminders", { connection });
  }

  return queue;
}

export async function queueReminder(
  eventId: string,
  scheduledAt: Date,
  reminderLeadHours: number
): Promise<void> {
  const reminderQueue = getReminderQueue();
  const reminderAt = new Date(scheduledAt.getTime() - reminderLeadHours * 60 * 60 * 1000);
  const delay = Math.max(reminderAt.getTime() - Date.now(), 0);
  const jobId = `${eventId}:${reminderAt.toISOString()}`;

  await reminderQueue.add(
    "send-reminder",
    {
      eventId,
      reminderAt: reminderAt.toISOString()
    },
    {
      jobId,
      delay,
      removeOnComplete: true,
      removeOnFail: false
    }
  );
}

export async function removeReminderJobsForEvent(eventId: string): Promise<void> {
  const reminderQueue = getReminderQueue();
  const jobs = await reminderQueue.getJobs(["delayed", "waiting", "active", "failed"], 0, 1000);
  await Promise.all(
    jobs
      .filter((job) => (job.data as { eventId?: string }).eventId === eventId)
      .map(async (job) => {
        try {
          await job.remove();
        } catch {
          return;
        }
      })
  );
}

export async function closeReminderQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}

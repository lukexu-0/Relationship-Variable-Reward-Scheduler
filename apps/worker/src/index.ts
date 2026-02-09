import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { pino } from "pino";

import { config } from "./config.js";
import { connectDatabase } from "./db/connect.js";
import { processEmailReminder } from "./workers/email-reminder.worker.js";
import { processEventFollowup } from "./workers/event-followups.worker.js";
import { processScheduleGeneration } from "./workers/schedule-generation.worker.js";

const logger = pino({ name: "reward-worker" });

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

async function main(): Promise<void> {
  await connectDatabase();

  const scheduleQueue = new Queue<{ profileId?: string }>("schedule-generation", { connection });
  const emailReminderQueue = new Queue<{ eventId: string; reminderAt: string }>("email-reminders", {
    connection
  });
  const followupQueue = new Queue<{ eventId: string; reason: string }>("event-followups", {
    connection
  });

  const scheduleWorker = new Worker(
    "schedule-generation",
    async (job) => processScheduleGeneration(job, emailReminderQueue),
    { connection, concurrency: Math.max(config.WORKER_CONCURRENCY, 1) }
  );

  const emailWorker = new Worker("email-reminders", processEmailReminder, {
    connection,
    concurrency: Math.max(config.WORKER_CONCURRENCY, 1)
  });

  const followupWorker = new Worker("event-followups", processEventFollowup, {
    connection,
    concurrency: Math.max(config.WORKER_CONCURRENCY, 1)
  });

  await scheduleQueue.add(
    "daily-profile-scan",
    {},
    {
      repeat: { pattern: "0 3 * * *" },
      jobId: "daily-profile-scan"
    }
  );

  logger.info("Worker started");

  const shutdown = async () => {
    logger.info("Shutting down worker");
    await scheduleWorker.close();
    await emailWorker.close();
    await followupWorker.close();
    await scheduleQueue.close();
    await emailReminderQueue.close();
    await followupQueue.close();
    await connection.quit();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  logger.error({ error }, "Worker boot failed");
  process.exit(1);
});

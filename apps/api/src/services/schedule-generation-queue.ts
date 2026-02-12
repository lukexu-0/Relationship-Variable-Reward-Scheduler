import { Queue } from "bullmq";
import { Redis } from "ioredis";

import { config } from "../config.js";

let connection: Redis | null = null;
let queue: Queue<{ profileId?: string }> | null = null;

function getScheduleGenerationQueue(): Queue<{ profileId?: string }> {
  if (!connection) {
    connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
  }

  if (!queue) {
    queue = new Queue<{ profileId?: string }>("schedule-generation", { connection });
  }

  return queue;
}

export async function enqueueProfileScheduleGeneration(profileId: string): Promise<void> {
  const scheduleQueue = getScheduleGenerationQueue();
  await scheduleQueue.add(
    "profile-refresh",
    { profileId },
    {
      jobId: `profile-refresh:${profileId}`,
      removeOnComplete: true,
      removeOnFail: false
    }
  );
}

export async function closeScheduleGenerationQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}

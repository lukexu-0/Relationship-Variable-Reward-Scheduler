import type { Job } from "bullmq";
import { pino } from "pino";

const logger = pino({ name: "event-followups-worker" });

interface EventFollowupJobData {
  eventId: string;
  reason: string;
}

export async function processEventFollowup(job: Job<EventFollowupJobData>): Promise<void> {
  logger.info({ data: job.data }, "Event followup placeholder executed");
}

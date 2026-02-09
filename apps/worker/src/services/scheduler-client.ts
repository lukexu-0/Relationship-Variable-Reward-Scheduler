import type { SentimentLevel } from "@reward/shared-types";

import { config } from "../config.js";

interface SchedulerTemplatePayload {
  id: string;
  name: string;
  baseIntervalDays: number;
  jitterPct: number;
}

interface SchedulerSettingsPayload {
  timezone: string;
  minGapHours: number;
  allowedWindows: Array<{ weekday: number; startLocalTime: string; endLocalTime: string }>;
  blackoutDates: Array<{ startAt: string; endAt?: string; allDay?: boolean; note?: string }>;
}

interface SchedulerEventHistoryPayload {
  scheduledAt: string;
  status: string;
  completedAt?: string;
  missedAt?: string;
  sentimentLevel?: SentimentLevel;
}

interface RecommendNextRequest {
  seed: string;
  now: string;
  template: SchedulerTemplatePayload;
  settings: SchedulerSettingsPayload;
  eventHistory: SchedulerEventHistoryPayload[];
}

interface RecommendNextResponse {
  scheduledAt: string;
  rationale: string;
}

export async function recommendNextSchedule(
  payload: RecommendNextRequest
): Promise<RecommendNextResponse> {
  const response = await fetch(`${config.SCHEDULER_SERVICE_URL}/v1/scheduler/recommend-next`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Scheduler request failed with status ${response.status}`);
  }

  return (await response.json()) as RecommendNextResponse;
}

import type { MissedRescheduleOption, SentimentLevel } from "@reward/shared-types";

import { config } from "../config.js";
import { HttpError } from "../lib/http-error.js";

export interface SchedulerTemplatePayload {
  id: string;
  name: string;
  baseIntervalDays: number;
  jitterPct: number;
}

export interface SchedulerEventHistoryPayload {
  scheduledAt: string;
  status: string;
  completedAt?: string;
  missedAt?: string;
  sentimentLevel?: SentimentLevel;
}

export interface SchedulerSettingsPayload {
  timezone: string;
  minGapHours: number;
  allowedWindows: Array<{ weekday: number; startLocalTime: string; endLocalTime: string }>;
  blackoutDates: Array<{ startAt: string; endAt?: string; allDay?: boolean; note?: string }>;
}

export interface RecommendNextRequest {
  seed: string;
  now: string;
  template: SchedulerTemplatePayload;
  settings: SchedulerSettingsPayload;
  eventHistory: SchedulerEventHistoryPayload[];
}

export interface RecommendNextResponse {
  scheduledAt: string;
  rationale: string;
}

export interface MissedOptionsRequest {
  seed: string;
  now: string;
  eventId: string;
  currentScheduledAt: string;
  template: SchedulerTemplatePayload;
  settings: SchedulerSettingsPayload;
  eventHistory: SchedulerEventHistoryPayload[];
}

interface SchedulerRecomputeRequest {
  profileId: string;
  now: string;
  templateSignals: Array<{
    templateId: string;
    sentimentLevel?: SentimentLevel;
    status: string;
    completedAt?: string;
  }>;
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const response = await fetch(`${config.SCHEDULER_SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new HttpError(502, `Scheduler service error on ${path}`);
  }

  return (await response.json()) as TResponse;
}

export async function recommendNextSchedule(
  payload: RecommendNextRequest
): Promise<RecommendNextResponse> {
  return postJson<RecommendNextResponse>("/v1/scheduler/recommend-next", payload);
}

export async function getMissedOptions(payload: MissedOptionsRequest): Promise<MissedRescheduleOption[]> {
  const response = await postJson<{ options: MissedRescheduleOption[] }>(
    "/v1/scheduler/missed-options",
    payload
  );

  return response.options;
}

export async function recomputeSchedulerState(payload: SchedulerRecomputeRequest): Promise<void> {
  await postJson<{ ok: true }>("/v1/scheduler/recompute-state", payload);
}

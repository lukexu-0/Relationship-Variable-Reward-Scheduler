export type SentimentLevel =
  | "VERY_POOR"
  | "POOR"
  | "NEUTRAL"
  | "WELL"
  | "VERY_WELL";

export type EventStatus =
  | "SCHEDULED"
  | "COMPLETED"
  | "MISSED"
  | "RESCHEDULED"
  | "CANCELED";

export type MissedOptionType = "ASAP" | "DELAYED";

export interface DateWindow {
  weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startLocalTime: string;
  endLocalTime: string;
}

export interface BlackoutDate {
  startAt: string;
  endAt?: string;
  allDay?: boolean;
  note?: string;
}

export interface EventAdjustment {
  fromAt: string;
  toAt: string;
  reason: string;
  adjustedByUserId: string;
  adjustedAt: string;
}

export interface MissedRescheduleOption {
  optionId: string;
  profileId: string;
  eventId: string;
  type: MissedOptionType;
  proposedAt: string;
  rationale: string;
  recommended: boolean;
}

export interface RewardTemplate {
  id: string;
  profileId: string;
  name: string;
  category: string;
  baseIntervalDays: number;
  jitterPct: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleSettings {
  id: string;
  profileId: string;
  timezone: string;
  reminderLeadHours: number;
  allowedWindows: DateWindow[];
  blackoutDates: BlackoutDate[];
  minGapHours: number;
  createdAt: string;
  updatedAt: string;
}

export interface RewardEvent {
  id: string;
  profileId: string;
  templateId: string;
  scheduledAt: string;
  originalScheduledAt: string;
  status: EventStatus;
  completedAt?: string;
  missedAt?: string;
  sentimentLevel?: SentimentLevel;
  notes?: string;
  adjustments: EventAdjustment[];
  createdAt: string;
  updatedAt: string;
}

export interface SchedulerTemplateState {
  templateId: string;
  rollingSentimentScore: number;
  avgCompletionLagHours: number;
  lastScheduledAt?: string;
  lastCompletedAt?: string;
}

export interface SchedulerState {
  id: string;
  profileId: string;
  perTemplate: SchedulerTemplateState[];
  updatedAt: string;
}

export interface ReminderPreferences {
  emailEnabled: boolean;
  reminderLeadHours: number;
}

export interface UserAuthPayload {
  sub: string;
  email: string;
}

export interface QueueJobPayloadMap {
  "schedule-generation": { profileId: string };
  "email-reminders": { eventId: string; reminderAt: string };
  "event-followups": { eventId: string; reason: string };
}

export const DEFAULT_TEMPLATES = [
  {
    name: "flowers",
    category: "gift",
    baseIntervalDays: 14,
    jitterPct: 0.25
  },
  {
    name: "nice_date",
    category: "date",
    baseIntervalDays: 10,
    jitterPct: 0.2
  },
  {
    name: "activity",
    category: "activity",
    baseIntervalDays: 7,
    jitterPct: 0.2
  },
  {
    name: "thoughtful_message",
    category: "message",
    baseIntervalDays: 4,
    jitterPct: 0.15
  }
] as const;

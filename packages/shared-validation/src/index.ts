import { z } from "zod";

export const sentimentLevelSchema = z.enum([
  "VERY_POOR",
  "POOR",
  "NEUTRAL",
  "WELL",
  "VERY_WELL"
]);

export const eventStatusSchema = z.enum([
  "SCHEDULED",
  "COMPLETED",
  "MISSED",
  "RESCHEDULED",
  "CANCELED"
]);

export const dateWindowSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endLocalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
});

export const blackoutDateSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  note: z.string().max(300).optional()
});

export const scheduleSettingsInputSchema = z.object({
  timezone: z.string().min(2),
  reminderLeadHours: z.number().int().min(1).max(168),
  minGapHours: z.number().int().min(1).max(720),
  allowedWindows: z.array(dateWindowSchema).default([]),
  recurringBlackoutWeekdays: z.array(z.number().int().min(0).max(6)).default([]),
  blackoutDates: z.array(blackoutDateSchema).default([])
});

export const createEventConfigSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  baseIntervalDays: z.number().min(1).max(365),
  jitterPct: z.number().min(0).max(0.9),
  enabled: z.boolean().default(true)
});

export const updateEventConfigSchema = createEventConfigSchema.partial();

const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeOnlySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const createEventSchema = z.object({
  eventConfigId: z.string().min(1),
  scheduledDate: dateOnlySchema,
  scheduledTime: timeOnlySchema.optional(),
  notes: z.string().max(500).optional()
});

export const completeEventSchema = z.object({
  sentimentLevel: sentimentLevelSchema,
  notes: z.string().max(500).optional()
});

export const rescheduleEventSchema = z.object({
  scheduledDate: dateOnlySchema,
  scheduledTime: timeOnlySchema.optional(),
  reason: z.string().min(1).max(300)
});

export const updateEventSchema = z
  .object({
    scheduledDate: dateOnlySchema.optional(),
    scheduledTime: timeOnlySchema.optional(),
    notes: z.string().max(500).optional(),
    reason: z.string().min(1).max(300).optional()
  })
  .refine(
    (input) => {
      if ((input.scheduledDate || input.scheduledTime) && !input.reason) {
        return false;
      }

      return true;
    },
    {
      message: "reason is required when scheduled date/time is provided",
      path: ["reason"]
    }
  );

export const missEventSchema = z.object({
  reason: z.string().min(1).max(300).optional()
});

export const applyMissedOptionSchema = z.object({
  reason: z.string().min(1).max(300).optional()
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128),
  timezone: z.string().min(2)
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(10).max(128)
});

// Backward compatibility exports while code migrates from template wording.
export const createTemplateSchema = createEventConfigSchema;
export const updateTemplateSchema = updateEventConfigSchema;

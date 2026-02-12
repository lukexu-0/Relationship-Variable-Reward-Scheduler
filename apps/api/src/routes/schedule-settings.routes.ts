import { Router } from "express";
import { scheduleSettingsInputSchema } from "@reward/shared-validation";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { parseOrThrow } from "../lib/zod.js";
import { HttpError } from "../lib/http-error.js";
import { ScheduleSettingsModel } from "../models/schedule-settings.model.js";
import { getOwnedProfile } from "../services/profile-access.js";
import { enqueueProfileScheduleGeneration } from "../services/schedule-generation-queue.js";

export const scheduleSettingsRouter = Router();

scheduleSettingsRouter.use(requireAuth);

scheduleSettingsRouter.get(
  "/profiles/:profileId/schedule-settings",
  asyncHandler(async (req, res) => {
    const profileId = String(req.params.profileId);
    await getOwnedProfile(profileId, req.user!.id);
    const settings = await ScheduleSettingsModel.findOne({ profileId }).lean();
    res.json({ settings });
  })
);

scheduleSettingsRouter.put(
  "/profiles/:profileId/schedule-settings",
  asyncHandler(async (req, res) => {
    const profileId = String(req.params.profileId);
    await getOwnedProfile(profileId, req.user!.id);
    const input = parseOrThrow(scheduleSettingsInputSchema, req.body);
    assertSettingsSchedulable(input);

    const settings = await ScheduleSettingsModel.findOneAndUpdate(
      { profileId },
      {
        $set: {
          timezone: input.timezone,
          reminderLeadHours: input.reminderLeadHours,
          minGapHours: input.minGapHours,
          allowedWindows: input.allowedWindows,
          recurringBlackoutWeekdays: input.recurringBlackoutWeekdays,
          blackoutDates: input.blackoutDates
        }
      },
      { upsert: true, new: true }
    );

    await enqueueProfileScheduleGeneration(profileId).catch(() => undefined);

    res.json({ settings });
  })
);

function assertSettingsSchedulable(input: {
  allowedWindows: Array<{ weekday: number }>;
  recurringBlackoutWeekdays: number[];
}): void {
  const recurring = new Set(input.recurringBlackoutWeekdays);
  if (recurring.size === 7) {
    throw new HttpError(400, "Schedule settings block all weekdays");
  }

  if (input.allowedWindows.length === 0) {
    return;
  }

  const usableWindows = input.allowedWindows.some((window) => !recurring.has(window.weekday));
  if (!usableWindows) {
    throw new HttpError(400, "Allowed windows all fall on recurring blackout weekdays");
  }
}

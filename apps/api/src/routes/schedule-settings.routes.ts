import { Router } from "express";
import { scheduleSettingsInputSchema } from "@reward/shared-validation";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { parseOrThrow } from "../lib/zod.js";
import { ScheduleSettingsModel } from "../models/schedule-settings.model.js";
import { getOwnedProfile } from "../services/profile-access.js";

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

    const settings = await ScheduleSettingsModel.findOneAndUpdate(
      { profileId },
      {
        $set: {
          timezone: input.timezone,
          reminderLeadHours: input.reminderLeadHours,
          minGapHours: input.minGapHours,
          allowedWindows: input.allowedWindows,
          blackoutDates: input.blackoutDates
        }
      },
      { upsert: true, new: true }
    );

    res.json({ settings });
  })
);

import { Router } from "express";
import { z } from "zod";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { parseOrThrow } from "../lib/zod.js";
import { ProfileModel } from "../models/profile.model.js";
import { ScheduleSettingsModel } from "../models/schedule-settings.model.js";
import { seedDefaultEventConfigs } from "../services/default-template-seeder.js";
import { getOwnedProfile } from "../services/profile-access.js";
import { enqueueProfileScheduleGeneration } from "../services/schedule-generation-queue.js";

const createProfileSchema = z.object({
  profileName: z.string().min(1).max(120),
  partnerName: z.string().max(120).optional()
});

const updateProfileSchema = z.object({
  profileName: z.string().min(1).max(120).optional(),
  partnerName: z.string().max(120).optional(),
  active: z.boolean().optional()
});

export const profilesRouter = Router();

profilesRouter.use(requireAuth);

profilesRouter.get(
  "/profiles",
  asyncHandler(async (req, res) => {
    const profiles = await ProfileModel.find({ userId: req.user!.id }).sort({ createdAt: -1 }).lean();
    res.json({ profiles });
  })
);

profilesRouter.post(
  "/profiles",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(createProfileSchema, req.body);

    const profile = await ProfileModel.create({
      userId: req.user!.id,
      profileName: input.profileName,
      partnerName: input.partnerName,
      active: true
    });

    await seedDefaultEventConfigs(profile.id);

    await ScheduleSettingsModel.create({
      profileId: profile.id,
      timezone: req.user!.timezone,
      reminderLeadHours: req.user!.reminderPreferences.reminderLeadHours,
      minGapHours: 24,
      allowedWindows: [
        { weekday: 0, startLocalTime: "09:00", endLocalTime: "21:00" },
        { weekday: 1, startLocalTime: "09:00", endLocalTime: "21:00" },
        { weekday: 2, startLocalTime: "09:00", endLocalTime: "21:00" },
        { weekday: 3, startLocalTime: "09:00", endLocalTime: "21:00" },
        { weekday: 4, startLocalTime: "09:00", endLocalTime: "21:00" },
        { weekday: 5, startLocalTime: "09:00", endLocalTime: "21:00" },
        { weekday: 6, startLocalTime: "09:00", endLocalTime: "21:00" }
      ],
      recurringBlackoutWeekdays: [],
      blackoutDates: []
    });

    await enqueueProfileScheduleGeneration(profile.id).catch(() => undefined);

    res.status(201).json({ profile });
  })
);

profilesRouter.patch(
  "/profiles/:profileId",
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(updateProfileSchema, req.body);
    const profileId = String(req.params.profileId);
    const profile = await getOwnedProfile(profileId, req.user!.id);

    if (typeof input.profileName === "string") {
      profile.profileName = input.profileName;
    }
    if (typeof input.partnerName === "string") {
      profile.partnerName = input.partnerName;
    }
    if (typeof input.active === "boolean") {
      profile.active = input.active;
    }

    await profile.save();
    res.json({ profile });
  })
);

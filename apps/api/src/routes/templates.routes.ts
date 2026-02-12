import { Router } from "express";
import {
  createEventConfigSchema,
  updateEventConfigSchema
} from "@reward/shared-validation";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { parseOrThrow } from "../lib/zod.js";
import { HttpError } from "../lib/http-error.js";
import { RewardEventConfigModel } from "../models/reward-event-config.model.js";
import { RewardEventModel } from "../models/reward-event.model.js";
import { getOwnedProfile } from "../services/profile-access.js";
import { enqueueProfileScheduleGeneration } from "../services/schedule-generation-queue.js";

export const eventConfigsRouter = Router();
const EVENT_CONFIG_SLUG_CONFLICT_CODE = "EVENT_CONFIG_SLUG_EXISTS";

eventConfigsRouter.use(requireAuth);

eventConfigsRouter.get(
  "/profiles/:profileId/event-configs",
  asyncHandler(async (req, res) => {
    const profileId = String(req.params.profileId);
    await getOwnedProfile(profileId, req.user!.id);
    const eventConfigs = await RewardEventConfigModel.find({ profileId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ eventConfigs });
  })
);

eventConfigsRouter.post(
  "/profiles/:profileId/event-configs",
  asyncHandler(async (req, res) => {
    const profileId = String(req.params.profileId);
    await getOwnedProfile(profileId, req.user!.id);
    const input = parseOrThrow(createEventConfigSchema, req.body);
    const slug = normalizeSlug(input.slug);

    const existing = await RewardEventConfigModel.findOne({ profileId, slug }).lean();
    if (existing) {
      throw new HttpError(409, "An event config already exists for this slug", {
        code: EVENT_CONFIG_SLUG_CONFLICT_CODE,
        slug
      });
    }

    const eventConfig = await RewardEventConfigModel.create({
      profileId,
      name: input.name.trim(),
      slug,
      baseIntervalDays: input.baseIntervalDays,
      jitterPct: input.jitterPct,
      enabled: input.enabled
    });

    await enqueueProfileScheduleGeneration(profileId).catch(() => undefined);

    res.status(201).json({ eventConfig });
  })
);

eventConfigsRouter.patch(
  "/event-configs/:eventConfigId",
  asyncHandler(async (req, res) => {
    const eventConfigId = String(req.params.eventConfigId);
    const input = parseOrThrow(updateEventConfigSchema, req.body);
    const eventConfig = await RewardEventConfigModel.findById(eventConfigId);
    if (!eventConfig) {
      throw new HttpError(404, "Event config not found");
    }

    await getOwnedProfile(eventConfig.profileId.toString(), req.user!.id);

    const candidateSlug =
      input.slug !== undefined
        ? normalizeSlug(input.slug)
        : input.name !== undefined
          ? normalizeSlug(input.name)
          : undefined;

    if (candidateSlug !== undefined) {
      const existing = await RewardEventConfigModel.findOne({
        _id: { $ne: eventConfig._id },
        profileId: eventConfig.profileId,
        slug: candidateSlug
      }).lean();
      if (existing) {
        throw new HttpError(409, "An event config already exists for this slug", {
          code: EVENT_CONFIG_SLUG_CONFLICT_CODE,
          slug: candidateSlug
        });
      }

      eventConfig.slug = candidateSlug;
    }

    if (input.name !== undefined) {
      eventConfig.name = input.name.trim();
    }
    if (input.baseIntervalDays !== undefined) {
      eventConfig.baseIntervalDays = input.baseIntervalDays;
    }
    if (input.jitterPct !== undefined) {
      eventConfig.jitterPct = input.jitterPct;
    }
    if (input.enabled !== undefined) {
      eventConfig.enabled = input.enabled;
    }

    await eventConfig.save();

    await enqueueProfileScheduleGeneration(eventConfig.profileId.toString()).catch(() => undefined);

    res.json({ eventConfig });
  })
);

eventConfigsRouter.delete(
  "/event-configs/:eventConfigId",
  asyncHandler(async (req, res) => {
    const eventConfigId = String(req.params.eventConfigId);
    const eventConfig = await RewardEventConfigModel.findById(eventConfigId);
    if (!eventConfig) {
      throw new HttpError(404, "Event config not found");
    }

    await getOwnedProfile(eventConfig.profileId.toString(), req.user!.id);

    await RewardEventModel.deleteMany({
      $or: [{ eventConfigId: eventConfig._id }, { templateId: eventConfig._id }]
    });
    await eventConfig.deleteOne();

    await enqueueProfileScheduleGeneration(eventConfig.profileId.toString()).catch(() => undefined);

    res.status(204).send();
  })
);

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

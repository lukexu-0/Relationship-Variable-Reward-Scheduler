import { Router } from "express";
import { createTemplateSchema, updateTemplateSchema } from "@reward/shared-validation";

import { asyncHandler } from "../middleware/async-handler.js";
import { requireAuth } from "../middleware/auth.js";
import { parseOrThrow } from "../lib/zod.js";
import { HttpError } from "../lib/http-error.js";
import { RewardTemplateModel } from "../models/reward-template.model.js";
import { getOwnedProfile } from "../services/profile-access.js";

export const templatesRouter = Router();
const TEMPLATE_CATEGORY_CONFLICT_CODE = "TEMPLATE_CATEGORY_EXISTS";

templatesRouter.use(requireAuth);

templatesRouter.get(
  "/profiles/:profileId/templates",
  asyncHandler(async (req, res) => {
    const profileId = String(req.params.profileId);
    await getOwnedProfile(profileId, req.user!.id);
    const templates = await RewardTemplateModel.find({ profileId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ templates });
  })
);

templatesRouter.post(
  "/profiles/:profileId/templates",
  asyncHandler(async (req, res) => {
    const profileId = String(req.params.profileId);
    await getOwnedProfile(profileId, req.user!.id);
    const input = parseOrThrow(createTemplateSchema, req.body);
    const category = normalizeCategory(input.category);

    const existing = await RewardTemplateModel.findOne({ profileId, category }).lean();
    if (existing) {
      throw new HttpError(409, "A template already exists for this category", {
        code: TEMPLATE_CATEGORY_CONFLICT_CODE,
        category
      });
    }

    const template = await RewardTemplateModel.create({
      profileId,
      ...input,
      category
    });

    res.status(201).json({ template });
  })
);

templatesRouter.patch(
  "/templates/:templateId",
  asyncHandler(async (req, res) => {
    const templateId = String(req.params.templateId);
    const input = parseOrThrow(updateTemplateSchema, req.body);
    const template = await RewardTemplateModel.findById(templateId);
    if (!template) {
      throw new HttpError(404, "Template not found");
    }

    await getOwnedProfile(template.profileId.toString(), req.user!.id);

    if (input.category !== undefined) {
      const category = normalizeCategory(input.category);
      const existing = await RewardTemplateModel.findOne({
        _id: { $ne: template._id },
        profileId: template.profileId,
        category
      }).lean();
      if (existing) {
        throw new HttpError(409, "A template already exists for this category", {
          code: TEMPLATE_CATEGORY_CONFLICT_CODE,
          category
        });
      }
      input.category = category;
    }

    Object.assign(template, input);
    await template.save();

    res.json({ template });
  })
);

function normalizeCategory(value: string): string {
  return value.trim().toLowerCase();
}

import { Types } from "mongoose";

import { HttpError } from "../lib/http-error.js";
import { RewardEventModel } from "../models/reward-event.model.js";
import { RewardTemplateModel } from "../models/reward-template.model.js";

export const ACTIVE_UPCOMING_STATUSES = ["SCHEDULED", "RESCHEDULED"] as const;
export const CATEGORY_UPCOMING_CONFLICT_CODE = "CATEGORY_UPCOMING_EXISTS";

interface AssertCategoryUpcomingUniqueParams {
  profileId: string;
  category: string;
  scheduledAt: Date;
  status: string;
  excludeEventId?: string;
}

export async function getCategoryFromTemplateId(templateId: string): Promise<string> {
  const template = await RewardTemplateModel.findById(templateId).lean();
  if (!template) {
    throw new HttpError(404, "Template not found");
  }

  return template.category;
}

export async function assertCategoryUpcomingUnique(
  params: AssertCategoryUpcomingUniqueParams
): Promise<void> {
  if (!isActiveUpcoming(params.status, params.scheduledAt)) {
    return;
  }

  const templates = await RewardTemplateModel.find({
    profileId: params.profileId,
    category: params.category
  })
    .select({ _id: 1 })
    .lean();

  const templateIds = templates.map((template) => template._id);
  if (templateIds.length === 0) {
    return;
  }

  const query: Record<string, unknown> = {
    profileId: new Types.ObjectId(params.profileId),
    templateId: { $in: templateIds },
    status: { $in: ACTIVE_UPCOMING_STATUSES },
    scheduledAt: { $gt: new Date() }
  };

  if (params.excludeEventId) {
    query._id = { $ne: new Types.ObjectId(params.excludeEventId) };
  }

  const conflict = await RewardEventModel.findOne(query).sort({ scheduledAt: 1 }).lean();
  if (!conflict) {
    return;
  }

  throw new HttpError(409, "Active upcoming event already exists for this category", {
    code: CATEGORY_UPCOMING_CONFLICT_CODE,
    category: params.category,
    existingEventId: conflict._id.toString()
  });
}

function isActiveUpcoming(status: string, scheduledAt: Date): boolean {
  return ACTIVE_UPCOMING_STATUSES.includes(status as (typeof ACTIVE_UPCOMING_STATUSES)[number]) &&
    scheduledAt.getTime() > Date.now();
}

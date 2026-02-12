import { Types } from "mongoose";

import { HttpError } from "../lib/http-error.js";
import { RewardEventModel } from "../models/reward-event.model.js";

export const ACTIVE_UPCOMING_STATUSES = ["SCHEDULED", "RESCHEDULED"] as const;
export const EVENT_CONFIG_UPCOMING_CONFLICT_CODE = "EVENT_CONFIG_UPCOMING_EXISTS";

interface AssertEventConfigUpcomingUniqueParams {
  profileId: string;
  eventConfigId: string;
  scheduledAt: Date;
  status: string;
  excludeEventId?: string;
}

export async function assertEventConfigUpcomingUnique(
  params: AssertEventConfigUpcomingUniqueParams
): Promise<void> {
  if (!isActiveUpcoming(params.status, params.scheduledAt)) {
    return;
  }

  const query: Record<string, unknown> = {
    profileId: new Types.ObjectId(params.profileId),
    $or: [
      { eventConfigId: new Types.ObjectId(params.eventConfigId) },
      // Compatibility for pre-migration docs.
      { templateId: new Types.ObjectId(params.eventConfigId) }
    ],
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

  throw new HttpError(409, "Active upcoming event already exists for this event config", {
    code: EVENT_CONFIG_UPCOMING_CONFLICT_CODE,
    eventConfigId: params.eventConfigId,
    existingEventId: conflict._id.toString()
  });
}

function isActiveUpcoming(status: string, scheduledAt: Date): boolean {
  return (
    ACTIVE_UPCOMING_STATUSES.includes(status as (typeof ACTIVE_UPCOMING_STATUSES)[number]) &&
    scheduledAt.getTime() > Date.now()
  );
}

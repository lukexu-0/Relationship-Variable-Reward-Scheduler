import { DEFAULT_EVENT_CONFIGS } from "@reward/shared-types";

import { RewardEventConfigModel } from "../models/reward-event-config.model.js";

export async function seedDefaultEventConfigs(profileId: string): Promise<void> {
  const docs = DEFAULT_EVENT_CONFIGS.map((eventConfig) => ({
    profileId,
    name: eventConfig.name,
    slug: eventConfig.slug,
    baseIntervalDays: eventConfig.baseIntervalDays,
    jitterPct: eventConfig.jitterPct,
    enabled: true
  }));

  await RewardEventConfigModel.insertMany(docs, { ordered: false }).catch(() => undefined);
}

// Backward compatibility export name while imports are migrated.
export const seedDefaultTemplates = seedDefaultEventConfigs;

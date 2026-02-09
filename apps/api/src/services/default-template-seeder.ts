import { DEFAULT_TEMPLATES } from "@reward/shared-types";

import { RewardTemplateModel } from "../models/reward-template.model.js";

export async function seedDefaultTemplates(profileId: string): Promise<void> {
  const docs = DEFAULT_TEMPLATES.map((template) => ({
    profileId,
    name: template.name,
    category: template.category,
    baseIntervalDays: template.baseIntervalDays,
    jitterPct: template.jitterPct,
    enabled: true
  }));

  await RewardTemplateModel.insertMany(docs, { ordered: false }).catch(() => undefined);
}

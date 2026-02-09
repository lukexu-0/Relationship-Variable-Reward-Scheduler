import dotenv from "dotenv";
import mongoose from "mongoose";

import { RewardEventModel } from "../../apps/api/src/models/reward-event.model.js";
import { RewardTemplateModel } from "../../apps/api/src/models/reward-template.model.js";

dotenv.config();

interface Counters {
  templatesDeleted: number;
  eventsReassigned: number;
  eventsDeleted: number;
  groupsProcessed: number;
}

async function run(): Promise<void> {
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(mongodbUri);
  const counters: Counters = {
    templatesDeleted: 0,
    eventsReassigned: 0,
    eventsDeleted: 0,
    groupsProcessed: 0
  };

  await dedupeTemplatesByCategory(counters);
  await dedupeUpcomingEventsByCategory(counters);

  console.log("normalize-category-sets complete", counters);
}

async function dedupeTemplatesByCategory(counters: Counters): Promise<void> {
  const templates = await RewardTemplateModel.find()
    .sort({ createdAt: -1 })
    .lean();

  const grouped = new Map<string, Array<(typeof templates)[number]>>();
  for (const template of templates) {
    const key = `${template.profileId.toString()}:${normalizeCategory(template.category)}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(template);
  }

  for (const templatesInGroup of grouped.values()) {
    if (templatesInGroup.length <= 1) {
      continue;
    }

    counters.groupsProcessed += 1;
    const [keep, ...duplicates] = templatesInGroup;
    for (const duplicate of duplicates) {
      const reassigned = await RewardEventModel.updateMany(
        { templateId: duplicate._id },
        { $set: { templateId: keep._id } }
      );
      counters.eventsReassigned += reassigned.modifiedCount;

      await RewardTemplateModel.deleteOne({ _id: duplicate._id });
      counters.templatesDeleted += 1;
    }
  }
}

async function dedupeUpcomingEventsByCategory(counters: Counters): Promise<void> {
  const templates = await RewardTemplateModel.find().lean();
  const categoryToTemplateIds = new Map<string, string[]>();

  for (const template of templates) {
    const key = `${template.profileId.toString()}:${normalizeCategory(template.category)}`;
    if (!categoryToTemplateIds.has(key)) {
      categoryToTemplateIds.set(key, []);
    }
    categoryToTemplateIds.get(key)!.push(template._id.toString());
  }

  for (const templateIds of categoryToTemplateIds.values()) {
    const upcoming = await RewardEventModel.find({
      templateId: { $in: templateIds },
      status: { $in: ["SCHEDULED", "RESCHEDULED"] },
      scheduledAt: { $gt: new Date() }
    })
      .sort({ scheduledAt: 1 })
      .select({ _id: 1 })
      .lean();

    if (upcoming.length <= 1) {
      continue;
    }

    const [, ...duplicates] = upcoming;
    const duplicateIds = duplicates.map((event) => event._id);
    const deleted = await RewardEventModel.deleteMany({ _id: { $in: duplicateIds } });
    counters.eventsDeleted += deleted.deletedCount ?? 0;
  }
}

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase();
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

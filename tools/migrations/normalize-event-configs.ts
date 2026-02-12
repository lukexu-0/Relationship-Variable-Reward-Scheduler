import dotenv from "dotenv";
import mongoose from "mongoose";

import { RewardEventConfigModel } from "../../apps/api/src/models/reward-event-config.model.js";
import { RewardEventModel } from "../../apps/api/src/models/reward-event.model.js";
import { ScheduleSettingsModel } from "../../apps/api/src/models/schedule-settings.model.js";

dotenv.config();

interface Counters {
  eventConfigsUpdated: number;
  eventConfigsDeleted: number;
  eventsReassigned: number;
  eventsDeleted: number;
  eventsBackfilled: number;
  settingsBackfilled: number;
}

const DEFAULT_EVENT_CONFIG_NAME_BY_SLUG: Record<string, string> = {
  flowers: "Flowers",
  "date-night": "Date Night",
  "nice-date": "Date Night",
  "shared-activity": "Shared Activity",
  activity: "Shared Activity",
  "thoughtful-message": "Thoughtful Message"
};

async function run(): Promise<void> {
  const mongodbUri = process.env.MONGODB_URI;
  if (!mongodbUri) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(mongodbUri);
  const counters: Counters = {
    eventConfigsUpdated: 0,
    eventConfigsDeleted: 0,
    eventsReassigned: 0,
    eventsDeleted: 0,
    eventsBackfilled: 0,
    settingsBackfilled: 0
  };

  await backfillEventConfigSlugs(counters);
  await dedupeEventConfigsBySlug(counters);
  await backfillEventConfigIdOnEvents(counters);
  await dedupeUpcomingEventsPerConfig(counters);
  await backfillHasExplicitTime(counters);
  await backfillRecurringBlackoutWeekdays(counters);

  console.log("normalize-event-configs complete", counters);
}

async function backfillEventConfigSlugs(counters: Counters): Promise<void> {
  const configs = await RewardEventConfigModel.find().lean();
  for (const config of configs) {
    const nextSlug = normalizeSlug(config.slug || config.name);
    const nextName = DEFAULT_EVENT_CONFIG_NAME_BY_SLUG[nextSlug] ?? config.name.trim();
    if (config.slug === nextSlug && config.name === nextName) {
      continue;
    }

    await RewardEventConfigModel.updateOne({ _id: config._id }, { $set: { slug: nextSlug, name: nextName } });
    counters.eventConfigsUpdated += 1;
  }
}

async function dedupeEventConfigsBySlug(counters: Counters): Promise<void> {
  const configs = await RewardEventConfigModel.find().sort({ createdAt: -1 }).lean();
  const grouped = new Map<string, Array<(typeof configs)[number]>>();

  for (const config of configs) {
    const key = `${config.profileId.toString()}:${normalizeSlug(config.slug || config.name)}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(config);
  }

  for (const configsInGroup of grouped.values()) {
    if (configsInGroup.length <= 1) {
      continue;
    }

    const [keep, ...duplicates] = configsInGroup;
    for (const duplicate of duplicates) {
      const reassigned = await RewardEventModel.updateMany(
        { $or: [{ eventConfigId: duplicate._id }, { templateId: duplicate._id }] },
        { $set: { eventConfigId: keep._id, templateId: keep._id } }
      );
      counters.eventsReassigned += reassigned.modifiedCount;

      await RewardEventConfigModel.deleteOne({ _id: duplicate._id });
      counters.eventConfigsDeleted += 1;
    }
  }
}

async function backfillEventConfigIdOnEvents(counters: Counters): Promise<void> {
  const events = await RewardEventModel.find({
    $or: [{ eventConfigId: { $exists: false } }, { eventConfigId: null }],
    templateId: { $exists: true, $ne: null }
  })
    .select({ _id: 1, templateId: 1 })
    .lean();

  for (const event of events) {
    await RewardEventModel.updateOne(
      { _id: event._id },
      { $set: { eventConfigId: event.templateId } }
    );
    counters.eventsBackfilled += 1;
  }
}

async function dedupeUpcomingEventsPerConfig(counters: Counters): Promise<void> {
  const configs = await RewardEventConfigModel.find().select({ _id: 1 }).lean();
  for (const config of configs) {
    const upcoming = await RewardEventModel.find({
      $or: [{ eventConfigId: config._id }, { templateId: config._id }],
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
    const deleted = await RewardEventModel.deleteMany({
      _id: { $in: duplicates.map((event) => event._id) }
    });
    counters.eventsDeleted += deleted.deletedCount ?? 0;
  }
}

async function backfillHasExplicitTime(counters: Counters): Promise<void> {
  const result = await RewardEventModel.updateMany(
    { hasExplicitTime: { $exists: false } },
    { $set: { hasExplicitTime: false } }
  );
  counters.eventsBackfilled += result.modifiedCount;
}

async function backfillRecurringBlackoutWeekdays(counters: Counters): Promise<void> {
  const result = await ScheduleSettingsModel.updateMany(
    { recurringBlackoutWeekdays: { $exists: false } },
    { $set: { recurringBlackoutWeekdays: [] } }
  );
  counters.settingsBackfilled += result.modifiedCount;
}

function normalizeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

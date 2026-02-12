import { DEFAULT_EVENT_CONFIGS } from "@reward/shared-types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { insertManyMock } = vi.hoisted(() => ({
  insertManyMock: vi.fn()
}));

vi.mock("../models/reward-event-config.model.js", () => ({
  RewardEventConfigModel: {
    insertMany: insertManyMock
  }
}));

import {
  seedDefaultEventConfigs,
  seedDefaultTemplates
} from "./default-template-seeder.js";

describe("default-template-seeder", () => {
  beforeEach(() => {
    insertManyMock.mockReset();
  });

  it("inserts the default event configs for a profile", async () => {
    insertManyMock.mockResolvedValue([]);

    await seedDefaultEventConfigs("profile-1");

    expect(insertManyMock).toHaveBeenCalledTimes(1);
    expect(insertManyMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          profileId: "profile-1",
          name: DEFAULT_EVENT_CONFIGS[0].name,
          slug: DEFAULT_EVENT_CONFIGS[0].slug,
          enabled: true
        })
      ]),
      { ordered: false }
    );
    const docs = insertManyMock.mock.calls[0]?.[0] as Array<{ profileId: string }>;
    expect(docs).toHaveLength(DEFAULT_EVENT_CONFIGS.length);
  });

  it("swallows insertMany errors and keeps profile creation flow resilient", async () => {
    insertManyMock.mockRejectedValue(new Error("duplicate"));

    await expect(seedDefaultTemplates("profile-2")).resolves.toBeUndefined();
  });
});

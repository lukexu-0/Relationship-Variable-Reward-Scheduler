import type { Job } from "bullmq";
import { describe, expect, it } from "vitest";

import { processEventFollowup } from "./event-followups.worker.js";

describe("event-followups worker", () => {
  it("handles followup job payloads without throwing", async () => {
    await expect(
      processEventFollowup(
        {
          data: { eventId: "event-1", reason: "test" }
        } as Job<{ eventId: string; reason: string }>
      )
    ).resolves.toBeUndefined();
  });
});

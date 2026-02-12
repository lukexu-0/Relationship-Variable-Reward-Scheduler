import { beforeEach, describe, expect, it, vi } from "vitest";

import { recommendNextSchedule } from "./scheduler-client.js";

describe("scheduler-client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("posts to scheduler service and returns recommendation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        scheduledAt: "2026-02-10T20:00:00.000Z",
        rationale: "ok"
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const payload = {
      seed: "seed",
      now: "2026-02-01T12:00:00.000Z",
      eventConfig: { id: "t1", name: "flowers", baseIntervalDays: 7, jitterPct: 0.2 },
      settings: {
        timezone: "UTC",
        minGapHours: 24,
        allowedWindows: [],
        recurringBlackoutWeekdays: [],
        blackoutDates: []
      },
      eventHistory: []
    };

    const result = await recommendNextSchedule(payload);
    expect(result.scheduledAt).toBe("2026-02-10T20:00:00.000Z");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "http://scheduler.mock/v1/scheduler/recommend-next"
    );
  });

  it("throws when scheduler service returns non-ok response", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      recommendNextSchedule({
        seed: "seed",
        now: "2026-02-01T12:00:00.000Z",
        eventConfig: { id: "t1", name: "flowers", baseIntervalDays: 7, jitterPct: 0.2 },
        settings: {
          timezone: "UTC",
          minGapHours: 24,
          allowedWindows: [],
          recurringBlackoutWeekdays: [],
          blackoutDates: []
        },
        eventHistory: []
      })
    ).rejects.toThrow("Scheduler request failed with status 500");
  });
});

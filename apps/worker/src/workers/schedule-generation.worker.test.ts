import type { Job, Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  profileFindMock,
  profileFindByIdMock,
  settingsFindOneMock,
  templateFindMock,
  eventFindOneMock,
  eventFindMock,
  eventCreateMock,
  recommendNextScheduleMock
} = vi.hoisted(() => ({
  profileFindMock: vi.fn(),
  profileFindByIdMock: vi.fn(),
  settingsFindOneMock: vi.fn(),
  templateFindMock: vi.fn(),
  eventFindOneMock: vi.fn(),
  eventFindMock: vi.fn(),
  eventCreateMock: vi.fn(),
  recommendNextScheduleMock: vi.fn()
}));

vi.mock("../models/profile.model.js", () => ({
  ProfileModel: {
    find: profileFindMock,
    findById: profileFindByIdMock
  }
}));

vi.mock("../models/schedule-settings.model.js", () => ({
  ScheduleSettingsModel: {
    findOne: settingsFindOneMock
  }
}));

vi.mock("../models/reward-template.model.js", () => ({
  RewardTemplateModel: {
    find: templateFindMock
  }
}));

vi.mock("../models/reward-event.model.js", () => ({
  RewardEventModel: {
    findOne: eventFindOneMock,
    find: eventFindMock,
    create: eventCreateMock
  }
}));

vi.mock("../services/scheduler-client.js", () => ({
  recommendNextSchedule: recommendNextScheduleMock
}));

import { processScheduleGeneration } from "./schedule-generation.worker.js";

describe("schedule-generation worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    settingsFindOneMock.mockResolvedValue({
      profileId: "profile-1",
      timezone: "UTC",
      minGapHours: 24,
      reminderLeadHours: 24,
      allowedWindows: [{ weekday: 1, startLocalTime: "18:00", endLocalTime: "21:00" }],
      blackoutDates: [
        {
          startAt: new Date("2026-01-12T00:00:00.000Z"),
          endAt: new Date("2026-01-12T23:59:59.000Z"),
          allDay: true,
          note: "anniversary trip"
        }
      ]
    });

    templateFindMock.mockReturnValue(
      makeLeanChain([
        {
          _id: "template-1",
          category: "gift",
          name: "flowers",
          baseIntervalDays: 7,
          jitterPct: 0.2,
          createdAt: new Date("2026-01-02T00:00:00.000Z")
        }
      ])
    );

    eventFindMock.mockReturnValue(
      makeHistoryChain([
        {
          scheduledAt: new Date("2026-01-01T20:00:00.000Z"),
          completedAt: new Date("2026-01-01T21:00:00.000Z"),
          status: "COMPLETED",
          sentimentLevel: "WELL"
        }
      ])
    );

    recommendNextScheduleMock.mockResolvedValue({
      scheduledAt: "2026-01-10T20:00:00.000Z",
      rationale: "ok"
    });

    eventCreateMock.mockResolvedValue({
      id: "event-1",
      scheduledAt: new Date("2026-01-10T20:00:00.000Z")
    });
  });

  it("scans active profiles and schedules reminder jobs", async () => {
    profileFindMock.mockReturnValue(makeLeanChain([{ _id: "profile-1" }]));
    profileFindByIdMock.mockResolvedValue({ id: "profile-1", active: true });
    eventFindOneMock.mockResolvedValue(null);

    const addMock = vi.fn().mockResolvedValue(undefined);
    const queue = { add: addMock } as unknown as Queue<{ eventId: string; reminderAt: string }>;

    await processScheduleGeneration({ data: {} } as Job<{ profileId?: string }>, queue);

    expect(profileFindMock).toHaveBeenCalledWith({ active: true });
    expect(recommendNextScheduleMock).toHaveBeenCalledTimes(1);
    expect(recommendNextScheduleMock.mock.calls[0]?.[0]).toMatchObject({
      settings: {
        allowedWindows: [{ weekday: 1, startLocalTime: "18:00", endLocalTime: "21:00" }],
        blackoutDates: [{ allDay: true, note: "anniversary trip" }]
      },
      eventHistory: [{ status: "COMPLETED", sentimentLevel: "WELL" }]
    });
    expect(eventCreateMock).toHaveBeenCalledTimes(1);
    expect(addMock).toHaveBeenCalledTimes(1);
    const [jobName, payload, options] = addMock.mock.calls[0] as [string, { eventId: string; reminderAt: string }, { jobId: string }];
    expect(jobName).toBe("send-reminder");
    expect(payload.eventId).toBe("event-1");
    expect(options.jobId.startsWith("event-1:")).toBe(true);
  });

  it("skips template when there is already an upcoming event", async () => {
    profileFindByIdMock.mockResolvedValue({ id: "profile-1", active: true });
    eventFindOneMock.mockResolvedValue({ _id: "existing-event" });

    const addMock = vi.fn().mockResolvedValue(undefined);
    const queue = { add: addMock } as unknown as Queue<{ eventId: string; reminderAt: string }>;

    await processScheduleGeneration({ data: { profileId: "profile-1" } } as Job<{ profileId?: string }>, queue);

    expect(recommendNextScheduleMock).not.toHaveBeenCalled();
    expect(eventCreateMock).not.toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalled();
  });

  it("returns early when profile is inactive or missing schedule settings", async () => {
    const addMock = vi.fn().mockResolvedValue(undefined);
    const queue = { add: addMock } as unknown as Queue<{ eventId: string; reminderAt: string }>;

    profileFindByIdMock.mockResolvedValueOnce({ id: "profile-1", active: false });
    await processScheduleGeneration({ data: { profileId: "profile-1" } } as Job<{ profileId?: string }>, queue);

    profileFindByIdMock.mockResolvedValueOnce({ id: "profile-1", active: true });
    settingsFindOneMock.mockResolvedValueOnce(null);
    await processScheduleGeneration({ data: { profileId: "profile-1" } } as Job<{ profileId?: string }>, queue);

    expect(recommendNextScheduleMock).not.toHaveBeenCalled();
    expect(eventCreateMock).not.toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalled();
  });

  it("schedules once per category even when multiple templates share a category", async () => {
    profileFindByIdMock.mockResolvedValue({ id: "profile-1", active: true });
    templateFindMock.mockReturnValue(
      makeLeanChain([
        {
          _id: "template-newest",
          category: "gift",
          name: "flowers-new",
          baseIntervalDays: 7,
          jitterPct: 0.2,
          createdAt: new Date("2026-01-03T00:00:00.000Z")
        },
        {
          _id: "template-older",
          category: "gift",
          name: "flowers-old",
          baseIntervalDays: 9,
          jitterPct: 0.2,
          createdAt: new Date("2026-01-01T00:00:00.000Z")
        }
      ])
    );
    eventFindOneMock.mockResolvedValue(null);
    eventCreateMock.mockResolvedValue({
      id: "event-1",
      scheduledAt: new Date("2026-01-10T20:00:00.000Z")
    });

    const addMock = vi.fn().mockResolvedValue(undefined);
    const queue = { add: addMock } as unknown as Queue<{ eventId: string; reminderAt: string }>;

    await processScheduleGeneration({ data: { profileId: "profile-1" } } as Job<{ profileId?: string }>, queue);

    expect(recommendNextScheduleMock).toHaveBeenCalledTimes(1);
    expect(eventCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: "template-newest" })
    );
    expect(addMock).toHaveBeenCalledTimes(1);
  });
});

function makeHistoryChain(rows: unknown[]) {
  const lean = vi.fn().mockResolvedValue(rows);
  const limit = vi.fn().mockReturnValue({ lean });
  const sort = vi.fn().mockReturnValue({ limit });
  return { sort };
}

function makeLeanChain(rows: unknown[]) {
  const lean = vi.fn().mockResolvedValue(rows);
  const sort = vi.fn().mockReturnValue({ lean });
  return {
    lean,
    sort
  };
}

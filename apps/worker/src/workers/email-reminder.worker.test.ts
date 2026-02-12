import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  sendReminderEmailMock,
  emailLogCreateMock,
  idempotencyFindOneMock,
  idempotencyCreateMock,
  profileFindByIdMock,
  eventFindByIdMock,
  eventConfigFindByIdMock,
  userFindByIdMock
} = vi.hoisted(() => ({
  sendReminderEmailMock: vi.fn(),
  emailLogCreateMock: vi.fn(),
  idempotencyFindOneMock: vi.fn(),
  idempotencyCreateMock: vi.fn(),
  profileFindByIdMock: vi.fn(),
  eventFindByIdMock: vi.fn(),
  eventConfigFindByIdMock: vi.fn(),
  userFindByIdMock: vi.fn()
}));

vi.mock("../services/email-sender.js", () => ({
  sendReminderEmail: sendReminderEmailMock
}));

vi.mock("../models/email-log.model.js", () => ({
  EmailLogModel: {
    create: emailLogCreateMock
  }
}));

vi.mock("../models/idempotency-key.model.js", () => ({
  IdempotencyKeyModel: {
    findOne: idempotencyFindOneMock,
    create: idempotencyCreateMock
  }
}));

vi.mock("../models/profile.model.js", () => ({
  ProfileModel: {
    findById: profileFindByIdMock
  }
}));

vi.mock("../models/reward-event.model.js", () => ({
  RewardEventModel: {
    findById: eventFindByIdMock
  }
}));

vi.mock("../models/reward-event-config.model.js", () => ({
  RewardEventConfigModel: {
    findById: eventConfigFindByIdMock
  }
}));

vi.mock("../models/user.model.js", () => ({
  UserModel: {
    findById: userFindByIdMock
  }
}));

import { processEmailReminder } from "./email-reminder.worker.js";

describe("email-reminder worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    idempotencyFindOneMock.mockResolvedValue(null);
    eventFindByIdMock.mockResolvedValue({
      id: "event-1",
      profileId: "profile-1",
      eventConfigId: "event-config-1",
      status: "SCHEDULED",
      scheduledAt: new Date("2026-01-10T20:00:00.000Z")
    });
    profileFindByIdMock.mockResolvedValue({ id: "profile-1", userId: "user-1", profileName: "Main" });
    eventConfigFindByIdMock.mockResolvedValue({ id: "event-config-1", name: "flowers" });
    userFindByIdMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      timezone: "UTC",
      reminderPreferences: { emailEnabled: true }
    });
    sendReminderEmailMock.mockResolvedValue("message-1");
    idempotencyCreateMock.mockResolvedValue(undefined);
    emailLogCreateMock.mockResolvedValue(undefined);
  });

  it("skips duplicate reminder sends via idempotency key", async () => {
    idempotencyFindOneMock.mockResolvedValue({ key: "event-1:2026-01-09T20:00:00.000Z" });

    await processEmailReminder(
      {
        data: { eventId: "event-1", reminderAt: "2026-01-09T20:00:00.000Z" }
      } as Job<{ eventId: string; reminderAt: string }>
    );

    expect(sendReminderEmailMock).not.toHaveBeenCalled();
    expect(emailLogCreateMock).not.toHaveBeenCalled();
  });

  it("skips reminders for ineligible event status", async () => {
    eventFindByIdMock.mockResolvedValue({
      id: "event-1",
      profileId: "profile-1",
      eventConfigId: "event-config-1",
      status: "COMPLETED",
      scheduledAt: new Date("2026-01-10T20:00:00.000Z")
    });

    await processEmailReminder(
      {
        data: { eventId: "event-1", reminderAt: "2026-01-09T20:00:00.000Z" }
      } as Job<{ eventId: string; reminderAt: string }>
    );

    expect(sendReminderEmailMock).not.toHaveBeenCalled();
    expect(idempotencyCreateMock).not.toHaveBeenCalled();
  });

  it("sends email and records idempotency and logs", async () => {
    await processEmailReminder(
      {
        data: { eventId: "event-1", reminderAt: "2026-01-09T20:00:00.000Z" }
      } as Job<{ eventId: string; reminderAt: string }>
    );

    expect(sendReminderEmailMock).toHaveBeenCalledTimes(1);
    expect(idempotencyCreateMock).toHaveBeenCalledWith({
      key: "event-1:2026-01-09T20:00:00.000Z",
      kind: "email-reminder",
      metadata: { eventId: "event-1", reminderAt: "2026-01-09T20:00:00.000Z" }
    });
    expect(emailLogCreateMock).toHaveBeenCalledTimes(1);
  });

  it("skips send when user disabled reminder emails", async () => {
    userFindByIdMock.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      timezone: "UTC",
      reminderPreferences: { emailEnabled: false }
    });

    await processEmailReminder(
      {
        data: { eventId: "event-1", reminderAt: "2026-01-09T20:00:00.000Z" }
      } as Job<{ eventId: string; reminderAt: string }>
    );

    expect(sendReminderEmailMock).not.toHaveBeenCalled();
    expect(idempotencyCreateMock).not.toHaveBeenCalled();
    expect(emailLogCreateMock).not.toHaveBeenCalled();
  });
});

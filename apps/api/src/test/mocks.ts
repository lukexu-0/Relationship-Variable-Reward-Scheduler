import { vi } from "vitest";

export const queueReminderMock = vi.fn(async () => undefined);
export const removeReminderJobsForEventMock = vi.fn(async () => undefined);
export const getMissedOptionsMock = vi.fn(async () => [
  {
    optionId: "option-asap",
    profileId: "",
    eventId: "event-1",
    type: "ASAP",
    proposedAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    rationale: "ASAP recovery",
    recommended: true
  },
  {
    optionId: "option-delayed",
    profileId: "",
    eventId: "event-1",
    type: "DELAYED",
    proposedAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    rationale: "Delayed spacing",
    recommended: false
  }
]);
export const recomputeSchedulerStateMock = vi.fn(async () => undefined);

vi.mock("../services/reminder-queue.js", () => ({
  queueReminder: queueReminderMock,
  removeReminderJobsForEvent: removeReminderJobsForEventMock,
  closeReminderQueue: vi.fn(async () => undefined)
}));

vi.mock("../services/scheduler-client.js", () => ({
  getMissedOptions: getMissedOptionsMock,
  recommendNextSchedule: vi.fn(),
  recomputeSchedulerState: recomputeSchedulerStateMock
}));

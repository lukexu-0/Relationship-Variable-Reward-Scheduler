import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getProfilesMock,
  getTemplatesMock,
  getEventsMock,
  getScheduleSettingsMock,
  getMissedOptionsMock,
  createProfileMock,
  createTemplateMock,
  updateTemplateMock,
  createEventMock,
  updateEventMock,
  deleteEventMock,
  completeEventMock,
  missEventMock,
  rescheduleEventMock,
  applyMissedOptionMock,
  updateScheduleSettingsMock
} = vi.hoisted(() => ({
  getProfilesMock: vi.fn(),
  getTemplatesMock: vi.fn(),
  getEventsMock: vi.fn(),
  getScheduleSettingsMock: vi.fn(),
  getMissedOptionsMock: vi.fn(),
  createProfileMock: vi.fn(),
  createTemplateMock: vi.fn(),
  updateTemplateMock: vi.fn(),
  createEventMock: vi.fn(),
  updateEventMock: vi.fn(),
  deleteEventMock: vi.fn(),
  completeEventMock: vi.fn(),
  missEventMock: vi.fn(),
  rescheduleEventMock: vi.fn(),
  applyMissedOptionMock: vi.fn(),
  updateScheduleSettingsMock: vi.fn()
}));

vi.mock("../../lib/api/client", () => ({
  getProfiles: getProfilesMock,
  getTemplates: getTemplatesMock,
  getEvents: getEventsMock,
  getScheduleSettings: getScheduleSettingsMock,
  getMissedOptions: getMissedOptionsMock,
  createProfile: createProfileMock,
  createTemplate: createTemplateMock,
  updateTemplate: updateTemplateMock,
  createEvent: createEventMock,
  updateEvent: updateEventMock,
  deleteEvent: deleteEventMock,
  completeEvent: completeEventMock,
  missEvent: missEventMock,
  rescheduleEvent: rescheduleEventMock,
  applyMissedOption: applyMissedOptionMock,
  updateScheduleSettings: updateScheduleSettingsMock
}));

import { localDateTimeToIso, useDashboardData } from "./useDashboardData";

describe("useDashboardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getProfilesMock.mockResolvedValue({
      profiles: [{ _id: "profile-1", profileName: "Main", partnerName: "Alex", active: true }]
    });
    getTemplatesMock.mockResolvedValue({
      templates: [
        {
          _id: "template-1",
          name: "flowers",
          category: "gift",
          baseIntervalDays: 10,
          jitterPct: 0.2,
          enabled: true,
          createdAt: "2026-01-01T00:00:00.000Z"
        }
      ]
    });
    getEventsMock.mockResolvedValue({
      events: [
        {
          _id: "event-1",
          templateId: "template-1",
          scheduledAt: "2026-02-10T18:00:00.000Z",
          originalScheduledAt: "2026-02-10T18:00:00.000Z",
          status: "MISSED",
          notes: "Missed",
          adjustments: []
        }
      ]
    });
    getScheduleSettingsMock.mockResolvedValue({
      settings: {
        timezone: "UTC",
        reminderLeadHours: 24,
        minGapHours: 24,
        allowedWindows: [{ weekday: 1, startLocalTime: "18:00", endLocalTime: "21:00" }],
        blackoutDates: []
      }
    });
    getMissedOptionsMock.mockResolvedValue({
      options: [
        {
          optionId: "opt-1",
          type: "ASAP",
          proposedAt: "2026-02-11T18:00:00.000Z",
          rationale: "Recover quickly",
          recommended: true
        }
      ]
    });

    createProfileMock.mockResolvedValue({ profile: { _id: "profile-2" } });
    createTemplateMock.mockResolvedValue({ template: { _id: "template-2", category: "trip" } });
    updateTemplateMock.mockResolvedValue({ template: { _id: "template-1", category: "gift" } });
    createEventMock.mockResolvedValue({ event: { _id: "event-2" } });
    updateEventMock.mockResolvedValue({ event: { _id: "event-1", status: "SCHEDULED" } });
    deleteEventMock.mockResolvedValue({});
    completeEventMock.mockResolvedValue({ event: { _id: "event-1", status: "COMPLETED" } });
    missEventMock.mockResolvedValue({ event: { _id: "event-1", status: "MISSED" }, options: [] });
    rescheduleEventMock.mockResolvedValue({ event: { _id: "event-1", status: "RESCHEDULED" } });
    applyMissedOptionMock.mockResolvedValue({ event: { _id: "event-1", status: "RESCHEDULED" } });
    updateScheduleSettingsMock.mockResolvedValue({ settings: { timezone: "UTC" } });
  });

  it("loads state and wires all mutations", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useDashboardData({ accessToken: "token", fallbackTimezone: "UTC" }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.selectedProfileId).toBe("profile-1"));
    await waitFor(() => expect(result.current.selectedCategory).toBe("gift"));
    await waitFor(() => expect(result.current.selectedEvent?._id).toBe("event-1"));
    await waitFor(() => expect(result.current.missedOptions).toHaveLength(1));

    await act(async () => {
      await result.current.createProfileMutation.mutateAsync({ profileName: "Second", partnerName: "Sam" });
      await result.current.createSetMutation.mutateAsync({
        name: "trip",
        category: "trip",
        baseIntervalDays: 14,
        jitterPct: 0.3
      });
      await result.current.updateSetMutation.mutateAsync({
        templateId: "template-1",
        payload: { name: "flowers-updated", enabled: true }
      });
      await result.current.createEventMutation.mutateAsync({
        scheduledAt: "2026-02-12T18:00:00.000Z",
        notes: "Bring flowers"
      });
      await result.current.updateEventMutation.mutateAsync({
        eventId: "event-1",
        payload: { notes: "Updated" }
      });
      await result.current.deleteEventMutation.mutateAsync("event-1");
      await result.current.completeEventMutation.mutateAsync("event-1");
      await result.current.missEventMutation.mutateAsync("event-1");
      await result.current.rescheduleEventMutation.mutateAsync({
        eventId: "event-1",
        scheduledAt: "2026-02-14T18:00:00.000Z",
        reason: "Move"
      });
      await result.current.applyMissedOptionMutation.mutateAsync({ optionId: "opt-1", reason: "Apply" });
      await result.current.saveSettingsMutation.mutateAsync(result.current.settings);
    });

    expect(createProfileMock).toHaveBeenCalledWith("token", {
      profileName: "Second",
      partnerName: "Sam"
    });
    expect(createTemplateMock).toHaveBeenCalled();
    expect(updateTemplateMock).toHaveBeenCalled();
    expect(createEventMock).toHaveBeenCalled();
    expect(updateEventMock).toHaveBeenCalled();
    expect(deleteEventMock).toHaveBeenCalledWith("token", "event-1");
    expect(completeEventMock).toHaveBeenCalledWith("token", "event-1", { sentimentLevel: "WELL" });
    expect(missEventMock).toHaveBeenCalledWith("token", "event-1", {});
    expect(rescheduleEventMock).toHaveBeenCalled();
    expect(applyMissedOptionMock).toHaveBeenCalled();
    expect(updateScheduleSettingsMock).toHaveBeenCalled();
  });

  it("converts local datetime to iso", () => {
    const iso = localDateTimeToIso("2026-02-10T19:30");
    expect(iso).toBe(new Date("2026-02-10T19:30").toISOString());
    expect(localDateTimeToIso("bad-value")).toBe("bad-value");
  });
});

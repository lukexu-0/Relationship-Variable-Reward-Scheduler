import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getProfilesMock,
  getEventConfigsMock,
  getEventsMock,
  getScheduleSettingsMock,
  getMissedOptionsMock,
  createProfileMock,
  createEventConfigMock,
  updateEventConfigMock,
  deleteEventConfigMock,
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
  getEventConfigsMock: vi.fn(),
  getEventsMock: vi.fn(),
  getScheduleSettingsMock: vi.fn(),
  getMissedOptionsMock: vi.fn(),
  createProfileMock: vi.fn(),
  createEventConfigMock: vi.fn(),
  updateEventConfigMock: vi.fn(),
  deleteEventConfigMock: vi.fn(),
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
  getEventConfigs: getEventConfigsMock,
  getEvents: getEventsMock,
  getScheduleSettings: getScheduleSettingsMock,
  getMissedOptions: getMissedOptionsMock,
  createProfile: createProfileMock,
  createEventConfig: createEventConfigMock,
  updateEventConfig: updateEventConfigMock,
  deleteEventConfig: deleteEventConfigMock,
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
    getEventConfigsMock.mockResolvedValue({
      eventConfigs: [
        {
          _id: "event-config-1",
          name: "shared_activity",
          slug: "shared_activity",
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
          eventConfigId: "event-config-1",
          scheduledAt: "2026-02-10T18:00:00.000Z",
          originalScheduledAt: "2026-02-10T18:00:00.000Z",
          hasExplicitTime: true,
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
        recurringBlackoutWeekdays: [0],
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
    createEventConfigMock.mockResolvedValue({ eventConfig: { _id: "event-config-2", slug: "trip" } });
    updateEventConfigMock.mockResolvedValue({ eventConfig: { _id: "event-config-1", slug: "flowers" } });
    deleteEventConfigMock.mockResolvedValue({});
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
    await waitFor(() => expect(result.current.selectedEventConfigId).toBe("event-config-1"));
    await waitFor(() => expect(result.current.selectedEvent?._id).toBe("event-1"));
    await waitFor(() => expect(result.current.missedOptions).toHaveLength(1));
    await waitFor(() => expect(result.current.eventConfigs[0]?.name).toBe("Shared Activity"));
    await waitFor(() => expect(result.current.eventConfigs[0]?.slug).toBe("shared-activity"));
    await waitFor(() => expect(result.current.selectedEvent?.eventConfigName).toBe("Shared Activity"));

    await act(async () => {
      await result.current.createProfileMutation.mutateAsync({ profileName: "Second", partnerName: "Sam" });
      await result.current.createEventConfigMutation.mutateAsync({
        name: "trip",
        baseIntervalDays: 14,
        jitterPct: 0.3
      });
      await result.current.updateEventConfigMutation.mutateAsync({
        eventConfigId: "event-config-1",
        payload: { name: "flowers-updated", enabled: true }
      });
      await result.current.deleteEventConfigMutation.mutateAsync("event-config-1");
      await result.current.createEventMutation.mutateAsync({
        scheduledDate: "2026-02-12",
        scheduledTime: "18:00",
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
        scheduledDate: "2026-02-14",
        reason: "Move"
      });
      await result.current.applyMissedOptionMutation.mutateAsync({ optionId: "opt-1", reason: "Apply" });
      await result.current.saveSettingsMutation.mutateAsync(result.current.settings);
    });

    expect(createProfileMock).toHaveBeenCalledWith("token", {
      profileName: "Second",
      partnerName: "Sam"
    });
    expect(createEventConfigMock).toHaveBeenCalled();
    expect(updateEventConfigMock).toHaveBeenCalled();
    expect(deleteEventConfigMock).toHaveBeenCalled();
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

  it("normalizes legacy default names for nice_date and activity", async () => {
    getEventConfigsMock.mockResolvedValueOnce({
      eventConfigs: [
        {
          _id: "event-config-date",
          name: "nice_date",
          slug: "nice_date",
          baseIntervalDays: 10,
          jitterPct: 0.2,
          enabled: true
        },
        {
          _id: "event-config-activity",
          name: "activity",
          slug: "activity",
          baseIntervalDays: 7,
          jitterPct: 0.2,
          enabled: true
        }
      ]
    });
    getEventsMock.mockResolvedValueOnce({ events: [] });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useDashboardData({ accessToken: "token", fallbackTimezone: "UTC" }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.eventConfigs).toHaveLength(2));

    const namesBySlug = new Map(
      result.current.eventConfigs.map((eventConfig) => [eventConfig.slug, eventConfig.name])
    );
    expect(namesBySlug.get("nice-date")).toBe("Date Night");
    expect(namesBySlug.get("activity")).toBe("Shared Activity");
  });
});

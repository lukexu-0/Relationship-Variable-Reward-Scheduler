import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type AuthState = {
  user: { email: string; timezone: string } | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  login: () => Promise<void>;
  register: () => Promise<void>;
  logout: () => Promise<void>;
};

let authState: AuthState;

const dashboardState = {
  selectedProfileId: "profile-1",
  setSelectedProfileId: vi.fn(),
  selectedEventConfigId: "event-config-1",
  setSelectedEventConfigId: vi.fn(),
  selectedEventId: "event-1",
  setSelectedEventId: vi.fn(),
  selectedCalendarDate: null,
  setSelectedCalendarDate: vi.fn(),
  profiles: [{ _id: "profile-1", profileName: "Main", partnerName: "Alex", active: true }],
  eventConfigs: [
    {
      _id: "event-config-1",
      name: "flowers",
      slug: "flowers",
      baseIntervalDays: 10,
      jitterPct: 0.2,
      enabled: true
    }
  ],
  events: [],
  eventsForSelectedConfig: [],
  upcomingForSelectedConfig: [],
  selectedEventConfig: {
    _id: "event-config-1",
    name: "flowers",
    slug: "flowers",
    baseIntervalDays: 10,
    jitterPct: 0.2,
    enabled: true
  },
  selectedEvent: null,
  settings: {
    timezone: "UTC",
    reminderLeadHours: 24,
    minGapHours: 24,
    allowedWindows: [{ weekday: 1, startLocalTime: "18:00", endLocalTime: "21:00" }],
    recurringBlackoutWeekdays: [],
    blackoutDates: []
  },
  missedOptions: [],
  loading: false,
  createProfileMutation: mutationStub(),
  createEventConfigMutation: mutationStub(),
  updateEventConfigMutation: mutationStub(),
  deleteEventConfigMutation: mutationStub(),
  createEventMutation: mutationStub(),
  updateEventMutation: mutationStub(),
  deleteEventMutation: mutationStub(),
  completeEventMutation: mutationStub(),
  missEventMutation: mutationStub(),
  rescheduleEventMutation: mutationStub(),
  applyMissedOptionMutation: mutationStub(),
  saveSettingsMutation: mutationStub()
};

vi.mock("./features/auth/useAuth", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => authState
}));

vi.mock("./features/auth/AuthPanel", () => ({
  AuthPanel: () => <div>auth-panel</div>
}));

vi.mock("./features/dashboard/useDashboardData", () => ({
  useDashboardData: () => dashboardState
}));

vi.mock("./features/event-sets/EventSetList", () => ({
  EventSetList: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button type="button" onClick={() => onSelect("event-config-1")}>
      event-set-list
    </button>
  )
}));

vi.mock("./features/event-sets/EventSetInspector", () => ({
  EventSetInspector: (props: {
    onCreateEventConfig: (payload: { name: string; baseIntervalDays: number; jitterPct: number }) => void;
    onUpdateEventConfig: (payload: {
      eventConfigId: string;
      patch: { name?: string; baseIntervalDays?: number; jitterPct?: number; enabled?: boolean };
    }) => void;
    onDeleteEventConfig: (eventConfigId: string) => void;
    onCreateEvent: (payload: { scheduledDate: string; notes?: string }) => void;
    onSaveEvent: (eventId: string, payload: { notes?: string }) => void;
    onDeleteEvent: (eventId: string) => void;
    onCompleteEvent: (eventId: string) => void;
    onMissEvent: (eventId: string) => void;
    onRescheduleEventPlusDay: (eventId: string) => void;
    onApplyMissedOption: (optionId: string) => void;
  }) => (
    <div>
      <div>event-set-inspector</div>
      <button
        type="button"
        onClick={() => props.onCreateEventConfig({ name: "trip", baseIntervalDays: 14, jitterPct: 0.2 })}
      >
        create-config
      </button>
      <button
        type="button"
        onClick={() =>
          props.onUpdateEventConfig({
            eventConfigId: "event-config-1",
            patch: { name: "flowers-updated", enabled: true }
          })
        }
      >
        update-config
      </button>
      <button type="button" onClick={() => props.onDeleteEventConfig("event-config-1")}>
        delete-config
      </button>
      <button type="button" onClick={() => props.onCreateEvent({ scheduledDate: "2026-02-11" })}>
        create-event
      </button>
      <button type="button" onClick={() => props.onSaveEvent("event-1", { notes: "x" })}>
        save-event
      </button>
      <button type="button" onClick={() => props.onDeleteEvent("event-1")}>
        delete-event
      </button>
      <button type="button" onClick={() => props.onCompleteEvent("event-1")}>
        complete-event
      </button>
      <button type="button" onClick={() => props.onMissEvent("event-1")}>
        miss-event
      </button>
      <button type="button" onClick={() => props.onRescheduleEventPlusDay("event-1")}>
        plus-day
      </button>
      <button type="button" onClick={() => props.onApplyMissedOption("opt-1")}>
        apply-option
      </button>
    </div>
  )
}));

vi.mock("./features/settings/ScheduleSettingsPanel", () => ({
  ScheduleSettingsPanel: () => <div>schedule-settings-panel</div>
}));

vi.mock("./features/events/EventCalendar", () => ({
  EventCalendar: ({ onOpenScheduleSettings }: { onOpenScheduleSettings: () => void }) => (
    <div>
      <div>event-calendar</div>
      <button type="button" onClick={onOpenScheduleSettings}>
        open-settings
      </button>
    </div>
  )
}));

import { App } from "./App";

describe("App", () => {
  beforeEach(() => {
    authState = {
      user: null,
      accessToken: null,
      refreshToken: null,
      loading: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn()
    };
  });

  it("shows loading state while auth is loading", () => {
    authState.loading = true;
    render(<App />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows auth panel when logged out", () => {
    render(<App />);
    expect(screen.getByText("auth-panel")).toBeInTheDocument();
  });

  it("shows set list + inspector dashboard when authenticated", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    authState.user = { email: "user@example.com", timezone: "UTC" };
    authState.accessToken = "token";
    authState.refreshToken = "refresh";

    render(<App />);
    expect(screen.getByText("event-set-list")).toBeInTheDocument();
    expect(screen.queryByText("event-set-inspector")).not.toBeInTheDocument();
    expect(screen.getByText("event-calendar")).toBeInTheDocument();
    expect(screen.queryByText("schedule-settings-panel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Event Builder/i }));
    expect(screen.getByText("event-set-inspector")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "event-set-list" }));
    await user.click(screen.getByRole("button", { name: "create-config" }));
    await user.click(screen.getByRole("button", { name: "update-config" }));
    await user.click(screen.getByRole("button", { name: "delete-config" }));
    await user.click(screen.getByRole("button", { name: "create-event" }));
    await user.click(screen.getByRole("button", { name: "save-event" }));
    await user.click(screen.getByRole("button", { name: "delete-event" }));
    await user.click(screen.getByRole("button", { name: "complete-event" }));
    await user.click(screen.getByRole("button", { name: "miss-event" }));
    await user.click(screen.getByRole("button", { name: "plus-day" }));
    await user.click(screen.getByRole("button", { name: "apply-option" }));

    await user.click(screen.getByRole("button", { name: "New profile" }));
    screen.getByLabelText("Profile name").dispatchEvent(new Event("input", { bubbles: true }));

    await user.click(screen.getByRole("button", { name: "open-settings" }));
    expect(screen.getByText("schedule-settings-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("settings-modal-backdrop"));
    expect(screen.queryByText("schedule-settings-panel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "open-settings" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("schedule-settings-panel")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "open-settings" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("schedule-settings-panel")).not.toBeInTheDocument();

    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

function mutationStub() {
  return {
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
    error: null
  };
}

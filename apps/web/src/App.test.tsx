import { render, screen } from "@testing-library/react";
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
  selectedCategory: "gift",
  setSelectedCategory: vi.fn(),
  selectedEventId: "event-1",
  setSelectedEventId: vi.fn(),
  profiles: [{ _id: "profile-1", profileName: "Main", partnerName: "Alex", active: true }],
  templates: [
    {
      _id: "template-1",
      name: "flowers",
      category: "gift",
      baseIntervalDays: 10,
      jitterPct: 0.2,
      enabled: true
    }
  ],
  categories: ["gift"],
  events: [],
  eventsForSelectedCategory: [],
  upcomingForSelectedCategory: [],
  selectedSet: {
    _id: "template-1",
    name: "flowers",
    category: "gift",
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
    blackoutDates: []
  },
  missedOptions: [],
  loading: false,
  createProfileMutation: mutationStub(),
  createSetMutation: mutationStub(),
  updateSetMutation: mutationStub(),
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
  EventSetList: () => <div>event-set-list</div>
}));

vi.mock("./features/event-sets/EventSetInspector", () => ({
  EventSetInspector: () => <div>event-set-inspector</div>
}));

vi.mock("./features/settings/ScheduleSettingsPanel", () => ({
  ScheduleSettingsPanel: () => <div>schedule-settings-panel</div>
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

  it("shows set list + inspector dashboard when authenticated", () => {
    authState.user = { email: "user@example.com", timezone: "UTC" };
    authState.accessToken = "token";
    authState.refreshToken = "refresh";

    render(<App />);
    expect(screen.getByText("event-set-list")).toBeInTheDocument();
    expect(screen.getByText("event-set-inspector")).toBeInTheDocument();
    expect(screen.getByText("schedule-settings-panel")).toBeInTheDocument();
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

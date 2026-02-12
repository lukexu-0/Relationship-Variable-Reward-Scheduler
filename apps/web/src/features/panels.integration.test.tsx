import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getProfilesMock,
  createProfileMock,
  getTemplatesMock,
  createTemplateMock
} = vi.hoisted(() => ({
  getProfilesMock: vi.fn(),
  createProfileMock: vi.fn(),
  getTemplatesMock: vi.fn(),
  createTemplateMock: vi.fn()
}));

vi.mock("../lib/api/client", () => ({
  getProfiles: getProfilesMock,
  createProfile: createProfileMock,
  getTemplates: getTemplatesMock,
  createTemplate: createTemplateMock
}));

import { ProfilesPanel } from "./profiles/ProfilesPanel";
import { ScheduleSettingsPanel } from "./settings/ScheduleSettingsPanel";
import { TemplatesPanel } from "./templates/TemplatesPanel";

describe("feature panels integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    getProfilesMock.mockResolvedValue({
      profiles: [{ _id: "profile-1", profileName: "Main", partnerName: "Alex", active: true }]
    });
    createProfileMock.mockResolvedValue({
      profile: { _id: "profile-2", profileName: "Second", partnerName: "Sam", active: true }
    });

    getTemplatesMock.mockResolvedValue({
      templates: [
        {
          _id: "template-1",
          name: "flowers",
          category: "gift",
          baseIntervalDays: 10,
          jitterPct: 0.2,
          enabled: true
        }
      ]
    });
    createTemplateMock.mockResolvedValue({ template: { _id: "template-2", name: "trip" } });
  });

  it("creates profiles and auto-selects existing profile", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onSelectProfile = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <ProfilesPanel accessToken="token" selectedProfileId={null} onSelectProfile={onSelectProfile} />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Main")).toBeInTheDocument();
    await waitFor(() => expect(onSelectProfile).toHaveBeenCalledWith("profile-1"));

    await user.type(screen.getByLabelText("Profile name"), "Second");
    await user.type(screen.getByLabelText("Partner name (optional)"), "Sam");
    await user.click(screen.getByRole("button", { name: "Create profile" }));

    await waitFor(() =>
      expect(createProfileMock).toHaveBeenCalledWith("token", {
        profileName: "Second",
        partnerName: "Sam"
      })
    );
  });

  it("creates templates for the selected profile", async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <TemplatesPanel accessToken="token" profileId="profile-1" />
      </QueryClientProvider>
    );

    expect(await screen.findByText("flowers")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Template name"), "trip");
    await user.clear(screen.getByLabelText("Category"));
    await user.type(screen.getByLabelText("Category"), "trip");
    await user.clear(screen.getByLabelText("Base interval days"));
    await user.type(screen.getByLabelText("Base interval days"), "14");
    await user.clear(screen.getByLabelText("Jitter pct"));
    await user.type(screen.getByLabelText("Jitter pct"), "0.3");
    await user.click(screen.getByRole("button", { name: "Create template" }));

    await waitFor(() =>
      expect(createTemplateMock).toHaveBeenCalledWith("token", "profile-1", {
        name: "trip",
        category: "trip",
        baseIntervalDays: 14,
        jitterPct: 0.3,
        enabled: true
      })
    );
  });

  it("saves schedule settings with blackout rows", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <ScheduleSettingsPanel
        profileId="profile-1"
        settings={{
          timezone: "UTC",
          reminderLeadHours: 24,
          minGapHours: 24,
          allowedWindows: [{ weekday: 1, startLocalTime: "18:00", endLocalTime: "21:00" }],
          recurringBlackoutWeekdays: [],
          blackoutDates: []
        }}
        onSave={onSave}
      />
    );

    await user.click(screen.getByRole("button", { name: "Add blackout" }));
    await user.type(screen.getByLabelText("Note"), "Vacation");
    await user.click(screen.getByRole("button", { name: "Save settings" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0]?.[0] as { blackoutDates: Array<{ note?: string }> };
    expect(payload.blackoutDates).toHaveLength(1);
    expect(payload.blackoutDates[0]?.note).toContain("Vacation");
  });
});

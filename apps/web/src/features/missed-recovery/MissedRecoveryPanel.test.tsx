import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMissedOptionsMock, applyMissedOptionMock } = vi.hoisted(() => ({
  getMissedOptionsMock: vi.fn(),
  applyMissedOptionMock: vi.fn()
}));

vi.mock("../../lib/api/client", () => ({
  getMissedOptions: getMissedOptionsMock,
  applyMissedOption: applyMissedOptionMock
}));

import { MissedRecoveryPanel } from "./MissedRecoveryPanel";

describe("MissedRecoveryPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMissedOptionsMock.mockResolvedValue({
      options: [
        {
          optionId: "option-1",
          type: "ASAP",
          proposedAt: "2026-02-12T19:00:00.000Z",
          rationale: "Recover quickly",
          recommended: true
        }
      ]
    });
    applyMissedOptionMock.mockResolvedValue({ event: { _id: "event-1", status: "RESCHEDULED" } });
  });

  it("loads missed options and applies the selected option", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <MissedRecoveryPanel accessToken="token" eventId="event-1" profileId="profile-1" />
      </QueryClientProvider>
    );

    expect(await screen.findByText("ASAP")).toBeInTheDocument();
    expect(screen.getByText("Recover quickly")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() =>
      expect(applyMissedOptionMock).toHaveBeenCalledWith(
        "token",
        "event-1",
        "option-1",
        { reason: "Applied via missed recovery panel" }
      )
    );
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getTemplatesMock,
  getEventsMock,
  createEventMock,
  completeEventMock,
  missEventMock,
  rescheduleEventMock
} = vi.hoisted(() => ({
  getTemplatesMock: vi.fn(),
  getEventsMock: vi.fn(),
  createEventMock: vi.fn(),
  completeEventMock: vi.fn(),
  missEventMock: vi.fn(),
  rescheduleEventMock: vi.fn()
}));

vi.mock("../../lib/api/client", () => ({
  getTemplates: getTemplatesMock,
  getEvents: getEventsMock,
  createEvent: createEventMock,
  completeEvent: completeEventMock,
  missEvent: missEventMock,
  rescheduleEvent: rescheduleEventMock
}));

import { EventsPanel } from "./EventsPanel";

describe("EventsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

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
    getEventsMock.mockResolvedValue({ events: [] });
    createEventMock.mockResolvedValue({ event: { _id: "event-1" } });
    completeEventMock.mockResolvedValue({ event: { _id: "event-1", status: "COMPLETED" } });
    missEventMock.mockResolvedValue({ event: { _id: "event-1", status: "MISSED" }, options: [] });
    rescheduleEventMock.mockResolvedValue({ event: { _id: "event-1", status: "RESCHEDULED" } });
  });

  it("converts datetime-local input into ISO string when creating events", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();

    render(
      <QueryClientProvider client={queryClient}>
        <EventsPanel accessToken="token" profileId="profile-1" onPickMissedEvent={vi.fn()} />
      </QueryClientProvider>
    );

    await screen.findByRole("option", { name: "flowers" });

    await user.selectOptions(screen.getByLabelText("Template"), "template-1");
    await user.type(screen.getByLabelText("Scheduled date/time"), "2026-02-10T18:30");
    await user.click(screen.getByRole("button", { name: "Add event" }));

    await waitFor(() => expect(createEventMock).toHaveBeenCalledTimes(1));
    const payload = createEventMock.mock.calls[0]?.[2] as { scheduledAt: string };
    expect(payload.scheduledAt).toBe(new Date("2026-02-10T18:30").toISOString());
  });

  it("renders original date and adjustment history for rescheduled events", async () => {
    getEventsMock.mockResolvedValue({
      events: [
        {
          _id: "event-1",
          templateId: "template-1",
          scheduledAt: "2026-02-11T19:00:00.000Z",
          originalScheduledAt: "2026-02-10T19:00:00.000Z",
          status: "RESCHEDULED",
          notes: "Updated",
          adjustments: [
            {
              fromAt: "2026-02-10T19:00:00.000Z",
              toAt: "2026-02-11T19:00:00.000Z",
              reason: "Travel conflict",
              adjustedByUserId: "user-1",
              adjustedAt: "2026-02-09T10:00:00.000Z"
            }
          ]
        }
      ]
    });

    const onPickMissedEvent = vi.fn();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <EventsPanel accessToken="token" profileId="profile-1" onPickMissedEvent={onPickMissedEvent} />
      </QueryClientProvider>
    );

    expect(await screen.findByText("Adjustment history")).toBeInTheDocument();
    expect(screen.getByText(/Original:/)).toBeInTheDocument();
    expect(screen.getByText(/Travel conflict/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Complete (Well)" }));
    await waitFor(() =>
      expect(completeEventMock).toHaveBeenCalledWith("token", "event-1", { sentimentLevel: "WELL" })
    );

    await user.click(screen.getByRole("button", { name: "Mark missed" }));
    await waitFor(() => expect(missEventMock).toHaveBeenCalledWith("token", "event-1", {}));
    expect(onPickMissedEvent).toHaveBeenCalledWith("event-1");

    await user.click(screen.getByRole("button", { name: "+1 day" }));
    await waitFor(() =>
      expect(rescheduleEventMock).toHaveBeenCalledWith("token", "event-1", {
        scheduledAt: expect.any(String),
        reason: "Adjusted by user"
      })
    );

    await user.click(screen.getByRole("button", { name: "Recovery options" }));
    expect(onPickMissedEvent).toHaveBeenCalledWith("event-1");
  });
});

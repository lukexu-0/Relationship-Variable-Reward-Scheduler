import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { UpcomingEventsPanel } from "./UpcomingEventsPanel";

describe("UpcomingEventsPanel", () => {
  it("renders upcoming items and supports select/delete actions", async () => {
    const user = userEvent.setup();
    const onSelectEvent = vi.fn();
    const onDeleteEvent = vi.fn();

    render(
      <UpcomingEventsPanel
        selectedEventConfigName="Flowers"
        selectedEventId={null}
        eventsForConfig={[
          {
            _id: "event-1",
            status: "SCHEDULED",
            scheduledAt: "2026-02-11T18:00:00.000Z",
            hasExplicitTime: true,
            eventConfigName: "Flowers"
          },
          {
            _id: "event-2",
            status: "COMPLETED",
            scheduledAt: "2026-02-10T18:00:00.000Z",
            hasExplicitTime: true,
            eventConfigName: "Flowers"
          }
        ]}
        upcomingEvents={[
          {
            _id: "event-1",
            status: "SCHEDULED",
            scheduledAt: "2026-02-11T18:00:00.000Z",
            hasExplicitTime: true,
            eventConfigName: "Flowers"
          }
        ]}
        onSelectEvent={onSelectEvent}
        onDeleteEvent={onDeleteEvent}
      />
    );

    await user.click(screen.getByRole("button", { name: /SCHEDULED/i }));
    expect(onSelectEvent).toHaveBeenCalledWith("event-1");

    await user.click(screen.getByRole("button", { name: "Delete upcoming event" }));
    expect(onDeleteEvent).toHaveBeenCalledWith("event-1");

    await user.click(screen.getByRole("button", { name: /COMPLETED/i }));
    expect(onSelectEvent).toHaveBeenCalledWith("event-2");
  });

  it("truncates long past history and opens with drawer button", async () => {
    const user = userEvent.setup();
    const onSelectEvent = vi.fn();
    const onDeleteEvent = vi.fn();

    const pastEvents = Array.from({ length: 11 }, (_, index) => ({
      _id: `past-${index + 1}`,
      status: "COMPLETED",
      scheduledAt: `2026-01-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`,
      hasExplicitTime: true,
      eventConfigName: "Flowers"
    }));

    render(
      <UpcomingEventsPanel
        selectedEventConfigName="Flowers"
        selectedEventId={null}
        eventsForConfig={pastEvents}
        upcomingEvents={[]}
        onSelectEvent={onSelectEvent}
        onDeleteEvent={onDeleteEvent}
      />
    );

    expect(screen.getAllByTestId("past-event-row")).toHaveLength(8);
    await user.click(screen.getByRole("button", { name: "Open history drawer (11)" }));
    expect(screen.getAllByTestId("past-event-row")).toHaveLength(11);
    expect(screen.getByRole("button", { name: "Collapse history" })).toBeInTheDocument();
  });
});

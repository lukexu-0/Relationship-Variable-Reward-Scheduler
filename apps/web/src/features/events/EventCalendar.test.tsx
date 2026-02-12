import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventCalendar } from "./EventCalendar";

describe("EventCalendar", () => {
  it("renders events and selects date/event from day cells", async () => {
    const user = userEvent.setup();
    const onSelectDate = vi.fn();
    const onSelectEvent = vi.fn();
    const onOpenScheduleSettings = vi.fn();
    const scheduledAt = new Date(Date.UTC(2026, 1, 10, 18, 0, 0)).toISOString();

    render(
      <EventCalendar
        events={[
          {
            _id: "event-1",
            scheduledAt,
            hasExplicitTime: true,
            status: "SCHEDULED",
            eventConfigName: "Flowers",
            eventConfigId: "event-config-1"
          }
        ]}
        selectedEventConfigId="event-config-1"
        selectedDate={null}
        onSelectDate={onSelectDate}
        onSelectEvent={onSelectEvent}
        onOpenScheduleSettings={onOpenScheduleSettings}
      />
    );

    await user.click(screen.getByRole("button", { name: "Schedule Settings" }));
    expect(onOpenScheduleSettings).toHaveBeenCalledTimes(1);

    const flowersPill = screen.getByText("Flowers");
    const targetDay = flowersPill.closest("button");
    expect(targetDay).toBeTruthy();
    expect(targetDay).toHaveClass("highlighted-events");
    await user.click(targetDay as HTMLButtonElement);
    expect(onSelectDate).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(onSelectEvent).toHaveBeenCalledWith("event-1");

    const monthInput = screen.getByLabelText("Go to month");
    fireEvent.change(monthInput, { target: { value: "2027-01" } });
    expect(monthInput).toHaveValue("2027-01");
    expect(screen.getByText("January 2027")).toBeInTheDocument();
  });
});

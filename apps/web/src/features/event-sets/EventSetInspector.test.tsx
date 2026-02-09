import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventSetInspector } from "./EventSetInspector";

describe("EventSetInspector", () => {
  it("manages selected set, events, and missed options", async () => {
    const user = userEvent.setup();
    const onSelectEvent = vi.fn();
    const onApplyMissedOption = vi.fn();
    const onUpdateSet = vi.fn();
    const onCreateEvent = vi.fn();
    const onSaveEvent = vi.fn();
    const onDeleteEvent = vi.fn();
    const onCompleteEvent = vi.fn();
    const onMissEvent = vi.fn();
    const onRescheduleEventPlusDay = vi.fn();

    render(
      <EventSetInspector
        selectedSet={{
          _id: "template-1",
          name: "flowers",
          category: "gift",
          baseIntervalDays: 10,
          jitterPct: 0.2,
          enabled: true
        }}
        eventsForCategory={[
          {
            _id: "event-1",
            status: "MISSED",
            notes: "Missed",
            scheduledAt: "2026-02-11T18:00:00.000Z",
            originalScheduledAt: "2026-02-11T18:00:00.000Z",
            templateName: "flowers",
            adjustments: []
          }
        ]}
        upcomingForCategory={[]}
        selectedEvent={{
          _id: "event-1",
          status: "MISSED",
          notes: "Missed",
          scheduledAt: "2026-02-11T18:00:00.000Z",
          originalScheduledAt: "2026-02-11T18:00:00.000Z",
          templateName: "flowers",
          adjustments: []
        }}
        missedOptions={[
          {
            optionId: "opt-1",
            type: "ASAP",
            proposedAt: "2026-02-12T18:00:00.000Z",
            rationale: "Recover now",
            recommended: true
          }
        ]}
        onSelectEvent={onSelectEvent}
        onCreateSet={vi.fn()}
        onUpdateSet={onUpdateSet}
        onCreateEvent={onCreateEvent}
        onSaveEvent={onSaveEvent}
        onDeleteEvent={onDeleteEvent}
        onCompleteEvent={onCompleteEvent}
        onMissEvent={onMissEvent}
        onRescheduleEventPlusDay={onRescheduleEventPlusDay}
        onApplyMissedOption={onApplyMissedOption}
      />
    );

    await user.clear(screen.getByLabelText("Set name"));
    await user.type(screen.getByLabelText("Set name"), "flowers-updated");
    await user.click(screen.getByRole("button", { name: "Save set" }));
    expect(onUpdateSet).toHaveBeenCalledWith({
      templateId: "template-1",
      patch: {
        name: "flowers-updated",
        baseIntervalDays: 10,
        jitterPct: 0.2,
        enabled: true
      }
    });

    await user.type(screen.getByLabelText("Schedule new event for this set"), "2026-02-20T19:00");
    await user.click(screen.getByRole("button", { name: "Add event" }));
    expect(onCreateEvent).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /MISSED/ }));
    expect(onSelectEvent).toHaveBeenCalledWith("event-1");

    await user.click(screen.getByRole("button", { name: "Save event" }));
    expect(onSaveEvent).toHaveBeenCalledWith(
      "event-1",
      expect.objectContaining({ notes: expect.stringContaining("Missed") })
    );

    await user.click(screen.getByRole("button", { name: "Delete event" }));
    expect(onDeleteEvent).toHaveBeenCalledWith("event-1");

    await user.click(screen.getByRole("button", { name: "Complete" }));
    await user.click(screen.getByRole("button", { name: "Mark missed" }));
    await user.click(screen.getByRole("button", { name: "+1 day" }));
    expect(onCompleteEvent).toHaveBeenCalledWith("event-1");
    expect(onMissEvent).toHaveBeenCalledWith("event-1");
    expect(onRescheduleEventPlusDay).toHaveBeenCalledWith("event-1");

    await user.click(screen.getByRole("button", { name: "Apply option" }));
    expect(onApplyMissedOption).toHaveBeenCalledWith("opt-1");
  });

  it("creates a new set when none is selected", async () => {
    const user = userEvent.setup();
    const onCreateSet = vi.fn();

    render(
      <EventSetInspector
        selectedSet={null}
        eventsForCategory={[]}
        upcomingForCategory={[]}
        selectedEvent={null}
        missedOptions={[]}
        onSelectEvent={vi.fn()}
        onCreateSet={onCreateSet}
        onUpdateSet={vi.fn()}
        onCreateEvent={vi.fn()}
        onSaveEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
        onCompleteEvent={vi.fn()}
        onMissEvent={vi.fn()}
        onRescheduleEventPlusDay={vi.fn()}
        onApplyMissedOption={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText("Set name"), "weekend trip");
    await user.type(screen.getByLabelText("Category"), "trip");
    await user.click(screen.getByRole("button", { name: "Create set" }));

    expect(onCreateSet).toHaveBeenCalledWith({
      name: "weekend trip",
      category: "trip",
      baseIntervalDays: 7,
      jitterPct: 0.2
    });
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventSetInspector } from "./EventSetInspector";

describe("EventSetInspector", () => {
  it("manages selected config, events, and missed options", async () => {
    const user = userEvent.setup();
    const onSelectEvent = vi.fn();
    const onApplyMissedOption = vi.fn();
    const onUpdateEventConfig = vi.fn();
    const onCreateEvent = vi.fn();
    const onSaveEvent = vi.fn();
    const onDeleteEvent = vi.fn();
    const onCompleteEvent = vi.fn();
    const onMissEvent = vi.fn();
    const onRescheduleEventPlusDay = vi.fn();

    render(
      <EventSetInspector
        selectedEventConfig={{
          _id: "event-config-1",
          name: "flowers",
          slug: "flowers",
          baseIntervalDays: 10,
          jitterPct: 0.2,
          enabled: true
        }}
        eventsForConfig={[
          {
            _id: "event-1",
            status: "MISSED",
            notes: "Missed",
            scheduledAt: "2026-02-11T18:00:00.000Z",
            originalScheduledAt: "2026-02-11T18:00:00.000Z",
            hasExplicitTime: true,
            eventConfigName: "flowers",
            adjustments: []
          }
        ]}
        upcomingForConfig={[]}
        selectedEvent={{
          _id: "event-1",
          status: "MISSED",
          notes: "Missed",
          scheduledAt: "2026-02-11T18:00:00.000Z",
          originalScheduledAt: "2026-02-11T18:00:00.000Z",
          hasExplicitTime: true,
          eventConfigName: "flowers",
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
        onCreateEventConfig={vi.fn()}
        onUpdateEventConfig={onUpdateEventConfig}
        onDeleteEventConfig={vi.fn()}
        onCreateEvent={onCreateEvent}
        onSaveEvent={onSaveEvent}
        onDeleteEvent={onDeleteEvent}
        onCompleteEvent={onCompleteEvent}
        onMissEvent={onMissEvent}
        onRescheduleEventPlusDay={onRescheduleEventPlusDay}
        onApplyMissedOption={onApplyMissedOption}
      />
    );

    await user.clear(screen.getByLabelText("Event name"));
    await user.type(screen.getByLabelText("Event name"), "flowers-updated");
    await user.click(screen.getAllByRole("button", { name: "Save event" })[0]);
    expect(onUpdateEventConfig).toHaveBeenCalledWith({
      eventConfigId: "event-config-1",
      patch: {
        name: "flowers-updated",
        baseIntervalDays: 10,
        jitterPct: 0.2,
        enabled: true
      }
    });

    await user.type(screen.getByLabelText("Schedule new event date"), "2026-02-20");
    await user.click(screen.getByRole("button", { name: "Add event" }));
    expect(onCreateEvent).toHaveBeenCalledTimes(1);

    await user.click(screen.getAllByRole("button", { name: /^Save event$/ })[1]);
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

  it("creates a new event config when none is selected", async () => {
    const user = userEvent.setup();
    const onCreateEventConfig = vi.fn();

    render(
      <EventSetInspector
        selectedEventConfig={null}
        eventsForConfig={[]}
        upcomingForConfig={[]}
        selectedEvent={null}
        missedOptions={[]}
        onSelectEvent={vi.fn()}
        onCreateEventConfig={onCreateEventConfig}
        onUpdateEventConfig={vi.fn()}
        onDeleteEventConfig={vi.fn()}
        onCreateEvent={vi.fn()}
        onSaveEvent={vi.fn()}
        onDeleteEvent={vi.fn()}
        onCompleteEvent={vi.fn()}
        onMissEvent={vi.fn()}
        onRescheduleEventPlusDay={vi.fn()}
        onApplyMissedOption={vi.fn()}
      />
    );

    await user.type(screen.getByLabelText("Event name"), "weekend trip");
    await user.click(screen.getByRole("button", { name: "Create event" }));

    expect(onCreateEventConfig).toHaveBeenCalledWith({
      name: "weekend trip",
      baseIntervalDays: 7,
      jitterPct: 0.2
    });
  });
});

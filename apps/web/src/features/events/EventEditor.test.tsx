import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventEditor } from "./EventEditor";

describe("EventEditor", () => {
  it("saves event edits and supports delete", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onDelete = vi.fn();

    render(
      <EventEditor
        event={{
          _id: "event-1",
          status: "SCHEDULED",
          notes: "Initial",
          scheduledAt: "2026-02-11T18:00:00.000Z",
          originalScheduledAt: "2026-02-11T18:00:00.000Z",
          templateName: "flowers",
          adjustments: []
        }}
        onSave={onSave}
        onDelete={onDelete}
        onComplete={vi.fn()}
        onMiss={vi.fn()}
        onReschedulePlusDay={vi.fn()}
      />
    );

    await user.clear(screen.getByLabelText("Notes"));
    await user.type(screen.getByLabelText("Notes"), "Updated note");
    await user.click(screen.getByRole("button", { name: "Save event" }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0]?.[0] as { notes?: string };
    expect(payload.notes).toContain("Updated note");

    await user.click(screen.getByRole("button", { name: "Delete event" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BlackoutSelector } from "./BlackoutSelector";

describe("BlackoutSelector", () => {
  it("toggles recurring weekdays and delegates date-range edits", async () => {
    const user = userEvent.setup();
    const onRecurringChange = vi.fn();
    const onDatesChange = vi.fn();

    const { rerender } = render(
      <BlackoutSelector
        recurringBlackoutWeekdays={[]}
        blackoutDates={[]}
        onRecurringChange={onRecurringChange}
        onDatesChange={onDatesChange}
      />
    );

    await user.click(screen.getByLabelText("Sun"));
    expect(onRecurringChange).toHaveBeenCalledWith([0]);

    await user.click(screen.getByRole("button", { name: "Add blackout" }));
    expect(onDatesChange).toHaveBeenCalledTimes(1);
    const nextDates = onDatesChange.mock.calls[0]?.[0] as Array<{ startAt: string }>;
    expect(nextDates).toHaveLength(1);

    rerender(
      <BlackoutSelector
        recurringBlackoutWeekdays={[0]}
        blackoutDates={nextDates}
        onRecurringChange={onRecurringChange}
        onDatesChange={onDatesChange}
      />
    );

    await user.clear(screen.getByLabelText("Note"));
    await user.type(screen.getByLabelText("Note"), "Trip");
    expect(onDatesChange).toHaveBeenCalled();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BlackoutDatesEditor } from "./BlackoutDatesEditor";

describe("BlackoutDatesEditor", () => {
  it("adds, edits, and deletes blackout rows", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(<BlackoutDatesEditor blackoutDates={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Add blackout" }));
    expect(onChange).toHaveBeenCalledTimes(1);
    const added = onChange.mock.calls[0]?.[0] as Array<{ startAt: string; note?: string }>;
    expect(added).toHaveLength(1);

    rerender(<BlackoutDatesEditor blackoutDates={added} onChange={onChange} />);

    await user.clear(screen.getByLabelText("Note"));
    await user.type(screen.getByLabelText("Note"), "Travel");
    expect(onChange).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Delete blackout" }));
    const deleted = onChange.mock.calls[onChange.mock.calls.length - 1]?.[0] as unknown[];
    expect(deleted).toHaveLength(0);
  });
});

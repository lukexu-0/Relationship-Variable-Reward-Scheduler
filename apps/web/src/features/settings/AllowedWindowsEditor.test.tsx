import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AllowedWindowsEditor } from "./AllowedWindowsEditor";

describe("AllowedWindowsEditor", () => {
  it("enables/disables weekdays and updates times", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <AllowedWindowsEditor
        allowedWindows={[
          { weekday: 1, startLocalTime: "09:00", endLocalTime: "21:00" }
        ]}
        onChange={onChange}
      />
    );

    await user.selectOptions(screen.getByLabelText("Sunday"), "true");
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ weekday: 0 })])
    );

    await user.clear(screen.getByLabelText("Monday start"));
    await user.type(screen.getByLabelText("Monday start"), "10:30");
    expect(onChange).toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("Monday"), "false");
    expect(onChange).toHaveBeenCalledWith(expect.not.arrayContaining([expect.objectContaining({ weekday: 1 })]));
  });
});

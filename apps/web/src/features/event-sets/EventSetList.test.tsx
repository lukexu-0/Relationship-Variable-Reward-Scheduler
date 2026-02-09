import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventSetList } from "./EventSetList";

describe("EventSetList", () => {
  it("renders set rows and selects a category", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <EventSetList
        items={[
          { category: "gift", name: "flowers", upcomingCount: 1, totalCount: 4 },
          { category: "trip", name: "weekend", upcomingCount: 0, totalCount: 2 }
        ]}
        selectedCategory="gift"
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByRole("button", { name: /weekend/ }));
    expect(onSelect).toHaveBeenCalledWith("trip");
    expect(screen.getByText("1 upcoming")).toBeInTheDocument();
  });
});

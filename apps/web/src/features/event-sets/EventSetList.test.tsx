import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventSetList } from "./EventSetList";

describe("EventSetList", () => {
  it("renders event rows and selects one", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <EventSetList
        items={[
          { id: "event-config-1", slug: "flowers", name: "flowers", upcomingCount: 1, totalCount: 4 },
          { id: "event-config-2", slug: "weekend", name: "weekend", upcomingCount: 0, totalCount: 2 }
        ]}
        selectedEventConfigId="event-config-1"
        onSelect={onSelect}
      />
    );

    await user.click(screen.getByRole("button", { name: /weekend/ }));
    expect(onSelect).toHaveBeenCalledWith("event-config-2");
    expect(screen.getByText("1 upcoming")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Events" })).not.toBeInTheDocument();
    expect(screen.getByText("Choose an event to manage upcoming and history items.")).toBeInTheDocument();
  });
});

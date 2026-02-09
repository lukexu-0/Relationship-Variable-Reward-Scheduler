import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loginMock, registerMock } = vi.hoisted(() => ({
  loginMock: vi.fn(),
  registerMock: vi.fn()
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    loading: false,
    login: loginMock,
    register: registerMock,
    logout: vi.fn()
  })
}));

import { AuthPanel } from "./AuthPanel";

describe("AuthPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loginMock.mockResolvedValue(undefined);
    registerMock.mockResolvedValue(undefined);
  });

  it("submits login credentials", async () => {
    const user = userEvent.setup();
    render(<AuthPanel />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "StrongPassword123");
    await user.click(screen.getByRole("button", { name: "Sign In" }));

    expect(loginMock).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "StrongPassword123"
    });
  });

  it("submits registration including timezone", async () => {
    const user = userEvent.setup();
    render(<AuthPanel />);

    await user.click(screen.getByRole("button", { name: "Register" }));
    await user.type(screen.getByLabelText("Email"), "new@example.com");
    await user.type(screen.getByLabelText("Password"), "StrongPassword123");
    await user.clear(screen.getByLabelText("Timezone"));
    await user.type(screen.getByLabelText("Timezone"), "America/New_York");
    await user.click(screen.getByRole("button", { name: "Create Account" }));

    expect(registerMock).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "StrongPassword123",
      timezone: "America/New_York"
    });
  });
});

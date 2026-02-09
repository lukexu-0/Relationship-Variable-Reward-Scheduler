import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getMeMock,
  loginMock,
  registerMock,
  refreshAuthMock,
  logoutAuthMock
} = vi.hoisted(() => ({
  getMeMock: vi.fn(),
  loginMock: vi.fn(),
  registerMock: vi.fn(),
  refreshAuthMock: vi.fn(),
  logoutAuthMock: vi.fn()
}));

vi.mock("../../lib/api/client", () => ({
  getMe: getMeMock,
  login: loginMock,
  register: registerMock,
  refreshAuth: refreshAuthMock,
  logoutAuth: logoutAuthMock
}));

import { AuthProvider, useAuth } from "./useAuth";

const STORAGE_KEY = "reward-auth";

function Harness() {
  const auth = useAuth();

  if (auth.loading) {
    return <p>loading</p>;
  }

  return (
    <div>
      <p>{auth.user?.email ?? "no-user"}</p>
      <button
        onClick={() =>
          auth.login({ email: "user@example.com", password: "StrongPassword123" })
        }
      >
        do-login
      </button>
      <button
        onClick={() =>
          auth.register({
            email: "new@example.com",
            password: "StrongPassword123",
            timezone: "UTC"
          })
        }
      >
        do-register
      </button>
      <button onClick={() => auth.logout()}>do-logout</button>
    </div>
  );
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("recovers session by refreshing token when access token is stale", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ accessToken: "expired-token", refreshToken: "refresh-token" })
    );

    getMeMock.mockRejectedValueOnce(new Error("expired"));
    refreshAuthMock.mockResolvedValueOnce({
      tokens: {
        accessToken: "new-access",
        refreshToken: "new-refresh"
      }
    });
    getMeMock.mockResolvedValueOnce({
      user: {
        id: "user-1",
        email: "user@example.com",
        timezone: "UTC",
        reminderPreferences: { emailEnabled: true, reminderLeadHours: 24 }
      }
    });

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    expect(await screen.findByText("user@example.com")).toBeInTheDocument();
    expect(refreshAuthMock).toHaveBeenCalledWith({ refreshToken: "refresh-token" });
    expect(localStorage.getItem(STORAGE_KEY)).toContain("new-access");
  });

  it("logs in and revokes refresh token on logout", async () => {
    const user = userEvent.setup();

    loginMock.mockResolvedValue({
      user: {
        id: "user-1",
        email: "user@example.com",
        timezone: "UTC",
        reminderPreferences: { emailEnabled: true, reminderLeadHours: 24 }
      },
      tokens: {
        accessToken: "access-token",
        refreshToken: "refresh-token"
      }
    });
    logoutAuthMock.mockResolvedValue({});

    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    );

    expect(await screen.findByText("no-user")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "do-login" }));
    expect(await screen.findByText("user@example.com")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "do-logout" }));
    await waitFor(() => expect(logoutAuthMock).toHaveBeenCalledWith({ refreshToken: "refresh-token" }));
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByText("no-user")).toBeInTheDocument();
  });
});

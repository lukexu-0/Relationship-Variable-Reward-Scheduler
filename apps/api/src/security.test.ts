import request from "supertest";
import { describe, expect, it } from "vitest";

import "./test/setup.js";
import "./test/mocks.js";

import { createApp } from "./app.js";

const app = createApp();

describe("API security regression", () => {
  it("blocks disallowed CORS origins and allows configured origin", async () => {
    const forbidden = await request(app).get("/healthz").set("Origin", "https://evil.example");
    expect(forbidden.status).toBe(403);

    const allowed = await request(app).get("/healthz").set("Origin", "http://localhost:5173");
    expect(allowed.status).toBe(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("rejects malformed bearer token variants", async () => {
    const missingTokenValue = await request(app).get("/api/v1/profiles").set("authorization", "Bearer    ");
    expect(missingTokenValue.status).toBe(401);

    const wrongScheme = await request(app).get("/api/v1/profiles").set("authorization", "bearer token");
    expect(wrongScheme.status).toBe(401);
  });

  it("rejects NoSQL-style object payload injection attempts", async () => {
    const registerInjection = await request(app).post("/api/v1/auth/register").send({
      email: { $gt: "" },
      password: "StrongPassword123",
      timezone: "UTC"
    });
    expect(registerInjection.status).toBe(400);

    const auth = await registerAndLogin("security-event-config@example.com");
    const profile = await request(app)
      .post("/api/v1/profiles")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ profileName: "SecurityProfile" });
    expect(profile.status).toBe(201);

    const eventConfigInjection = await request(app)
      .post(`/api/v1/profiles/${profile.body.profile._id as string}/event-configs`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        name: "Injected",
        slug: { $ne: "" },
        baseIntervalDays: 7,
        jitterPct: 0.1,
        enabled: true
      });
    expect(eventConfigInjection.status).toBe(400);
  });

  it("prevents profile mass-assignment via unknown create payload fields", async () => {
    const auth = await registerAndLogin("security-mass-assignment@example.com");

    const created = await request(app)
      .post("/api/v1/profiles")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        profileName: "MassAssignment",
        active: false,
        userId: "attacker-controlled"
      });

    expect(created.status).toBe(201);
    expect(created.body.profile.active).toBe(true);
    expect(created.body.profile.userId).not.toBe("attacker-controlled");
  });
});

async function registerAndLogin(email: string): Promise<{ accessToken: string; refreshToken: string }> {
  const register = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "StrongPassword123",
    timezone: "UTC"
  });

  return {
    accessToken: register.body.tokens.accessToken as string,
    refreshToken: register.body.tokens.refreshToken as string
  };
}

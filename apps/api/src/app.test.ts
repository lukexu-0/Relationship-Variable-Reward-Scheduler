import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";

import "./test/setup.js";
import "./test/mocks.js";

import { createApp } from "./app.js";
import { queueReminderMock, removeReminderJobsForEventMock, recomputeSchedulerStateMock } from "./test/mocks.js";

const app = createApp();

describe("API end-to-end", () => {
  beforeEach(() => {
    queueReminderMock.mockClear();
    removeReminderJobsForEventMock.mockClear();
    recomputeSchedulerStateMock.mockClear();
  });

  it("responds to health endpoint", async () => {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it("supports auth register/login/me/refresh/logout flow", async () => {
    const register = await request(app).post("/api/v1/auth/register").send({
      email: "user@example.com",
      password: "StrongPassword123",
      timezone: "America/New_York"
    });

    expect(register.status).toBe(201);
    expect(register.body.user.email).toBe("user@example.com");

    const accessToken = register.body.tokens.accessToken as string;
    const refreshToken = register.body.tokens.refreshToken as string;

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("authorization", `Bearer ${accessToken}`);

    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("user@example.com");

    const refreshed = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(refreshed.status).toBe(200);
    expect(typeof refreshed.body.tokens.accessToken).toBe("string");

    const logout = await request(app).post("/api/v1/auth/logout").send({ refreshToken });
    expect(logout.status).toBe(204);
  });

  it("rejects duplicate registration and unknown-user login", async () => {
    const payload = {
      email: "duplicate@example.com",
      password: "StrongPassword123",
      timezone: "UTC"
    };

    const first = await request(app).post("/api/v1/auth/register").send(payload);
    expect(first.status).toBe(201);

    const second = await request(app).post("/api/v1/auth/register").send(payload);
    expect(second.status).toBe(409);

    const unknownLogin = await request(app).post("/api/v1/auth/login").send({
      email: "nobody@example.com",
      password: "StrongPassword123"
    });
    expect(unknownLogin.status).toBe(401);
  });

  it("rejects invalid or missing auth on /me", async () => {
    const missing = await request(app).get("/api/v1/auth/me");
    expect(missing.status).toBe(401);

    const invalid = await request(app)
      .get("/api/v1/auth/me")
      .set("authorization", "Bearer not-a-valid-jwt");
    expect(invalid.status).toBe(401);
  });

  it("rejects invalid credentials", async () => {
    await request(app).post("/api/v1/auth/register").send({
      email: "wrong@example.com",
      password: "StrongPassword123",
      timezone: "UTC"
    });

    const login = await request(app).post("/api/v1/auth/login").send({
      email: "wrong@example.com",
      password: "WrongPassword"
    });

    expect(login.status).toBe(401);
  });

  it("creates and lists profiles with default templates", async () => {
    const auth = await registerAndLogin("profiles@example.com");

    const created = await request(app)
      .post("/api/v1/profiles")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ profileName: "Main", partnerName: "Alex" });

    expect(created.status).toBe(201);
    expect(created.body.profile.profileName).toBe("Main");

    const profiles = await request(app)
      .get("/api/v1/profiles")
      .set("authorization", `Bearer ${auth.accessToken}`);

    expect(profiles.status).toBe(200);
    expect(profiles.body.profiles).toHaveLength(1);

    const profileId = created.body.profile._id as string;
    const templates = await request(app)
      .get(`/api/v1/profiles/${profileId}/templates`)
      .set("authorization", `Bearer ${auth.accessToken}`);

    expect(templates.status).toBe(200);
    expect(templates.body.templates.length).toBeGreaterThanOrEqual(4);

    const settings = await request(app)
      .get(`/api/v1/profiles/${profileId}/schedule-settings`)
      .set("authorization", `Bearer ${auth.accessToken}`);

    expect(settings.status).toBe(200);
    expect(settings.body.settings.timezone).toBe("UTC");
  });

  it("supports custom template create and update", async () => {
    const auth = await registerAndLogin("template@example.com");
    const profile = await createProfile(auth.accessToken, "TemplateProfile");

    const createTemplate = await request(app)
      .post(`/api/v1/profiles/${profile.id}/templates`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        name: "surprise_gift",
        category: "surprise",
        baseIntervalDays: 9,
        jitterPct: 0.25,
        enabled: true
      });

    expect(createTemplate.status).toBe(201);

    const templateId = createTemplate.body.template._id as string;
    const updateTemplate = await request(app)
      .patch(`/api/v1/templates/${templateId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ baseIntervalDays: 12, enabled: false });

    expect(updateTemplate.status).toBe(200);
    expect(updateTemplate.body.template.baseIntervalDays).toBe(12);
    expect(updateTemplate.body.template.enabled).toBe(false);
  });

  it("returns 404 for missing template updates", async () => {
    const auth = await registerAndLogin("template-missing@example.com");
    const missingId = new mongoose.Types.ObjectId().toString();

    const updateTemplate = await request(app)
      .patch(`/api/v1/templates/${missingId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ baseIntervalDays: 12 });

    expect(updateTemplate.status).toBe(404);
  });

  it("updates schedule settings", async () => {
    const auth = await registerAndLogin("settings@example.com");
    const profile = await createProfile(auth.accessToken, "SettingsProfile");

    const update = await request(app)
      .put(`/api/v1/profiles/${profile.id}/schedule-settings`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        timezone: "America/Los_Angeles",
        reminderLeadHours: 12,
        minGapHours: 36,
        allowedWindows: [{ weekday: 2, startLocalTime: "17:00", endLocalTime: "20:00" }],
        blackoutDates: [{ startAt: new Date("2026-02-14T00:00:00.000Z").toISOString(), allDay: true }]
      });

    expect(update.status).toBe(200);
    expect(update.body.settings.timezone).toBe("America/Los_Angeles");
    expect(update.body.settings.reminderLeadHours).toBe(12);
  });

  it("updates profile fields with PATCH", async () => {
    const auth = await registerAndLogin("profile-patch@example.com");
    const profile = await createProfile(auth.accessToken, "PatchMe");

    const patch = await request(app)
      .patch(`/api/v1/profiles/${profile.id}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ profileName: "Patched", partnerName: "Jordan", active: false });

    expect(patch.status).toBe(200);
    expect(patch.body.profile.profileName).toBe("Patched");
    expect(patch.body.profile.partnerName).toBe("Jordan");
    expect(patch.body.profile.active).toBe(false);
  });

  it("handles event create/list/complete/miss/options/apply/reschedule", async () => {
    const auth = await registerAndLogin("events@example.com");
    const profile = await createProfile(auth.accessToken, "EventsProfile");
    const templateId = await getTemplateId(auth.accessToken, profile.id);

    const createEvent = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        templateId,
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        notes: "Bring flowers"
      });

    expect(createEvent.status).toBe(201);
    const eventId = createEvent.body.event._id as string;
    expect(queueReminderMock).toHaveBeenCalled();

    const listEvents = await request(app)
      .get(`/api/v1/profiles/${profile.id}/events?from=2020-01-01T00:00:00.000Z&to=2100-01-01T00:00:00.000Z`)
      .set("authorization", `Bearer ${auth.accessToken}`);
    expect(listEvents.status).toBe(200);
    expect(listEvents.body.events).toHaveLength(1);

    const complete = await request(app)
      .patch(`/api/v1/events/${eventId}/complete`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ sentimentLevel: "VERY_WELL", notes: "Great response" });
    expect(complete.status).toBe(200);
    expect(complete.body.event.status).toBe("COMPLETED");
    expect(removeReminderJobsForEventMock).toHaveBeenCalled();
    expect(recomputeSchedulerStateMock).toHaveBeenCalled();

    const miss = await request(app)
      .patch(`/api/v1/events/${eventId}/miss`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ reason: "Travel conflict" });
    expect(miss.status).toBe(200);
    expect(miss.body.event.status).toBe("MISSED");
    expect(miss.body.options).toHaveLength(2);
    expect(miss.body.options[0].profileId).toBe(profile.id);

    const options = await request(app)
      .get(`/api/v1/events/${eventId}/missed-options`)
      .set("authorization", `Bearer ${auth.accessToken}`);
    expect(options.status).toBe(200);

    const applied = await request(app)
      .post(`/api/v1/events/${eventId}/missed-options/option-asap/apply`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ reason: "Apply ASAP" });
    expect(applied.status).toBe(200);
    expect(applied.body.event.status).toBe("RESCHEDULED");

    const manual = await request(app)
      .patch(`/api/v1/events/${eventId}/reschedule`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        reason: "Manual adjustment"
      });
    expect(manual.status).toBe(200);
    expect(manual.body.event.adjustments.length).toBeGreaterThan(0);
  });

  it("supports event patch edits and hard delete", async () => {
    const auth = await registerAndLogin("event-edit-delete@example.com");
    const profile = await createProfile(auth.accessToken, "EditDeleteProfile");
    const templateId = await getTemplateId(auth.accessToken, profile.id);
    const initialScheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const create = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        templateId,
        scheduledAt: initialScheduledAt,
        notes: "Initial note"
      });
    expect(create.status).toBe(201);
    const eventId = create.body.event._id as string;

    const notesOnly = await request(app)
      .patch(`/api/v1/events/${eventId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ notes: "Updated notes" });
    expect(notesOnly.status).toBe(200);
    expect(notesOnly.body.event.notes).toBe("Updated notes");

    const missingReason = await request(app)
      .patch(`/api/v1/events/${eventId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        scheduledAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
      });
    expect(missingReason.status).toBe(400);

    const withReason = await request(app)
      .patch(`/api/v1/events/${eventId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
        reason: "Move it out",
        notes: "Moved"
      });
    expect(withReason.status).toBe(200);
    expect(withReason.body.event.adjustments.length).toBeGreaterThan(0);
    expect(withReason.body.event.notes).toBe("Moved");

    const removed = await request(app)
      .delete(`/api/v1/events/${eventId}`)
      .set("authorization", `Bearer ${auth.accessToken}`);
    expect(removed.status).toBe(204);

    const list = await request(app)
      .get(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`);
    expect(list.status).toBe(200);
    expect(list.body.events).toHaveLength(0);
  });

  it("returns 409 when creating a second active upcoming event for the same category", async () => {
    const auth = await registerAndLogin("event-category-conflict@example.com");
    const profile = await createProfile(auth.accessToken, "EventConflictProfile");
    const templateId = await getTemplateId(auth.accessToken, profile.id);
    const soon = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const first = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ templateId, scheduledAt: soon });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        templateId,
        scheduledAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      });
    expect(second.status).toBe(409);
    expect(second.body.error.details.code).toBe("CATEGORY_UPCOMING_EXISTS");
  });

  it("returns 409 when applying missed options would violate category upcoming uniqueness", async () => {
    const auth = await registerAndLogin("event-missed-conflict@example.com");
    const profile = await createProfile(auth.accessToken, "MissedConflictProfile");
    const templateId = await getTemplateId(auth.accessToken, profile.id);

    const createUpcoming = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        templateId,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    expect(createUpcoming.status).toBe(201);

    const createPast = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        templateId,
        scheduledAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      });
    expect(createPast.status).toBe(201);
    const pastEventId = createPast.body.event._id as string;

    const missPast = await request(app)
      .patch(`/api/v1/events/${pastEventId}/miss`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ reason: "missed past" });
    expect(missPast.status).toBe(200);

    const apply = await request(app)
      .post(`/api/v1/events/${pastEventId}/missed-options/option-asap/apply`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ reason: "Try ASAP" });
    expect(apply.status).toBe(409);
    expect(apply.body.error.details.code).toBe("CATEGORY_UPCOMING_EXISTS");
  });

  it("returns 409 when creating or patching templates with duplicate categories", async () => {
    const auth = await registerAndLogin("template-category-conflict@example.com");
    const profile = await createProfile(auth.accessToken, "TemplateConflictProfile");

    const duplicateCreate = await request(app)
      .post(`/api/v1/profiles/${profile.id}/templates`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        name: "gift_duplicate",
        category: "gift",
        baseIntervalDays: 12,
        jitterPct: 0.2,
        enabled: true
      });
    expect(duplicateCreate.status).toBe(409);
    expect(duplicateCreate.body.error.details.code).toBe("TEMPLATE_CATEGORY_EXISTS");

    const created = await request(app)
      .post(`/api/v1/profiles/${profile.id}/templates`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        name: "weekend_trip",
        category: "trip",
        baseIntervalDays: 12,
        jitterPct: 0.2,
        enabled: true
      });
    expect(created.status).toBe(201);

    const patchDuplicate = await request(app)
      .patch(`/api/v1/templates/${created.body.template._id as string}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ category: "gift" });
    expect(patchDuplicate.status).toBe(409);
    expect(patchDuplicate.body.error.details.code).toBe("TEMPLATE_CATEGORY_EXISTS");
  });

  it("returns 404 when creating event with missing template", async () => {
    const auth = await registerAndLogin("event-missing-template@example.com");
    const profile = await createProfile(auth.accessToken, "EventsMissingTemplate");
    const missingTemplateId = new mongoose.Types.ObjectId().toString();

    const create = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        templateId: missingTemplateId,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

    expect(create.status).toBe(404);
  });

  it("returns 404 for unknown event completion", async () => {
    const auth = await registerAndLogin("event-unknown@example.com");
    const unknownEventId = new mongoose.Types.ObjectId().toString();

    const complete = await request(app)
      .patch(`/api/v1/events/${unknownEventId}/complete`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ sentimentLevel: "WELL" });

    expect(complete.status).toBe(404);
  });

  it("enforces ownership boundaries between users", async () => {
    const userA = await registerAndLogin("owner-a@example.com");
    const userB = await registerAndLogin("owner-b@example.com");
    const profileA = await createProfile(userA.accessToken, "PrivateProfile");

    const forbidden = await request(app)
      .get(`/api/v1/profiles/${profileA.id}/templates`)
      .set("authorization", `Bearer ${userB.accessToken}`);

    expect(forbidden.status).toBe(404);
  });

  it("rejects invalid payloads and missing auth", async () => {
    const noAuth = await request(app).get("/api/v1/profiles");
    expect(noAuth.status).toBe(401);

    const auth = await registerAndLogin("validation@example.com");
    const badProfile = await request(app)
      .post("/api/v1/profiles")
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ profileName: "" });

    expect(badProfile.status).toBe(400);
  });

  it("returns 404 when missed option id is unknown", async () => {
    const auth = await registerAndLogin("missing-option@example.com");
    const profile = await createProfile(auth.accessToken, "OptionProfile");
    const templateId = await getTemplateId(auth.accessToken, profile.id);

    const event = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        templateId,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

    const eventId = event.body.event._id as string;

    const miss = await request(app)
      .patch(`/api/v1/events/${eventId}/miss`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ reason: "test miss" });
    expect(miss.status).toBe(200);

    const applyUnknown = await request(app)
      .post(`/api/v1/events/${eventId}/missed-options/does-not-exist/apply`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ reason: "test" });

    expect(applyUnknown.status).toBe(404);
  });

  it("rejects missed options access for non-missed events", async () => {
    const auth = await registerAndLogin("missed-state-guard@example.com");
    const profile = await createProfile(auth.accessToken, "GuardProfile");
    const templateId = await getTemplateId(auth.accessToken, profile.id);

    const event = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        templateId,
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });
    const eventId = event.body.event._id as string;

    const optionsBeforeMiss = await request(app)
      .get(`/api/v1/events/${eventId}/missed-options`)
      .set("authorization", `Bearer ${auth.accessToken}`);
    expect(optionsBeforeMiss.status).toBe(400);

    const applyBeforeMiss = await request(app)
      .post(`/api/v1/events/${eventId}/missed-options/option-asap/apply`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ reason: "invalid" });
    expect(applyBeforeMiss.status).toBe(400);
  });

  it("rejects refresh token reuse after revocation", async () => {
    const register = await request(app).post("/api/v1/auth/register").send({
      email: "reuse-refresh@example.com",
      password: "StrongPassword123",
      timezone: "UTC"
    });

    const refreshToken = register.body.tokens.refreshToken;
    const firstRefresh = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(firstRefresh.status).toBe(200);

    const secondRefresh = await request(app).post("/api/v1/auth/refresh").send({ refreshToken });
    expect(secondRefresh.status).toBe(401);
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

async function createProfile(
  accessToken: string,
  profileName: string
): Promise<{ id: string }> {
  const profile = await request(app)
    .post("/api/v1/profiles")
    .set("authorization", `Bearer ${accessToken}`)
    .send({ profileName });

  return { id: profile.body.profile._id as string };
}

async function getTemplateId(accessToken: string, profileId: string): Promise<string> {
  const templates = await request(app)
    .get(`/api/v1/profiles/${profileId}/templates`)
    .set("authorization", `Bearer ${accessToken}`);

  return templates.body.templates[0]._id as string;
}

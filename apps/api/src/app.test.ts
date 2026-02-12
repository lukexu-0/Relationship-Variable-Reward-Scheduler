import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";

import "./test/setup.js";
import "./test/mocks.js";

import { createApp } from "./app.js";
import {
  enqueueProfileScheduleGenerationMock,
  queueReminderMock,
  removeReminderJobsForEventMock,
  recomputeSchedulerStateMock
} from "./test/mocks.js";

const app = createApp();

describe("API end-to-end", () => {
  beforeEach(() => {
    queueReminderMock.mockClear();
    removeReminderJobsForEventMock.mockClear();
    recomputeSchedulerStateMock.mockClear();
    enqueueProfileScheduleGenerationMock.mockClear();
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

  it("creates and lists profiles with default event configs", async () => {
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
    const eventConfigs = await request(app)
      .get(`/api/v1/profiles/${profileId}/event-configs`)
      .set("authorization", `Bearer ${auth.accessToken}`);

    expect(eventConfigs.status).toBe(200);
    expect(eventConfigs.body.eventConfigs.length).toBeGreaterThanOrEqual(4);

    const settings = await request(app)
      .get(`/api/v1/profiles/${profileId}/schedule-settings`)
      .set("authorization", `Bearer ${auth.accessToken}`);

    expect(settings.status).toBe(200);
    expect(settings.body.settings.timezone).toBe("UTC");
  });

  it("supports custom event config create and update", async () => {
    const auth = await registerAndLogin("template@example.com");
    const profile = await createProfile(auth.accessToken, "TemplateProfile");

    const createEventConfig = await request(app)
      .post(`/api/v1/profiles/${profile.id}/event-configs`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        name: "surprise gift",
        slug: "surprise-gift",
        baseIntervalDays: 9,
        jitterPct: 0.25,
        enabled: true
      });

    expect(createEventConfig.status).toBe(201);

    const eventConfigId = createEventConfig.body.eventConfig._id as string;
    const updateEventConfig = await request(app)
      .patch(`/api/v1/event-configs/${eventConfigId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ baseIntervalDays: 12, enabled: false });

    expect(updateEventConfig.status).toBe(200);
    expect(updateEventConfig.body.eventConfig.baseIntervalDays).toBe(12);
    expect(updateEventConfig.body.eventConfig.enabled).toBe(false);
  });

  it("returns 404 for missing event config updates", async () => {
    const auth = await registerAndLogin("event-config-missing@example.com");
    const missingId = new mongoose.Types.ObjectId().toString();

    const updateEventConfig = await request(app)
      .patch(`/api/v1/event-configs/${missingId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ baseIntervalDays: 12 });

    expect(updateEventConfig.status).toBe(404);
  });

  it("updates event config jitter and returns 404 for missing event config delete", async () => {
    const auth = await registerAndLogin("event-config-jitter-delete@example.com");
    const profile = await createProfile(auth.accessToken, "EventConfigJitterDeleteProfile");

    const created = await request(app)
      .post(`/api/v1/profiles/${profile.id}/event-configs`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        name: "jitter candidate",
        slug: "jitter-candidate",
        baseIntervalDays: 9,
        jitterPct: 0.15,
        enabled: true
      });
    expect(created.status).toBe(201);

    const eventConfigId = created.body.eventConfig._id as string;
    const updated = await request(app)
      .patch(`/api/v1/event-configs/${eventConfigId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ jitterPct: 0.35 });
    expect(updated.status).toBe(200);
    expect(updated.body.eventConfig.jitterPct).toBe(0.35);

    const missingId = new mongoose.Types.ObjectId().toString();
    const missingDelete = await request(app)
      .delete(`/api/v1/event-configs/${missingId}`)
      .set("authorization", `Bearer ${auth.accessToken}`);
    expect(missingDelete.status).toBe(404);
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
        recurringBlackoutWeekdays: [0],
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
    const eventConfigId = await getEventConfigId(auth.accessToken, profile.id);
    const scheduledSoon = toDateAndTime(Date.now() + 48 * 60 * 60 * 1000);

    const createEvent = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        eventConfigId,
        scheduledDate: scheduledSoon.scheduledDate,
        scheduledTime: scheduledSoon.scheduledTime,
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
        ...toDateAndTime(Date.now() + 72 * 60 * 60 * 1000),
        reason: "Manual adjustment"
      });
    expect(manual.status).toBe(200);
    expect(manual.body.event.adjustments.length).toBeGreaterThan(0);
  });

  it("supports event patch edits and hard delete", async () => {
    const auth = await registerAndLogin("event-edit-delete@example.com");
    const profile = await createProfile(auth.accessToken, "EditDeleteProfile");
    const eventConfigId = await getEventConfigId(auth.accessToken, profile.id);
    const initialScheduled = toDateAndTime(Date.now() + 24 * 60 * 60 * 1000);

    const create = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        eventConfigId,
        ...initialScheduled,
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
      .send(toDateAndTime(Date.now() + 48 * 60 * 60 * 1000));
    expect(missingReason.status).toBe(400);

    const withReason = await request(app)
      .patch(`/api/v1/events/${eventId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        ...toDateAndTime(Date.now() + 72 * 60 * 60 * 1000),
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

  it("supports date-only creation and schedule time-only edits", async () => {
    const auth = await registerAndLogin("event-date-only@example.com");
    const profile = await createProfile(auth.accessToken, "DateOnlyProfile");
    const eventConfigId = await getEventConfigId(auth.accessToken, profile.id);
    const target = Date.now() + 48 * 60 * 60 * 1000;
    const targetDate = toDateOnly(target);

    const settingsUpdate = await request(app)
      .put(`/api/v1/profiles/${profile.id}/schedule-settings`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        timezone: "Not/A_Real_Timezone",
        reminderLeadHours: 6,
        minGapHours: 24,
        allowedWindows: [
          { weekday: 0, startLocalTime: "08:15", endLocalTime: "22:00" },
          { weekday: 1, startLocalTime: "08:15", endLocalTime: "22:00" },
          { weekday: 2, startLocalTime: "08:15", endLocalTime: "22:00" },
          { weekday: 3, startLocalTime: "08:15", endLocalTime: "22:00" },
          { weekday: 4, startLocalTime: "08:15", endLocalTime: "22:00" },
          { weekday: 5, startLocalTime: "08:15", endLocalTime: "22:00" },
          { weekday: 6, startLocalTime: "08:15", endLocalTime: "22:00" }
        ],
        recurringBlackoutWeekdays: [],
        blackoutDates: []
      });
    expect(settingsUpdate.status).toBe(200);

    const create = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        eventConfigId,
        scheduledDate: targetDate,
        notes: "No explicit time"
      });
    expect(create.status).toBe(201);
    expect(create.body.event.hasExplicitTime).toBe(false);

    const eventId = create.body.event._id as string;
    const patchTimeOnly = await request(app)
      .patch(`/api/v1/events/${eventId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        scheduledTime: "11:45",
        reason: "Add exact time"
      });
    expect(patchTimeOnly.status).toBe(200);
    expect(patchTimeOnly.body.event.hasExplicitTime).toBe(true);
    expect(patchTimeOnly.body.event.adjustments.length).toBeGreaterThan(0);
  });

  it("updates derived slug when patching event config name and deletes event configs", async () => {
    const auth = await registerAndLogin("event-config-patch-delete@example.com");
    const profile = await createProfile(auth.accessToken, "ConfigPatchDeleteProfile");

    const created = await request(app)
      .post(`/api/v1/profiles/${profile.id}/event-configs`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        name: "Custom Plan",
        slug: "custom-plan",
        baseIntervalDays: 8,
        jitterPct: 0.2,
        enabled: true
      });
    expect(created.status).toBe(201);
    const eventConfigId = created.body.eventConfig._id as string;

    const renamed = await request(app)
      .patch(`/api/v1/event-configs/${eventConfigId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ name: "Weekly Ritual" });
    expect(renamed.status).toBe(200);
    expect(renamed.body.eventConfig.slug).toBe("weekly-ritual");

    const eventCreated = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        eventConfigId,
        ...toDateAndTime(Date.now() + 24 * 60 * 60 * 1000)
      });
    expect(eventCreated.status).toBe(201);

    const deleted = await request(app)
      .delete(`/api/v1/event-configs/${eventConfigId}`)
      .set("authorization", `Bearer ${auth.accessToken}`);
    expect(deleted.status).toBe(204);

    const listConfigs = await request(app)
      .get(`/api/v1/profiles/${profile.id}/event-configs`)
      .set("authorization", `Bearer ${auth.accessToken}`);
    expect(listConfigs.status).toBe(200);
    expect(listConfigs.body.eventConfigs.find((config: { _id: string }) => config._id === eventConfigId)).toBeFalsy();

    const listEvents = await request(app)
      .get(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`);
    expect(listEvents.status).toBe(200);
    expect(listEvents.body.events.find((event: { eventConfigId?: string }) => event.eventConfigId === eventConfigId)).toBeFalsy();
  });

  it("does not queue reminders when schedule changes on non-upcoming statuses", async () => {
    const auth = await registerAndLogin("event-completed-edit@example.com");
    const profile = await createProfile(auth.accessToken, "CompletedEditProfile");
    const eventConfigId = await getEventConfigId(auth.accessToken, profile.id);

    const createEvent = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        eventConfigId,
        ...toDateAndTime(Date.now() + 24 * 60 * 60 * 1000)
      });
    expect(createEvent.status).toBe(201);
    const eventId = createEvent.body.event._id as string;

    const complete = await request(app)
      .patch(`/api/v1/events/${eventId}/complete`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ sentimentLevel: "WELL" });
    expect(complete.status).toBe(200);

    queueReminderMock.mockClear();

    const changeSchedule = await request(app)
      .patch(`/api/v1/events/${eventId}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        ...toDateAndTime(Date.now() + 48 * 60 * 60 * 1000),
        reason: "Administrative correction"
      });
    expect(changeSchedule.status).toBe(200);
    expect(queueReminderMock).not.toHaveBeenCalled();
  });

  it("returns 409 when creating a second active upcoming event for the same event config", async () => {
    const auth = await registerAndLogin("event-config-conflict@example.com");
    const profile = await createProfile(auth.accessToken, "EventConflictProfile");
    const eventConfigId = await getEventConfigId(auth.accessToken, profile.id);
    const soon = toDateAndTime(Date.now() + 24 * 60 * 60 * 1000);

    const first = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ eventConfigId, ...soon });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        eventConfigId,
        ...toDateAndTime(Date.now() + 72 * 60 * 60 * 1000)
      });
    expect(second.status).toBe(409);
    expect(second.body.error.details.code).toBe("EVENT_CONFIG_UPCOMING_EXISTS");
  });

  it("returns 409 when applying missed options would violate event-config upcoming uniqueness", async () => {
    const auth = await registerAndLogin("event-missed-conflict@example.com");
    const profile = await createProfile(auth.accessToken, "MissedConflictProfile");
    const eventConfigId = await getEventConfigId(auth.accessToken, profile.id);

    const createUpcoming = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        eventConfigId,
        ...toDateAndTime(Date.now() + 24 * 60 * 60 * 1000)
      });
    expect(createUpcoming.status).toBe(201);

    const createPast = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        eventConfigId,
        ...toDateAndTime(Date.now() - 24 * 60 * 60 * 1000)
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
    expect(apply.body.error.details.code).toBe("EVENT_CONFIG_UPCOMING_EXISTS");
  });

  it("returns 409 when creating or patching event configs with duplicate slugs", async () => {
    const auth = await registerAndLogin("event-config-slug-conflict@example.com");
    const profile = await createProfile(auth.accessToken, "EventConfigConflictProfile");

    const duplicateCreate = await request(app)
      .post(`/api/v1/profiles/${profile.id}/event-configs`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        name: "gift duplicate",
        slug: "flowers",
        baseIntervalDays: 12,
        jitterPct: 0.2,
        enabled: true
      });
    expect(duplicateCreate.status).toBe(409);
    expect(duplicateCreate.body.error.details.code).toBe("EVENT_CONFIG_SLUG_EXISTS");

    const created = await request(app)
      .post(`/api/v1/profiles/${profile.id}/event-configs`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        name: "weekend trip",
        slug: "trip",
        baseIntervalDays: 12,
        jitterPct: 0.2,
        enabled: true
      });
    expect(created.status).toBe(201);

    const patchDuplicate = await request(app)
      .patch(`/api/v1/event-configs/${created.body.eventConfig._id as string}`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({ slug: "flowers" });
    expect(patchDuplicate.status).toBe(409);
    expect(patchDuplicate.body.error.details.code).toBe("EVENT_CONFIG_SLUG_EXISTS");
  });

  it("returns 404 when creating event with missing event config", async () => {
    const auth = await registerAndLogin("event-missing-config@example.com");
    const profile = await createProfile(auth.accessToken, "EventsMissingConfig");
    const missingEventConfigId = new mongoose.Types.ObjectId().toString();

    const create = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        eventConfigId: missingEventConfigId,
        ...toDateAndTime(Date.now() + 24 * 60 * 60 * 1000)
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
      .get(`/api/v1/profiles/${profileA.id}/event-configs`)
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
    const eventConfigId = await getEventConfigId(auth.accessToken, profile.id);

    const event = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        eventConfigId,
        ...toDateAndTime(Date.now() + 24 * 60 * 60 * 1000)
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
    const eventConfigId = await getEventConfigId(auth.accessToken, profile.id);

    const event = await request(app)
      .post(`/api/v1/profiles/${profile.id}/events`)
      .set("authorization", `Bearer ${auth.accessToken}`)
      .send({
        eventConfigId,
        ...toDateAndTime(Date.now() + 24 * 60 * 60 * 1000)
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

async function getEventConfigId(accessToken: string, profileId: string): Promise<string> {
  const eventConfigs = await request(app)
    .get(`/api/v1/profiles/${profileId}/event-configs`)
    .set("authorization", `Bearer ${accessToken}`);

  return eventConfigs.body.eventConfigs[0]._id as string;
}

function toDateAndTime(timestampMs: number): { scheduledDate: string; scheduledTime: string } {
  const value = new Date(timestampMs);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  return {
    scheduledDate: `${year}-${month}-${day}`,
    scheduledTime: `${hours}:${minutes}`
  };
}

function toDateOnly(timestampMs: number): string {
  const value = new Date(timestampMs);
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

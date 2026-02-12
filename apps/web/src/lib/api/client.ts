import type { SentimentLevel } from "@reward/shared-types";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  timezone: string;
  reminderPreferences: {
    emailEnabled: boolean;
    reminderLeadHours: number;
  };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json");
  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = body?.error?.message ?? `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export async function register(payload: { email: string; password: string; timezone: string }) {
  return request<{ user: AuthUser; tokens: { accessToken: string; refreshToken: string } }>(
    "/api/v1/auth/register",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function login(payload: { email: string; password: string }) {
  return request<{ user: AuthUser; tokens: { accessToken: string; refreshToken: string } }>(
    "/api/v1/auth/login",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function refreshAuth(payload: { refreshToken: string }) {
  return request<{ tokens: { accessToken: string; refreshToken: string } }>(
    "/api/v1/auth/refresh",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function logoutAuth(payload: { refreshToken: string }) {
  return request<{}>(
    "/api/v1/auth/logout",
    {
      method: "POST",
      body: JSON.stringify(payload)
    }
  );
}

export async function getMe(accessToken: string) {
  return request<{ user: AuthUser }>("/api/v1/auth/me", { method: "GET" }, accessToken);
}

export async function getProfiles(accessToken: string) {
  return request<{ profiles: Array<{ _id: string; profileName: string; partnerName?: string; active: boolean }> }>(
    "/api/v1/profiles",
    {},
    accessToken
  );
}

export async function createProfile(
  accessToken: string,
  payload: { profileName: string; partnerName?: string }
) {
  return request<{ profile: { _id: string; profileName: string; partnerName?: string; active: boolean } }>(
    "/api/v1/profiles",
    { method: "POST", body: JSON.stringify(payload) },
    accessToken
  );
}

export async function getEventConfigs(accessToken: string, profileId: string) {
  return request<{
    eventConfigs: Array<{
      _id: string;
      name: string;
      slug: string;
      baseIntervalDays: number;
      jitterPct: number;
      enabled: boolean;
      createdAt?: string;
      updatedAt?: string;
    }>;
  }>(`/api/v1/profiles/${profileId}/event-configs`, {}, accessToken);
}

export async function createEventConfig(
  accessToken: string,
  profileId: string,
  payload: {
    name: string;
    slug: string;
    baseIntervalDays: number;
    jitterPct: number;
    enabled: boolean;
  }
) {
  return request<{
    eventConfig: {
      _id: string;
      name: string;
      slug: string;
      baseIntervalDays: number;
      jitterPct: number;
      enabled: boolean;
    };
  }>(
    `/api/v1/profiles/${profileId}/event-configs`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    accessToken
  );
}

export async function updateEventConfig(
  accessToken: string,
  eventConfigId: string,
  payload: Partial<{
    name: string;
    slug: string;
    baseIntervalDays: number;
    jitterPct: number;
    enabled: boolean;
  }>
) {
  return request<{ eventConfig: { _id: string; name: string; slug: string } }>(
    `/api/v1/event-configs/${eventConfigId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    accessToken
  );
}

export async function deleteEventConfig(accessToken: string, eventConfigId: string) {
  return request<{}>(
    `/api/v1/event-configs/${eventConfigId}`,
    {
      method: "DELETE"
    },
    accessToken
  );
}

export async function getScheduleSettings(accessToken: string, profileId: string) {
  return request<{
    settings: {
      timezone: string;
      reminderLeadHours: number;
      minGapHours: number;
      allowedWindows: Array<{ weekday: number; startLocalTime: string; endLocalTime: string }>;
      recurringBlackoutWeekdays: number[];
      blackoutDates: Array<{ startAt: string; endAt?: string; allDay?: boolean; note?: string }>;
    } | null;
  }>(`/api/v1/profiles/${profileId}/schedule-settings`, {}, accessToken);
}

export async function updateScheduleSettings(
  accessToken: string,
  profileId: string,
  payload: {
    timezone: string;
    reminderLeadHours: number;
    minGapHours: number;
    allowedWindows: Array<{ weekday: number; startLocalTime: string; endLocalTime: string }>;
    recurringBlackoutWeekdays: number[];
    blackoutDates: Array<{ startAt: string; endAt?: string; allDay?: boolean; note?: string }>;
  }
) {
  return request<{ settings: unknown }>(
    `/api/v1/profiles/${profileId}/schedule-settings`,
    {
      method: "PUT",
      body: JSON.stringify(payload)
    },
    accessToken
  );
}

export async function getEvents(accessToken: string, profileId: string) {
  return request<{
    events: Array<{
      _id: string;
      eventConfigId: string;
      scheduledAt: string;
      originalScheduledAt: string;
      hasExplicitTime: boolean;
      status: string;
      notes?: string;
      adjustments: Array<{
        fromAt: string;
        toAt: string;
        reason: string;
        adjustedByUserId: string;
        adjustedAt: string;
      }>;
    }>;
  }>(`/api/v1/profiles/${profileId}/events`, {}, accessToken);
}

export async function createEvent(
  accessToken: string,
  profileId: string,
  payload: { eventConfigId: string; scheduledDate: string; scheduledTime?: string; notes?: string }
) {
  return request<{ event: { _id: string } }>(
    `/api/v1/profiles/${profileId}/events`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    accessToken
  );
}

export async function completeEvent(
  accessToken: string,
  eventId: string,
  payload: { sentimentLevel: SentimentLevel; notes?: string }
) {
  return request<{ event: { _id: string; status: string } }>(
    `/api/v1/events/${eventId}/complete`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    accessToken
  );
}

export async function missEvent(accessToken: string, eventId: string, payload: { reason?: string }) {
  return request<{
    event: { _id: string; status: string };
    options: Array<{ optionId: string; type: "ASAP" | "DELAYED"; proposedAt: string; rationale: string; recommended: boolean }>;
  }>(
    `/api/v1/events/${eventId}/miss`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    accessToken
  );
}

export async function getMissedOptions(accessToken: string, eventId: string) {
  return request<{
    options: Array<{ optionId: string; type: "ASAP" | "DELAYED"; proposedAt: string; rationale: string; recommended: boolean }>;
  }>(`/api/v1/events/${eventId}/missed-options`, {}, accessToken);
}

export async function applyMissedOption(
  accessToken: string,
  eventId: string,
  optionId: string,
  payload: { reason?: string }
) {
  return request<{ event: { _id: string; status: string } }>(
    `/api/v1/events/${eventId}/missed-options/${optionId}/apply`,
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    accessToken
  );
}

export async function rescheduleEvent(
  accessToken: string,
  eventId: string,
  payload: { scheduledDate: string; scheduledTime?: string; reason: string }
) {
  return request<{ event: { _id: string; status: string } }>(
    `/api/v1/events/${eventId}/reschedule`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    accessToken
  );
}

export async function updateEvent(
  accessToken: string,
  eventId: string,
  payload: { scheduledDate?: string; scheduledTime?: string; notes?: string; reason?: string }
) {
  return request<{ event: { _id: string; status: string; notes?: string } }>(
    `/api/v1/events/${eventId}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload)
    },
    accessToken
  );
}

export async function deleteEvent(accessToken: string, eventId: string) {
  return request<{}>(
    `/api/v1/events/${eventId}`,
    {
      method: "DELETE"
    },
    accessToken
  );
}

// Backward-compatible exports for older panels/tests while they migrate.
export async function getTemplates(accessToken: string, profileId: string) {
  const response = await getEventConfigs(accessToken, profileId);
  return {
    templates: response.eventConfigs.map((eventConfig) => ({
      ...eventConfig,
      category: eventConfig.slug
    }))
  };
}

export async function createTemplate(
  accessToken: string,
  profileId: string,
  payload: {
    name: string;
    category: string;
    baseIntervalDays: number;
    jitterPct: number;
    enabled: boolean;
  }
) {
  const response = await createEventConfig(accessToken, profileId, {
    name: payload.name,
    slug: payload.category,
    baseIntervalDays: payload.baseIntervalDays,
    jitterPct: payload.jitterPct,
    enabled: payload.enabled
  });
  return { template: { ...response.eventConfig, category: response.eventConfig.slug } };
}

export async function updateTemplate(
  accessToken: string,
  templateId: string,
  payload: Partial<{
    name: string;
    category: string;
    baseIntervalDays: number;
    jitterPct: number;
    enabled: boolean;
  }>
) {
  const response = await updateEventConfig(accessToken, templateId, {
    name: payload.name,
    slug: payload.category,
    baseIntervalDays: payload.baseIntervalDays,
    jitterPct: payload.jitterPct,
    enabled: payload.enabled
  });
  return { template: { ...response.eventConfig, category: response.eventConfig.slug } };
}

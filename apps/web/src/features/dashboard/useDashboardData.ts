import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyMissedOption,
  completeEvent,
  createEvent,
  createEventConfig,
  createProfile,
  deleteEvent,
  deleteEventConfig,
  getEventConfigs,
  getEvents,
  getMissedOptions,
  getProfiles,
  getScheduleSettings,
  missEvent,
  rescheduleEvent,
  updateEvent,
  updateEventConfig,
  updateScheduleSettings
} from "../../lib/api/client";

const ACTIVE_UPCOMING_STATUSES = ["SCHEDULED", "RESCHEDULED"] as const;
const DEFAULT_EVENT_CONFIG_NAME_BY_SLUG: Record<string, string> = {
  flowers: "Flowers",
  "date-night": "Date Night",
  "nice-date": "Date Night",
  "shared-activity": "Shared Activity",
  activity: "Shared Activity",
  "thoughtful-message": "Thoughtful Message"
};

export type Profile = {
  _id: string;
  profileName: string;
  partnerName?: string;
  active: boolean;
};

export type EventConfig = {
  _id: string;
  name: string;
  slug: string;
  baseIntervalDays: number;
  jitterPct: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type RewardEvent = {
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
};

type BlackoutDate = { startAt: string; endAt?: string; allDay?: boolean; note?: string };

type ScheduleSettings = {
  timezone: string;
  reminderLeadHours: number;
  minGapHours: number;
  allowedWindows: Array<{ weekday: number; startLocalTime: string; endLocalTime: string }>;
  recurringBlackoutWeekdays: number[];
  blackoutDates: BlackoutDate[];
};

interface UseDashboardDataProps {
  accessToken: string;
  fallbackTimezone: string;
}

export function useDashboardData({ accessToken, fallbackTimezone }: UseDashboardDataProps) {
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedEventConfigId, setSelectedEventConfigId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(accessToken),
    enabled: Boolean(accessToken)
  });

  const eventConfigsQuery = useQuery({
    queryKey: ["event-configs", selectedProfileId],
    queryFn: () => getEventConfigs(accessToken, selectedProfileId as string),
    enabled: Boolean(selectedProfileId)
  });

  const eventsQuery = useQuery({
    queryKey: ["events", selectedProfileId],
    queryFn: () => getEvents(accessToken, selectedProfileId as string),
    enabled: Boolean(selectedProfileId)
  });

  const settingsQuery = useQuery({
    queryKey: ["schedule-settings", selectedProfileId],
    queryFn: () => getScheduleSettings(accessToken, selectedProfileId as string),
    enabled: Boolean(selectedProfileId)
  });

  const profiles = useMemo<Profile[]>(() => profilesQuery.data?.profiles ?? [], [profilesQuery.data]);
  const eventConfigs = useMemo<EventConfig[]>(
    () =>
      (eventConfigsQuery.data?.eventConfigs ?? []).map((eventConfig) => ({
        ...eventConfig,
        ...normalizeEventConfigPresentation(eventConfig.name, eventConfig.slug)
      })),
    [eventConfigsQuery.data]
  );
  const events = useMemo<RewardEvent[]>(
    () =>
      (eventsQuery.data?.events ?? []).map((event) => ({
        ...event,
        eventConfigId: event.eventConfigId ?? (event as { templateId?: string }).templateId ?? "",
        status: event.status ?? "SCHEDULED",
        hasExplicitTime: Boolean(event.hasExplicitTime),
        adjustments: Array.isArray(event.adjustments) ? event.adjustments : []
      })),
    [eventsQuery.data]
  );

  const settings = useMemo<ScheduleSettings>(() => {
    const rawSettings = settingsQuery.data?.settings;

    return {
      timezone: rawSettings?.timezone ?? fallbackTimezone,
      reminderLeadHours: rawSettings?.reminderLeadHours ?? 24,
      minGapHours: rawSettings?.minGapHours ?? 24,
      allowedWindows: Array.isArray(rawSettings?.allowedWindows)
        ? rawSettings.allowedWindows
        : defaultAllowedWindows(),
      recurringBlackoutWeekdays: Array.isArray(rawSettings?.recurringBlackoutWeekdays)
        ? rawSettings.recurringBlackoutWeekdays
        : [],
      blackoutDates: Array.isArray(rawSettings?.blackoutDates) ? rawSettings.blackoutDates : []
    };
  }, [fallbackTimezone, settingsQuery.data?.settings]);

  useEffect(() => {
    if (!selectedProfileId && profiles.length > 0) {
      setSelectedProfileId(profiles[0]._id);
    }
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (eventConfigs.length === 0) {
      setSelectedEventConfigId(null);
      return;
    }

    if (!selectedEventConfigId || !eventConfigs.some((eventConfig) => eventConfig._id === selectedEventConfigId)) {
      setSelectedEventConfigId(eventConfigs[0]._id);
    }
  }, [eventConfigs, selectedEventConfigId]);

  const eventConfigById = useMemo(
    () => new Map(eventConfigs.map((eventConfig) => [eventConfig._id, eventConfig])),
    [eventConfigs]
  );

  const eventsWithContext = useMemo(
    () =>
      events.map((event) => {
        const eventConfig = eventConfigById.get(event.eventConfigId);
        return {
          ...event,
          eventConfigName: eventConfig?.name ?? event.eventConfigId,
          eventConfigSlug: eventConfig?.slug ?? "unknown"
        };
      }),
    [events, eventConfigById]
  );

  const selectedEventConfig = useMemo(
    () => eventConfigs.find((eventConfig) => eventConfig._id === selectedEventConfigId) ?? null,
    [eventConfigs, selectedEventConfigId]
  );

  const eventsForSelectedConfig = useMemo(
    () =>
      eventsWithContext
        .filter((event) => event.eventConfigId === selectedEventConfigId)
        .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime()),
    [eventsWithContext, selectedEventConfigId]
  );

  const upcomingForSelectedConfig = useMemo(
    () =>
      eventsForSelectedConfig.filter(
        (event) =>
          ACTIVE_UPCOMING_STATUSES.includes(event.status as (typeof ACTIVE_UPCOMING_STATUSES)[number]) &&
          new Date(event.scheduledAt).getTime() > Date.now()
      ),
    [eventsForSelectedConfig]
  );

  useEffect(() => {
    if (!selectedEventId) {
      if (eventsForSelectedConfig.length > 0) {
        setSelectedEventId(eventsForSelectedConfig[0]._id);
      }
      return;
    }

    const exists = eventsForSelectedConfig.some((event) => event._id === selectedEventId);
    if (!exists) {
      setSelectedEventId(eventsForSelectedConfig[0]?._id ?? null);
    }
  }, [eventsForSelectedConfig, selectedEventId]);

  const selectedEvent = useMemo(
    () => eventsWithContext.find((event) => event._id === selectedEventId) ?? null,
    [eventsWithContext, selectedEventId]
  );

  const missedOptionsQuery = useQuery({
    queryKey: ["missed-options", selectedEventId],
    queryFn: () => getMissedOptions(accessToken, selectedEventId as string),
    enabled: Boolean(selectedEventId && selectedEvent?.status === "MISSED")
  });

  const createProfileMutation = useMutation({
    mutationFn: (payload: { profileName: string; partnerName?: string }) =>
      createProfile(accessToken, payload),
    onSuccess: async (result) => {
      setSelectedProfileId(result.profile._id);
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
    }
  });

  const createEventConfigMutation = useMutation({
    mutationFn: (payload: { name: string; baseIntervalDays: number; jitterPct: number }) =>
      createEventConfig(accessToken, selectedProfileId as string, {
        ...payload,
        slug: slugify(payload.name),
        enabled: true
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["event-configs", selectedProfileId] });
      setSelectedEventConfigId(result.eventConfig._id);
    }
  });

  const updateEventConfigMutation = useMutation({
    mutationFn: ({
      eventConfigId,
      payload
    }: {
      eventConfigId: string;
      payload: Partial<{
        name: string;
        baseIntervalDays: number;
        jitterPct: number;
        enabled: boolean;
      }>;
    }) =>
      updateEventConfig(accessToken, eventConfigId, {
        ...payload,
        slug: payload.name ? slugify(payload.name) : undefined
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["event-configs", selectedProfileId] });
    }
  });

  const deleteEventConfigMutation = useMutation({
    mutationFn: (eventConfigId: string) => deleteEventConfig(accessToken, eventConfigId),
    onSuccess: async (_result, eventConfigId) => {
      if (selectedEventConfigId === eventConfigId) {
        setSelectedEventConfigId(null);
      }
      await queryClient.invalidateQueries({ queryKey: ["event-configs", selectedProfileId] });
      await queryClient.invalidateQueries({ queryKey: ["events", selectedProfileId] });
    }
  });

  const createEventMutation = useMutation({
    mutationFn: (payload: { scheduledDate: string; scheduledTime?: string; notes?: string }) =>
      createEvent(accessToken, selectedProfileId as string, {
        eventConfigId: selectedEventConfig?._id as string,
        scheduledDate: payload.scheduledDate,
        scheduledTime: payload.scheduledTime,
        notes: payload.notes
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", selectedProfileId] });
    }
  });

  const updateEventMutation = useMutation({
    mutationFn: ({
      eventId,
      payload
    }: {
      eventId: string;
      payload: { scheduledDate?: string; scheduledTime?: string; notes?: string; reason?: string };
    }) => updateEvent(accessToken, eventId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", selectedProfileId] });
    }
  });

  const deleteEventMutation = useMutation({
    mutationFn: (eventId: string) => deleteEvent(accessToken, eventId),
    onSuccess: async (_result, eventId) => {
      if (selectedEventId === eventId) {
        setSelectedEventId(null);
      }
      await queryClient.invalidateQueries({ queryKey: ["events", selectedProfileId] });
    }
  });

  const completeEventMutation = useMutation({
    mutationFn: (eventId: string) => completeEvent(accessToken, eventId, { sentimentLevel: "WELL" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", selectedProfileId] });
    }
  });

  const missEventMutation = useMutation({
    mutationFn: (eventId: string) => missEvent(accessToken, eventId, {}),
    onSuccess: async (_result, eventId) => {
      setSelectedEventId(eventId);
      await queryClient.invalidateQueries({ queryKey: ["events", selectedProfileId] });
      await queryClient.invalidateQueries({ queryKey: ["missed-options", eventId] });
    }
  });

  const rescheduleEventMutation = useMutation({
    mutationFn: ({
      eventId,
      scheduledDate,
      scheduledTime,
      reason
    }: {
      eventId: string;
      scheduledDate: string;
      scheduledTime?: string;
      reason: string;
    }) => rescheduleEvent(accessToken, eventId, { scheduledDate, scheduledTime, reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", selectedProfileId] });
    }
  });

  const applyMissedOptionMutation = useMutation({
    mutationFn: ({ optionId, reason }: { optionId: string; reason?: string }) =>
      applyMissedOption(accessToken, selectedEventId as string, optionId, { reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", selectedProfileId] });
      await queryClient.invalidateQueries({ queryKey: ["missed-options", selectedEventId] });
    }
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (payload: ScheduleSettings) =>
      updateScheduleSettings(accessToken, selectedProfileId as string, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["schedule-settings", selectedProfileId] });
      await queryClient.invalidateQueries({ queryKey: ["events", selectedProfileId] });
    }
  });

  return {
    selectedProfileId,
    setSelectedProfileId,
    selectedEventConfigId,
    setSelectedEventConfigId,
    selectedEventId,
    setSelectedEventId,
    selectedCalendarDate,
    setSelectedCalendarDate,
    profiles,
    eventConfigs,
    events: eventsWithContext,
    eventsForSelectedConfig,
    upcomingForSelectedConfig,
    selectedEventConfig,
    selectedEvent,
    settings,
    missedOptions: missedOptionsQuery.data?.options ?? [],
    loading:
      profilesQuery.isLoading || eventConfigsQuery.isLoading || eventsQuery.isLoading || settingsQuery.isLoading,
    createProfileMutation,
    createEventConfigMutation,
    updateEventConfigMutation,
    deleteEventConfigMutation,
    createEventMutation,
    updateEventMutation,
    deleteEventMutation,
    completeEventMutation,
    missEventMutation,
    rescheduleEventMutation,
    applyMissedOptionMutation,
    saveSettingsMutation
  };
}

export function localDateTimeToIso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function normalizeEventConfigPresentation(name: string, slug?: string) {
  const normalizedSlug = slugify(slug || name);
  const canonicalDefaultName = DEFAULT_EVENT_CONFIG_NAME_BY_SLUG[normalizedSlug];
  const trimmedName = name.trim();

  if (!canonicalDefaultName) {
    return {
      name: trimmedName || humanizeSlug(normalizedSlug),
      slug: normalizedSlug
    };
  }

  if (!trimmedName) {
    return { name: canonicalDefaultName, slug: normalizedSlug };
  }

  const legacyMachineFormat =
    trimmedName === trimmedName.toLowerCase() || /[_-]/.test(trimmedName);

  if (legacyMachineFormat && slugify(trimmedName) === normalizedSlug) {
    return { name: canonicalDefaultName, slug: normalizedSlug };
  }

  return {
    name: trimmedName,
    slug: normalizedSlug
  };
}

function humanizeSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(" ");
}

function defaultAllowedWindows() {
  return [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    startLocalTime: "09:00",
    endLocalTime: "21:00"
  }));
}

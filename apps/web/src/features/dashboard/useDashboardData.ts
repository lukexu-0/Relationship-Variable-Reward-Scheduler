import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  applyMissedOption,
  completeEvent,
  createEvent,
  createProfile,
  createTemplate,
  deleteEvent,
  getEvents,
  getMissedOptions,
  getProfiles,
  getScheduleSettings,
  getTemplates,
  missEvent,
  rescheduleEvent,
  updateEvent,
  updateScheduleSettings,
  updateTemplate
} from "../../lib/api/client";

const ACTIVE_UPCOMING_STATUSES = ["SCHEDULED", "RESCHEDULED"] as const;

type Profile = {
  _id: string;
  profileName: string;
  partnerName?: string;
  active: boolean;
};

type Template = {
  _id: string;
  name: string;
  category: string;
  baseIntervalDays: number;
  jitterPct: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type RewardEvent = {
  _id: string;
  templateId: string;
  scheduledAt: string;
  originalScheduledAt: string;
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
  blackoutDates: BlackoutDate[];
};

interface UseDashboardDataProps {
  accessToken: string;
  fallbackTimezone: string;
}

export function useDashboardData({ accessToken, fallbackTimezone }: UseDashboardDataProps) {
  const queryClient = useQueryClient();
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: () => getProfiles(accessToken),
    enabled: Boolean(accessToken)
  });

  const templatesQuery = useQuery({
    queryKey: ["templates", selectedProfileId],
    queryFn: () => getTemplates(accessToken, selectedProfileId as string),
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
  const templates = useMemo<Template[]>(() => templatesQuery.data?.templates ?? [], [templatesQuery.data]);
  const events = useMemo<RewardEvent[]>(
    () =>
      (eventsQuery.data?.events ?? []).map((event) => ({
        ...event,
        status: event.status ?? "SCHEDULED",
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
        : [{ weekday: 1, startLocalTime: "18:00", endLocalTime: "21:00" }],
      blackoutDates: Array.isArray(rawSettings?.blackoutDates) ? rawSettings.blackoutDates : []
    };
  }, [fallbackTimezone, settingsQuery.data?.settings]);

  useEffect(() => {
    if (!selectedProfileId && profiles.length > 0) {
      setSelectedProfileId(profiles[0]._id);
    }
  }, [profiles, selectedProfileId]);

  const categories = useMemo(
    () => Array.from(new Set(templates.map((template) => template.category))).sort(),
    [templates]
  );

  useEffect(() => {
    if (categories.length === 0) {
      setSelectedCategory(null);
      return;
    }

    if (!selectedCategory || !categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  const templateById = useMemo(
    () => new Map(templates.map((template) => [template._id, template])),
    [templates]
  );

  const eventsWithContext = useMemo(
    () =>
      events.map((event) => {
        const template = templateById.get(event.templateId);
        return {
          ...event,
          category: template?.category ?? "unknown",
          templateName: template?.name ?? event.templateId
        };
      }),
    [events, templateById]
  );

  const selectedSet = useMemo(
    () => templates.find((template) => template.category === selectedCategory) ?? null,
    [selectedCategory, templates]
  );

  const eventsForSelectedCategory = useMemo(
    () =>
      eventsWithContext
        .filter((event) => event.category === selectedCategory)
        .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime()),
    [eventsWithContext, selectedCategory]
  );

  const upcomingForSelectedCategory = useMemo(
    () =>
      eventsForSelectedCategory.filter(
        (event) =>
          ACTIVE_UPCOMING_STATUSES.includes(event.status as (typeof ACTIVE_UPCOMING_STATUSES)[number]) &&
          new Date(event.scheduledAt).getTime() > Date.now()
      ),
    [eventsForSelectedCategory]
  );

  useEffect(() => {
    if (!selectedEventId) {
      if (eventsForSelectedCategory.length > 0) {
        setSelectedEventId(eventsForSelectedCategory[0]._id);
      }
      return;
    }

    const exists = eventsForSelectedCategory.some((event) => event._id === selectedEventId);
    if (!exists) {
      setSelectedEventId(eventsForSelectedCategory[0]?._id ?? null);
    }
  }, [eventsForSelectedCategory, selectedEventId]);

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

  const createSetMutation = useMutation({
    mutationFn: (payload: { name: string; category: string; baseIntervalDays: number; jitterPct: number }) =>
      createTemplate(accessToken, selectedProfileId as string, {
        ...payload,
        category: payload.category.trim().toLowerCase(),
        enabled: true
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["templates", selectedProfileId] });
      if (result.template?.category) {
        setSelectedCategory(result.template.category);
      }
    }
  });

  const updateSetMutation = useMutation({
    mutationFn: ({
      templateId,
      payload
    }: {
      templateId: string;
      payload: Partial<{
        name: string;
        baseIntervalDays: number;
        jitterPct: number;
        enabled: boolean;
      }>;
    }) => updateTemplate(accessToken, templateId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["templates", selectedProfileId] });
    }
  });

  const createEventMutation = useMutation({
    mutationFn: (payload: { scheduledAt: string; notes?: string }) =>
      createEvent(accessToken, selectedProfileId as string, {
        templateId: selectedSet?._id as string,
        scheduledAt: payload.scheduledAt,
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
      payload: { scheduledAt?: string; notes?: string; reason?: string };
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
    mutationFn: ({ eventId, scheduledAt, reason }: { eventId: string; scheduledAt: string; reason: string }) =>
      rescheduleEvent(accessToken, eventId, { scheduledAt, reason }),
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
    selectedCategory,
    setSelectedCategory,
    selectedEventId,
    setSelectedEventId,
    profiles,
    templates,
    categories,
    events: eventsWithContext,
    eventsForSelectedCategory,
    upcomingForSelectedCategory,
    selectedSet,
    selectedEvent,
    settings,
    missedOptions: missedOptionsQuery.data?.options ?? [],
    loading:
      profilesQuery.isLoading || templatesQuery.isLoading || eventsQuery.isLoading || settingsQuery.isLoading,
    createProfileMutation,
    createSetMutation,
    updateSetMutation,
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

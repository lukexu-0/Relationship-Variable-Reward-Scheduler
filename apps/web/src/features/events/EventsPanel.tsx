import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { SentimentLevel } from "@reward/shared-types";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  completeEvent,
  createEvent,
  getEvents,
  getTemplates,
  missEvent,
  rescheduleEvent
} from "../../lib/api/client";
import { formatIsoToLocal } from "../../lib/time/format";

interface EventsPanelProps {
  accessToken: string;
  profileId: string | null;
  onPickMissedEvent: (eventId: string) => void;
}

export function EventsPanel({ accessToken, profileId, onPickMissedEvent }: EventsPanelProps) {
  const queryClient = useQueryClient();
  const [templateId, setTemplateId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [notes, setNotes] = useState("");
  const [rescheduleReason, setRescheduleReason] = useState("Adjusted by user");

  const templatesQuery = useQuery({
    queryKey: ["templates", profileId],
    queryFn: () => getTemplates(accessToken, profileId as string),
    enabled: Boolean(profileId)
  });

  const eventsQuery = useQuery({
    queryKey: ["events", profileId],
    queryFn: () => getEvents(accessToken, profileId as string),
    enabled: Boolean(profileId)
  });

  const createEventMutation = useMutation({
    mutationFn: () =>
      createEvent(accessToken, profileId as string, {
        templateId,
        scheduledAt: localDateTimeToIso(scheduledAt),
        notes: notes || undefined
      }),
    onSuccess: async () => {
      setScheduledAt("");
      setNotes("");
      await queryClient.invalidateQueries({ queryKey: ["events", profileId] });
    }
  });

  const completeMutation = useMutation({
    mutationFn: ({ eventId, sentiment }: { eventId: string; sentiment: SentimentLevel }) =>
      completeEvent(accessToken, eventId, { sentimentLevel: sentiment }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", profileId] });
    }
  });

  const missMutation = useMutation({
    mutationFn: (eventId: string) => missEvent(accessToken, eventId, {}),
    onSuccess: async (_result, eventId) => {
      onPickMissedEvent(eventId);
      await queryClient.invalidateQueries({ queryKey: ["events", profileId] });
    }
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ eventId, nextAt }: { eventId: string; nextAt: string }) =>
      rescheduleEvent(accessToken, eventId, {
        scheduledAt: nextAt,
        reason: rescheduleReason
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["events", profileId] });
    }
  });

  const templates = useMemo(() => templatesQuery.data?.templates ?? [], [templatesQuery.data]);
  const events = useMemo(() => eventsQuery.data?.events ?? [], [eventsQuery.data]);
  const templateNameById = useMemo(
    () => new Map(templates.map((template) => [template._id, template.name])),
    [templates]
  );

  return (
    <Card title="Events" subtitle="Create events, complete feedback, mark missed, and reschedule">
      {!profileId ? <p className="helper">Select a profile to manage events.</p> : null}

      {profileId ? (
        <>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createEventMutation.mutate();
            }}
          >
            <label htmlFor="eventTemplate">Template</label>
            <select
              id="eventTemplate"
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              required
            >
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template._id} value={template._id}>
                  {template.name}
                </option>
              ))}
            </select>

            <label htmlFor="scheduledAt" style={{ marginTop: 8 }}>
              Scheduled date/time
            </label>
            <input
              id="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(event) => setScheduledAt(event.target.value)}
              required
            />

            <label htmlFor="eventNotes" style={{ marginTop: 8 }}>
              Notes (optional)
            </label>
            <input id="eventNotes" value={notes} onChange={(event) => setNotes(event.target.value)} />

            <div style={{ marginTop: 10 }}>
              <Button type="submit" disabled={createEventMutation.isPending}>
                Add event
              </Button>
            </div>
          </form>

          <hr style={{ borderColor: "var(--line)", opacity: 0.5 }} />

          <label htmlFor="rescheduleReason">Default reschedule reason</label>
          <input
            id="rescheduleReason"
            value={rescheduleReason}
            onChange={(event) => setRescheduleReason(event.target.value)}
          />

          <div style={{ marginTop: 10 }}>
            {events.map((event) => (
              <div className="event-item" key={event._id}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div>
                      <strong>{formatIsoToLocal(event.scheduledAt)}</strong>
                    </div>
                    <div className="helper">Template: {templateNameById.get(event.templateId) ?? event.templateId}</div>
                    <div className="helper">Original: {formatIsoToLocal(event.originalScheduledAt)}</div>
                  </div>
                  <Badge>{event.status}</Badge>
                </div>

                <div className="row" style={{ marginTop: 8 }}>
                  <Button
                    variant="soft"
                    onClick={() => completeMutation.mutate({ eventId: event._id, sentiment: "WELL" })}
                  >
                    Complete (Well)
                  </Button>
                  <Button variant="soft" onClick={() => missMutation.mutate(event._id)}>
                    Mark missed
                  </Button>
                  <Button
                    variant="soft"
                    onClick={() =>
                      rescheduleMutation.mutate({
                        eventId: event._id,
                        nextAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                      })
                    }
                  >
                    +1 day
                  </Button>
                  <Button variant="soft" onClick={() => onPickMissedEvent(event._id)}>
                    Recovery options
                  </Button>
                </div>

                {event.adjustments?.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    <strong>Adjustment history</strong>
                    {event.adjustments.map((adjustment) => (
                      <p className="helper" key={`${adjustment.adjustedAt}:${adjustment.toAt}`}>
                        {`${formatIsoToLocal(adjustment.fromAt)} -> ${formatIsoToLocal(adjustment.toAt)} | ${adjustment.reason}`}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </Card>
  );
}

function localDateTimeToIso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}

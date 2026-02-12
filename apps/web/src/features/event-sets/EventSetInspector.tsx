import { useEffect, useState } from "react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { formatIsoToLocal } from "../../lib/time/format";
import { EventEditor } from "../events/EventEditor";

interface EventConfigRecord {
  _id: string;
  name: string;
  slug: string;
  baseIntervalDays: number;
  jitterPct: number;
  enabled: boolean;
}

interface EventRecord {
  _id: string;
  status: string;
  notes?: string;
  scheduledAt: string;
  originalScheduledAt: string;
  hasExplicitTime: boolean;
  eventConfigName: string;
  adjustments: Array<{
    fromAt: string;
    toAt: string;
    reason: string;
    adjustedAt: string;
  }>;
}

interface MissedOption {
  optionId: string;
  type: "ASAP" | "DELAYED";
  proposedAt: string;
  rationale: string;
  recommended: boolean;
}

interface EventSetInspectorProps {
  selectedEventConfig: EventConfigRecord | null;
  eventsForConfig: EventRecord[];
  upcomingForConfig: EventRecord[];
  selectedEvent: EventRecord | null;
  missedOptions: MissedOption[];
  onSelectEvent: (eventId: string) => void;
  onCreateEventConfig: (payload: {
    name: string;
    baseIntervalDays: number;
    jitterPct: number;
  }) => void;
  onUpdateEventConfig: (payload: {
    eventConfigId: string;
    patch: Partial<{ name: string; baseIntervalDays: number; jitterPct: number; enabled: boolean }>;
  }) => void;
  onDeleteEventConfig: (eventConfigId: string) => void;
  onCreateEvent: (payload: { scheduledDate: string; scheduledTime?: string; notes?: string }) => void;
  onSaveEvent: (
    eventId: string,
    payload: { scheduledDate?: string; scheduledTime?: string; notes?: string; reason?: string }
  ) => void;
  onDeleteEvent: (eventId: string) => void;
  onCompleteEvent: (eventId: string) => void;
  onMissEvent: (eventId: string) => void;
  onRescheduleEventPlusDay: (eventId: string) => void;
  onApplyMissedOption: (optionId: string) => void;
  creatingEventConfig?: boolean;
  updatingEventConfig?: boolean;
  deletingEventConfig?: boolean;
  creatingEvent?: boolean;
  savingEvent?: boolean;
  deletingEvent?: boolean;
}

export function EventSetInspector({
  selectedEventConfig,
  eventsForConfig,
  upcomingForConfig,
  selectedEvent,
  missedOptions,
  onSelectEvent,
  onCreateEventConfig,
  onUpdateEventConfig,
  onDeleteEventConfig,
  onCreateEvent,
  onSaveEvent,
  onDeleteEvent,
  onCompleteEvent,
  onMissEvent,
  onRescheduleEventPlusDay,
  onApplyMissedOption,
  creatingEventConfig,
  updatingEventConfig,
  deletingEventConfig,
  creatingEvent,
  savingEvent,
  deletingEvent
}: EventSetInspectorProps) {
  const [configName, setConfigName] = useState("");
  const [configBaseIntervalDays, setConfigBaseIntervalDays] = useState(7);
  const [configJitterPct, setConfigJitterPct] = useState(0.2);
  const [configEnabled, setConfigEnabled] = useState(true);

  const [newEventDate, setNewEventDate] = useState("");
  const [newEventUseTime, setNewEventUseTime] = useState(false);
  const [newEventTime, setNewEventTime] = useState("18:00");
  const [newEventNotes, setNewEventNotes] = useState("");

  useEffect(() => {
    if (!selectedEventConfig) {
      setConfigName("");
      setConfigBaseIntervalDays(7);
      setConfigJitterPct(0.2);
      setConfigEnabled(true);
      return;
    }

    setConfigName(selectedEventConfig.name);
    setConfigBaseIntervalDays(selectedEventConfig.baseIntervalDays);
    setConfigJitterPct(selectedEventConfig.jitterPct);
    setConfigEnabled(selectedEventConfig.enabled);
  }, [selectedEventConfig]);

  return (
    <div className="set-inspector">
      <h3>Event Builder</h3>

      {!selectedEventConfig ? (
        <p className="helper">Select an event from the left list, or create a new one here.</p>
      ) : (
        <>
          <p className="helper">Selected: {selectedEventConfig.name}</p>
          <div className="row" style={{ marginBottom: 8 }}>
            <Badge variant="accent">{upcomingForConfig.length} upcoming</Badge>
            <Badge>{eventsForConfig.length} events</Badge>
          </div>
        </>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedEventConfig) {
            onCreateEventConfig({
              name: configName,
              baseIntervalDays: configBaseIntervalDays,
              jitterPct: configJitterPct
            });
            return;
          }

          onUpdateEventConfig({
            eventConfigId: selectedEventConfig._id,
            patch: {
              name: configName,
              baseIntervalDays: configBaseIntervalDays,
              jitterPct: configJitterPct,
              enabled: configEnabled
            }
          });
        }}
      >
        <label htmlFor="configName">Event name</label>
        <input id="configName" value={configName} onChange={(event) => setConfigName(event.target.value)} required />

        <div className="row" style={{ marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="configBaseIntervalDays">Base interval days</label>
            <input
              id="configBaseIntervalDays"
              type="number"
              min={1}
              max={365}
              value={configBaseIntervalDays}
              onChange={(event) => setConfigBaseIntervalDays(Number(event.target.value))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="configJitterPct" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Jitter pct
              <span className="hint-tooltip" title="Jitter adds random variation to spacing around the base interval so events feel less predictable.">
                ?
              </span>
            </label>
            <input
              id="configJitterPct"
              type="number"
              min={0}
              max={0.9}
              step={0.05}
              value={configJitterPct}
              onChange={(event) => setConfigJitterPct(Number(event.target.value))}
            />
          </div>
        </div>

        <label htmlFor="configEnabled" style={{ marginTop: 8 }}>
          Enabled
        </label>
        <select
          id="configEnabled"
          value={configEnabled ? "true" : "false"}
          onChange={(event) => setConfigEnabled(event.target.value === "true")}
        >
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>

        <div className="row" style={{ marginTop: 10 }}>
          <Button type="submit" disabled={creatingEventConfig || updatingEventConfig}>
            {selectedEventConfig ? "Save event" : "Create event"}
          </Button>
          {selectedEventConfig ? (
            <Button
              type="button"
              variant="danger"
              disabled={deletingEventConfig}
              onClick={() => onDeleteEventConfig(selectedEventConfig._id)}
            >
              Delete event config
            </Button>
          ) : null}
        </div>
      </form>

      {selectedEventConfig ? (
        <>
          <hr style={{ borderColor: "var(--line)", opacity: 0.5 }} />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onCreateEvent({
                scheduledDate: newEventDate,
                scheduledTime: newEventUseTime ? newEventTime : undefined,
                notes: newEventNotes || undefined
              });
            }}
          >
            <label htmlFor="setEventDate">Schedule new event date</label>
            <input
              id="setEventDate"
              type="date"
              value={newEventDate}
              onChange={(event) => setNewEventDate(event.target.value)}
              required
            />

            <label htmlFor="setEventUseTime" style={{ marginTop: 8 }}>
              Include time
            </label>
            <select
              id="setEventUseTime"
              value={newEventUseTime ? "yes" : "no"}
              onChange={(event) => setNewEventUseTime(event.target.value === "yes")}
            >
              <option value="no">No (date only)</option>
              <option value="yes">Yes</option>
            </select>

            {newEventUseTime ? (
              <>
                <label htmlFor="setEventTime" style={{ marginTop: 8 }}>
                  Time
                </label>
                <input
                  id="setEventTime"
                  type="time"
                  value={newEventTime}
                  onChange={(event) => setNewEventTime(event.target.value)}
                />
              </>
            ) : null}

            <label htmlFor="setEventNotes" style={{ marginTop: 8 }}>
              Event notes (optional)
            </label>
            <input
              id="setEventNotes"
              value={newEventNotes}
              onChange={(event) => setNewEventNotes(event.target.value)}
            />

            <div style={{ marginTop: 10 }}>
              <Button type="submit" disabled={creatingEvent}>
                Add event
              </Button>
            </div>
          </form>

          <div style={{ marginTop: 12 }}>
            <strong>Event history</strong>
            {eventsForConfig.map((event) => (
              <button
                key={event._id}
                type="button"
                className={`event-choice ${selectedEvent?._id === event._id ? "active" : ""}`}
                onClick={() => onSelectEvent(event._id)}
              >
                <span>{formatIsoToLocal(event.scheduledAt, event.hasExplicitTime)}</span>
                <span>{event.status}</span>
              </button>
            ))}
          </div>

          <hr style={{ borderColor: "var(--line)", opacity: 0.5 }} />

          <EventEditor
            event={selectedEvent}
            onSave={(payload) => {
              if (!selectedEvent) {
                return;
              }
              onSaveEvent(selectedEvent._id, payload);
            }}
            onDelete={() => {
              if (!selectedEvent) {
                return;
              }
              onDeleteEvent(selectedEvent._id);
            }}
            onComplete={() => {
              if (!selectedEvent) {
                return;
              }
              onCompleteEvent(selectedEvent._id);
            }}
            onMiss={() => {
              if (!selectedEvent) {
                return;
              }
              onMissEvent(selectedEvent._id);
            }}
            onReschedulePlusDay={() => {
              if (!selectedEvent) {
                return;
              }
              onRescheduleEventPlusDay(selectedEvent._id);
            }}
            saving={savingEvent}
            deleting={deletingEvent}
          />

          {selectedEvent?.status === "MISSED" ? (
            <div style={{ marginTop: 12 }}>
              <strong>Missed recovery options</strong>
              {missedOptions.map((option) => (
                <div className="event-item" key={option.optionId}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{option.type}</strong>
                    {option.recommended ? <Badge variant="ok">Recommended</Badge> : null}
                  </div>
                  <p className="helper">Proposed: {formatIsoToLocal(option.proposedAt)}</p>
                  <p className="helper">{option.rationale}</p>
                  <Button variant="soft" onClick={() => onApplyMissedOption(option.optionId)}>
                    Apply option
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

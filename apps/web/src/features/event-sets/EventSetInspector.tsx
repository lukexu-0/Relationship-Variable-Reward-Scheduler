import { useEffect, useState } from "react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { formatIsoToLocal } from "../../lib/time/format";
import { EventEditor } from "../events/EventEditor";

interface TemplateSet {
  _id: string;
  name: string;
  category: string;
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
  templateName: string;
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
  selectedSet: TemplateSet | null;
  eventsForCategory: EventRecord[];
  upcomingForCategory: EventRecord[];
  selectedEvent: EventRecord | null;
  missedOptions: MissedOption[];
  onSelectEvent: (eventId: string) => void;
  onCreateSet: (payload: {
    name: string;
    category: string;
    baseIntervalDays: number;
    jitterPct: number;
  }) => void;
  onUpdateSet: (payload: {
    templateId: string;
    patch: Partial<{ name: string; baseIntervalDays: number; jitterPct: number; enabled: boolean }>;
  }) => void;
  onCreateEvent: (payload: { scheduledAt: string; notes?: string }) => void;
  onSaveEvent: (eventId: string, payload: { scheduledAt?: string; notes?: string; reason?: string }) => void;
  onDeleteEvent: (eventId: string) => void;
  onCompleteEvent: (eventId: string) => void;
  onMissEvent: (eventId: string) => void;
  onRescheduleEventPlusDay: (eventId: string) => void;
  onApplyMissedOption: (optionId: string) => void;
  creatingSet?: boolean;
  updatingSet?: boolean;
  creatingEvent?: boolean;
  savingEvent?: boolean;
  deletingEvent?: boolean;
}

export function EventSetInspector({
  selectedSet,
  eventsForCategory,
  upcomingForCategory,
  selectedEvent,
  missedOptions,
  onSelectEvent,
  onCreateSet,
  onUpdateSet,
  onCreateEvent,
  onSaveEvent,
  onDeleteEvent,
  onCompleteEvent,
  onMissEvent,
  onRescheduleEventPlusDay,
  onApplyMissedOption,
  creatingSet,
  updatingSet,
  creatingEvent,
  savingEvent,
  deletingEvent
}: EventSetInspectorProps) {
  const [setName, setSetName] = useState("");
  const [setCategory, setSetCategory] = useState("");
  const [setBaseIntervalDays, setSetBaseIntervalDays] = useState(7);
  const [setJitterPct, setSetJitterPct] = useState(0.2);
  const [setEnabled, setSetEnabled] = useState(true);
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventNotes, setNewEventNotes] = useState("");

  useEffect(() => {
    if (!selectedSet) {
      setSetName("");
      setSetCategory("");
      setSetBaseIntervalDays(7);
      setSetJitterPct(0.2);
      setSetEnabled(true);
      return;
    }

    setSetName(selectedSet.name);
    setSetCategory(selectedSet.category);
    setSetBaseIntervalDays(selectedSet.baseIntervalDays);
    setSetJitterPct(selectedSet.jitterPct);
    setSetEnabled(selectedSet.enabled);
  }, [selectedSet]);

  return (
    <div className="set-inspector">
      <h3>Set Inspector</h3>

      {!selectedSet ? (
        <p className="helper">Select a set from the left list, or create a new category set here.</p>
      ) : (
        <>
          <p className="helper">Selected category: {selectedSet.category}</p>
          <div className="row" style={{ marginBottom: 8 }}>
            <Badge variant="accent">{upcomingForCategory.length} upcoming</Badge>
            <Badge>{eventsForCategory.length} events</Badge>
          </div>
        </>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!selectedSet) {
            onCreateSet({
              name: setName,
              category: setCategory,
              baseIntervalDays: setBaseIntervalDays,
              jitterPct: setJitterPct
            });
            return;
          }

          onUpdateSet({
            templateId: selectedSet._id,
            patch: {
              name: setName,
              baseIntervalDays: setBaseIntervalDays,
              jitterPct: setJitterPct,
              enabled: setEnabled
            }
          });
        }}
      >
        <label htmlFor="setName">Set name</label>
        <input id="setName" value={setName} onChange={(event) => setSetName(event.target.value)} required />

        <label htmlFor="setCategory" style={{ marginTop: 8 }}>
          Category
        </label>
        <input
          id="setCategory"
          value={setCategory}
          onChange={(event) => setSetCategory(event.target.value)}
          required
          disabled={Boolean(selectedSet)}
        />

        <div className="row" style={{ marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="setBaseIntervalDays">Base interval days</label>
            <input
              id="setBaseIntervalDays"
              type="number"
              min={1}
              max={365}
              value={setBaseIntervalDays}
              onChange={(event) => setSetBaseIntervalDays(Number(event.target.value))}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="setJitterPct">Jitter pct</label>
            <input
              id="setJitterPct"
              type="number"
              min={0}
              max={0.9}
              step={0.05}
              value={setJitterPct}
              onChange={(event) => setSetJitterPct(Number(event.target.value))}
            />
          </div>
        </div>

        <label htmlFor="setEnabled" style={{ marginTop: 8 }}>
          Enabled
        </label>
        <select
          id="setEnabled"
          value={setEnabled ? "true" : "false"}
          onChange={(event) => setSetEnabled(event.target.value === "true")}
        >
          <option value="true">Enabled</option>
          <option value="false">Disabled</option>
        </select>

        <div style={{ marginTop: 10 }}>
          <Button type="submit" disabled={creatingSet || updatingSet}>
            {selectedSet ? "Save set" : "Create set"}
          </Button>
        </div>
      </form>

      {selectedSet ? (
        <>
          <hr style={{ borderColor: "var(--line)", opacity: 0.5 }} />

          <form
            onSubmit={(event) => {
              event.preventDefault();
              onCreateEvent({
                scheduledAt: localDateTimeToIso(newEventDate),
                notes: newEventNotes || undefined
              });
            }}
          >
            <label htmlFor="setEventDate">Schedule new event for this set</label>
            <input
              id="setEventDate"
              type="datetime-local"
              value={newEventDate}
              onChange={(event) => setNewEventDate(event.target.value)}
              required
            />

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
            <strong>Upcoming dates</strong>
            {upcomingForCategory.length === 0 ? <p className="helper">No upcoming events in this category.</p> : null}
            {upcomingForCategory.map((event) => (
              <button
                key={event._id}
                type="button"
                className="event-choice"
                onClick={() => onSelectEvent(event._id)}
              >
                {formatIsoToLocal(event.scheduledAt)}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <strong>Event history</strong>
            {eventsForCategory.map((event) => (
              <button
                key={event._id}
                type="button"
                className={`event-choice ${selectedEvent?._id === event._id ? "active" : ""}`}
                onClick={() => onSelectEvent(event._id)}
              >
                <span>{formatIsoToLocal(event.scheduledAt)}</span>
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

function localDateTimeToIso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}

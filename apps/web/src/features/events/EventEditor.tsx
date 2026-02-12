import { useEffect, useState } from "react";

import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { formatIsoToLocal } from "../../lib/time/format";

interface EventAdjustment {
  fromAt: string;
  toAt: string;
  reason: string;
  adjustedAt: string;
}

interface EventRecord {
  _id: string;
  status: string;
  notes?: string;
  scheduledAt: string;
  originalScheduledAt: string;
  hasExplicitTime: boolean;
  eventConfigName: string;
  adjustments: EventAdjustment[];
}

interface EventEditorProps {
  event: EventRecord | null;
  onSave: (payload: { scheduledDate?: string; scheduledTime?: string; notes?: string; reason?: string }) => void;
  onDelete: () => void;
  onComplete: () => void;
  onMiss: () => void;
  onReschedulePlusDay: () => void;
  saving?: boolean;
  deleting?: boolean;
}

export function EventEditor({
  event,
  onSave,
  onDelete,
  onComplete,
  onMiss,
  onReschedulePlusDay,
  saving,
  deleting
}: EventEditorProps) {
  const [scheduledDateInput, setScheduledDateInput] = useState("");
  const [includeTime, setIncludeTime] = useState(false);
  const [scheduledTimeInput, setScheduledTimeInput] = useState("09:00");
  const [notesInput, setNotesInput] = useState("");
  const [reason, setReason] = useState("Adjusted by user");

  useEffect(() => {
    if (!event) {
      setScheduledDateInput("");
      setScheduledTimeInput("09:00");
      setIncludeTime(false);
      setNotesInput("");
      return;
    }

    setScheduledDateInput(isoToLocalDate(event.scheduledAt));
    setScheduledTimeInput(isoToLocalTime(event.scheduledAt));
    setIncludeTime(event.hasExplicitTime);
    setNotesInput(event.notes ?? "");
  }, [event]);

  if (!event) {
    return <p className="helper">Select an event to edit or delete.</p>;
  }

  const originalDate = isoToLocalDate(event.scheduledAt);
  const originalTime = isoToLocalTime(event.scheduledAt);
  const scheduledChanged =
    scheduledDateInput !== originalDate ||
    includeTime !== event.hasExplicitTime ||
    (includeTime && scheduledTimeInput !== originalTime);

  const savePayload = {
    notes: notesInput,
    scheduledDate: scheduledDateInput,
    scheduledTime: includeTime ? scheduledTimeInput : undefined,
    reason: scheduledChanged ? reason : undefined
  };

  return (
    <div className="event-editor">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>{event.eventConfigName}</strong>
          <p className="helper">Original: {formatIsoToLocal(event.originalScheduledAt, event.hasExplicitTime)}</p>
        </div>
        <Badge variant="accent">{event.status}</Badge>
      </div>

      <label htmlFor="eventEditorScheduledDate">Scheduled date</label>
      <input
        id="eventEditorScheduledDate"
        type="date"
        value={scheduledDateInput}
        onChange={(eventChange) => setScheduledDateInput(eventChange.target.value)}
      />

      <label htmlFor="eventEditorUseTime" style={{ marginTop: 8 }}>
        Include time
      </label>
      <select
        id="eventEditorUseTime"
        value={includeTime ? "yes" : "no"}
        onChange={(eventChange) => setIncludeTime(eventChange.target.value === "yes")}
      >
        <option value="no">No (date only)</option>
        <option value="yes">Yes</option>
      </select>

      {includeTime ? (
        <>
          <label htmlFor="eventEditorScheduledTime" style={{ marginTop: 8 }}>
            Scheduled time
          </label>
          <input
            id="eventEditorScheduledTime"
            type="time"
            value={scheduledTimeInput}
            onChange={(eventChange) => setScheduledTimeInput(eventChange.target.value)}
          />
        </>
      ) : null}

      <label htmlFor="eventEditorNotes" style={{ marginTop: 8 }}>
        Notes
      </label>
      <textarea
        id="eventEditorNotes"
        value={notesInput}
        onChange={(eventChange) => setNotesInput(eventChange.target.value)}
      />

      <label htmlFor="eventEditorReason" style={{ marginTop: 8 }}>
        Reason (required when date/time changes)
      </label>
      <input
        id="eventEditorReason"
        value={reason}
        onChange={(eventChange) => setReason(eventChange.target.value)}
      />

      <div className="row" style={{ marginTop: 10 }}>
        <Button variant="primary" disabled={saving} onClick={() => onSave(savePayload)}>
          Save event
        </Button>
        <Button variant="danger" disabled={deleting} onClick={onDelete}>
          Delete event
        </Button>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <Button variant="soft" onClick={onComplete}>
          Complete
        </Button>
        <Button variant="soft" onClick={onMiss}>
          Mark missed
        </Button>
        <Button variant="soft" onClick={onReschedulePlusDay}>
          +1 day
        </Button>
      </div>

      {event.adjustments.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          <strong>Adjustment history</strong>
          {event.adjustments.map((adjustment) => (
            <p className="helper" key={`${adjustment.adjustedAt}:${adjustment.toAt}`}>
              {`${formatIsoToLocal(adjustment.fromAt)} -> ${formatIsoToLocal(adjustment.toAt)} | ${adjustment.reason}`}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isoToLocalDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function isoToLocalTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "09:00";
  }

  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(11, 16);
}

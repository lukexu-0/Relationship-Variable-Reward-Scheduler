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
  templateName: string;
  adjustments: EventAdjustment[];
}

interface EventEditorProps {
  event: EventRecord | null;
  onSave: (payload: { scheduledAt?: string; notes?: string; reason?: string }) => void;
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
  const [scheduledAtInput, setScheduledAtInput] = useState("");
  const [notesInput, setNotesInput] = useState("");
  const [reason, setReason] = useState("Adjusted by user");

  useEffect(() => {
    if (!event) {
      setScheduledAtInput("");
      setNotesInput("");
      return;
    }

    setScheduledAtInput(isoToLocalDateTime(event.scheduledAt));
    setNotesInput(event.notes ?? "");
  }, [event]);

  if (!event) {
    return <p className="helper">Select an event to edit or delete.</p>;
  }

  const scheduledChanged = localDateTimeToIso(scheduledAtInput) !== event.scheduledAt;

  return (
    <div className="event-editor">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>{event.templateName}</strong>
          <p className="helper">Original: {formatIsoToLocal(event.originalScheduledAt)}</p>
        </div>
        <Badge variant="accent">{event.status}</Badge>
      </div>

      <label htmlFor="eventEditorScheduledAt">Scheduled date/time</label>
      <input
        id="eventEditorScheduledAt"
        type="datetime-local"
        value={scheduledAtInput}
        onChange={(eventChange) => setScheduledAtInput(eventChange.target.value)}
      />

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
        <Button
          variant="primary"
          disabled={saving}
          onClick={() =>
            onSave({
              notes: notesInput,
              scheduledAt: scheduledAtInput ? localDateTimeToIso(scheduledAtInput) : undefined,
              reason: scheduledChanged ? reason : undefined
            })
          }
        >
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

function isoToLocalDateTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function localDateTimeToIso(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString();
}

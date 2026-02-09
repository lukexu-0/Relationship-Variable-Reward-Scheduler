import { useEffect, useState } from "react";

import { Button } from "../../components/ui/Button";

type BlackoutDate = {
  startAt: string;
  endAt?: string;
  allDay?: boolean;
  note?: string;
};

interface BlackoutDatesEditorProps {
  blackoutDates: BlackoutDate[];
  onChange: (next: BlackoutDate[]) => void;
}

export function BlackoutDatesEditor({ blackoutDates, onChange }: BlackoutDatesEditorProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  useEffect(() => {
    if (blackoutDates.length === 0) {
      setSelectedIndex(0);
      return;
    }

    if (selectedIndex > blackoutDates.length - 1) {
      setSelectedIndex(blackoutDates.length - 1);
    }
  }, [blackoutDates, selectedIndex]);

  const selected = blackoutDates[selectedIndex] ?? null;

  return (
    <div className="blackout-editor">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <strong>Blackout dates</strong>
        <Button
          type="button"
          variant="soft"
          onClick={() => {
            const now = new Date();
            const next = [
              ...blackoutDates,
              {
                startAt: now.toISOString(),
                endAt: undefined,
                allDay: true,
                note: ""
              }
            ];
            onChange(next);
            setSelectedIndex(next.length - 1);
          }}
        >
          Add blackout
        </Button>
      </div>

      {blackoutDates.length === 0 ? <p className="helper">No blackout dates configured.</p> : null}

      {blackoutDates.map((entry, index) => (
        <button
          key={`${entry.startAt}:${index}`}
          type="button"
          className={`event-choice ${index === selectedIndex ? "active" : ""}`}
          onClick={() => setSelectedIndex(index)}
        >
          <span>{new Date(entry.startAt).toLocaleString()}</span>
          <span>{entry.note || (entry.allDay ? "All day" : "Timed")}</span>
        </button>
      ))}

      {selected ? (
        <div className="event-item" style={{ marginTop: 8 }}>
          <label htmlFor="blackoutStart">Start</label>
          <input
            id="blackoutStart"
            type="datetime-local"
            value={isoToLocalDateTime(selected.startAt)}
            onChange={(event) => updateSelected(selectedIndex, { startAt: localDateTimeToIso(event.target.value) })}
          />

          <label htmlFor="blackoutEnd" style={{ marginTop: 8 }}>
            End (optional)
          </label>
          <input
            id="blackoutEnd"
            type="datetime-local"
            value={selected.endAt ? isoToLocalDateTime(selected.endAt) : ""}
            onChange={(event) =>
              updateSelected(selectedIndex, {
                endAt: event.target.value ? localDateTimeToIso(event.target.value) : undefined
              })
            }
          />

          <label htmlFor="blackoutAllDay" style={{ marginTop: 8 }}>
            All day
          </label>
          <select
            id="blackoutAllDay"
            value={selected.allDay ? "true" : "false"}
            onChange={(event) => updateSelected(selectedIndex, { allDay: event.target.value === "true" })}
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>

          <label htmlFor="blackoutNote" style={{ marginTop: 8 }}>
            Note
          </label>
          <input
            id="blackoutNote"
            value={selected.note ?? ""}
            onChange={(event) => updateSelected(selectedIndex, { note: event.target.value })}
          />

          <div style={{ marginTop: 10 }}>
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                const next = blackoutDates.filter((_, index) => index !== selectedIndex);
                onChange(next);
              }}
            >
              Delete blackout
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );

  function updateSelected(index: number, patch: Partial<BlackoutDate>) {
    const next = blackoutDates.map((entry, entryIndex) =>
      entryIndex === index
        ? {
            ...entry,
            ...patch
          }
        : entry
    );
    onChange(next);
  }
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

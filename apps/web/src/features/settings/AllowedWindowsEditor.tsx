import type { ChangeEvent } from "react";

type AllowedWindow = { weekday: number; startLocalTime: string; endLocalTime: string };

interface AllowedWindowsEditorProps {
  allowedWindows: AllowedWindow[];
  onChange: (next: AllowedWindow[]) => void;
}

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" }
] as const;

export function AllowedWindowsEditor({ allowedWindows, onChange }: AllowedWindowsEditorProps) {
  const byWeekday = new Map(allowedWindows.map((window) => [window.weekday, window]));

  return (
    <div className="allowed-windows-editor">
      <strong>Allowed windows</strong>
      <p className="helper">Defaults to all 7 days. Disable days where events should never be scheduled.</p>

      <div className="allowed-windows-grid">
        {WEEKDAYS.map((day) => {
          const current = byWeekday.get(day.value);
          const enabled = Boolean(current);
          return (
            <div className="allowed-window-row" key={day.value}>
              <label htmlFor={`weekday-enabled-${day.value}`}>{day.label}</label>
              <select
                id={`weekday-enabled-${day.value}`}
                value={enabled ? "true" : "false"}
                onChange={(event) => onEnabledChange(day.value, event)}
              >
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>

              <input
                type="time"
                aria-label={`${day.label} start`}
                value={current?.startLocalTime ?? "09:00"}
                disabled={!enabled}
                onChange={(event) => onWindowTimeChange(day.value, "startLocalTime", event.target.value)}
              />
              <input
                type="time"
                aria-label={`${day.label} end`}
                value={current?.endLocalTime ?? "21:00"}
                disabled={!enabled}
                onChange={(event) => onWindowTimeChange(day.value, "endLocalTime", event.target.value)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  function onEnabledChange(weekday: number, event: ChangeEvent<HTMLSelectElement>) {
    const enabled = event.target.value === "true";
    const next = allowedWindows.filter((window) => window.weekday !== weekday);
    if (enabled) {
      next.push({ weekday, startLocalTime: "09:00", endLocalTime: "21:00" });
    }
    onChange(sortByWeekday(next));
  }

  function onWindowTimeChange(
    weekday: number,
    key: "startLocalTime" | "endLocalTime",
    value: string
  ) {
    const next = allowedWindows.map((window) =>
      window.weekday === weekday ? { ...window, [key]: value } : window
    );
    onChange(sortByWeekday(next));
  }
}

function sortByWeekday(windows: AllowedWindow[]) {
  return [...windows].sort((left, right) => left.weekday - right.weekday);
}

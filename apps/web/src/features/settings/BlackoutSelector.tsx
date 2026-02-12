import { BlackoutDatesEditor } from "./BlackoutDatesEditor";

type BlackoutDate = {
  startAt: string;
  endAt?: string;
  allDay?: boolean;
  note?: string;
};

interface BlackoutSelectorProps {
  recurringBlackoutWeekdays: number[];
  blackoutDates: BlackoutDate[];
  onRecurringChange: (next: number[]) => void;
  onDatesChange: (next: BlackoutDate[]) => void;
}

const DAYS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" }
] as const;

export function BlackoutSelector({
  recurringBlackoutWeekdays,
  blackoutDates,
  onRecurringChange,
  onDatesChange
}: BlackoutSelectorProps) {
  return (
    <div className="blackout-selector">
      <strong>Blackout controls</strong>
      <p className="helper">Use recurring weekdays and specific date ranges together.</p>

      <div className="blackout-weekday-grid" role="group" aria-label="Recurring blackout weekdays">
        {DAYS.map((day) => {
          const checked = recurringBlackoutWeekdays.includes(day.value);
          return (
            <label key={day.value} className={`blackout-weekday-chip ${checked ? "active" : ""}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(event) => {
                  if (event.target.checked) {
                    onRecurringChange([...recurringBlackoutWeekdays, day.value].sort((a, b) => a - b));
                    return;
                  }
                  onRecurringChange(recurringBlackoutWeekdays.filter((weekday) => weekday !== day.value));
                }}
              />
              <span>{day.label}</span>
            </label>
          );
        })}
      </div>

      <div style={{ marginTop: 12 }}>
        <BlackoutDatesEditor blackoutDates={blackoutDates} onChange={onDatesChange} />
      </div>
    </div>
  );
}

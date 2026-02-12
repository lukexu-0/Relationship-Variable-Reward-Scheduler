import { useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";

interface CalendarEvent {
  _id: string;
  scheduledAt: string;
  hasExplicitTime: boolean;
  status: string;
  eventConfigName: string;
  eventConfigId: string;
}

interface EventCalendarProps {
  events: CalendarEvent[];
  selectedEventConfigId: string | null;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onSelectEvent: (eventId: string) => void;
  onOpenScheduleSettings: () => void;
}

export function EventCalendar({
  events,
  selectedEventConfigId,
  selectedDate,
  onSelectDate,
  onSelectEvent,
  onOpenScheduleSettings
}: EventCalendarProps) {
  const [monthAnchor, setMonthAnchor] = useState(() => startOfMonth(new Date()));

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of events) {
      const key = toLocalDateKey(event.scheduledAt);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(event);
    }
    return grouped;
  }, [events]);

  const days = useMemo(() => buildCalendarDays(monthAnchor), [monthAnchor]);
  const monthLabel = monthAnchor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const highlightedDates = useMemo(() => {
    if (!selectedEventConfigId) {
      return new Set<string>();
    }

    const dates = new Set<string>();
    for (const event of events) {
      if (event.eventConfigId === selectedEventConfigId) {
        dates.add(toLocalDateKey(event.scheduledAt));
      }
    }
    return dates;
  }, [events, selectedEventConfigId]);
  const highlightedInViewCount = useMemo(
    () => days.filter((day) => highlightedDates.has(toDateKey(day))).length,
    [days, highlightedDates]
  );

  return (
    <div className="calendar-shell">
      <div className="calendar-header">
        <div className="calendar-header-actions">
          <Button
            variant="ghost"
            type="button"
            className="calendar-settings-button"
            onClick={onOpenScheduleSettings}
          >
            <SettingsIcon />
            <span>Schedule Settings</span>
          </Button>
          <div className="calendar-month-jump">
            <label htmlFor="calendarMonthJump" className="helper">
              Go to month
            </label>
            <input
              id="calendarMonthJump"
              type="month"
              aria-label="Go to month"
              value={toMonthInput(monthAnchor)}
              onChange={(event) => {
                const nextMonth = fromMonthInput(event.target.value);
                if (!nextMonth) {
                  return;
                }
                setMonthAnchor(nextMonth);
              }}
            />
          </div>
          <div className="row">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setMonthAnchor((prev) => startOfMonth(addMonths(prev, -1)))}
            >
              Prev
            </Button>
            <Button
              variant="ghost"
              type="button"
              onClick={() => setMonthAnchor((prev) => startOfMonth(addMonths(prev, 1)))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
      <p className="helper">{monthLabel}</p>
      <div className="calendar-legend">
        <span className="calendar-legend-item">
          <span className="calendar-legend-swatch has-events" />
          Any events
        </span>
        <span className="calendar-legend-item">
          <span className="calendar-legend-swatch highlighted-events" />
          Selected event dates
          {selectedEventConfigId ? ` (${highlightedInViewCount})` : ""}
        </span>
      </div>

      <div className="calendar-grid-head">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => {
          const key = toDateKey(day);
          const dayEvents = eventsByDate.get(key) ?? [];
          const inCurrentMonth = day.getMonth() === monthAnchor.getMonth();
          const active = selectedDate === key;
          const hasEvents = dayEvents.length > 0;
          const highlighted = highlightedDates.has(key);
          const className = [
            "calendar-day",
            inCurrentMonth ? "" : "outside",
            active ? "active" : "",
            hasEvents ? "has-events" : "",
            highlighted ? "highlighted-events" : ""
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={key}
              type="button"
              className={className}
              onClick={() => {
                onSelectDate(key);
                if (dayEvents.length > 0) {
                  onSelectEvent(dayEvents[0]._id);
                }
              }}
            >
              <span className="calendar-day-number">{day.getDate()}</span>
              <span className="calendar-day-events">
                {dayEvents.slice(0, 2).map((event) => (
                  <span key={event._id} className="calendar-event-pill">
                    {event.eventConfigName}
                  </span>
                ))}
                {dayEvents.length > 2 ? <span className="calendar-more">+{dayEvents.length - 2}</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function buildCalendarDays(monthStart: Date): Date[] {
  const start = new Date(monthStart);
  start.setDate(1);
  start.setDate(start.getDate() - start.getDay());

  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1, 0);
  const end = new Date(monthEnd);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function toDateKey(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function toMonthInput(value: Date): string {
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}`;
}

function fromMonthInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return new Date(year, month - 1, 1);
}

function toLocalDateKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return toDateKey(date);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M19.14 12.94a7.43 7.43 0 0 0 .05-.94c0-.32-.02-.63-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.24 7.24 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.23-1.12.54-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.03.31-.06.62-.06.94s.03.63.06.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.13.23.4.32.64.22l2.35-.95c.51.39 1.07.71 1.67.95l.36 2.5c.04.24.25.42.49.42h3.8c.24 0 .45-.18.49-.42l.36-2.5c.6-.24 1.16-.56 1.67-.95l2.35.95c.24.1.51 0 .64-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  );
}

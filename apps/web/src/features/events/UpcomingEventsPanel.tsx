import { useEffect, useMemo, useState } from "react";

import { Button } from "../../components/ui/Button";
import { formatIsoToLocal } from "../../lib/time/format";

const COLLAPSED_PAST_EVENTS_COUNT = 8;

interface UpcomingEventRecord {
  _id: string;
  status: string;
  scheduledAt: string;
  hasExplicitTime: boolean;
  eventConfigName: string;
}

interface UpcomingEventsPanelProps {
  selectedEventConfigName?: string;
  selectedEventId: string | null;
  eventsForConfig: UpcomingEventRecord[];
  upcomingEvents: UpcomingEventRecord[];
  onSelectEvent: (eventId: string) => void;
  onDeleteEvent: (eventId: string) => void;
}

export function UpcomingEventsPanel({
  selectedEventConfigName,
  selectedEventId,
  eventsForConfig,
  upcomingEvents,
  onSelectEvent,
  onDeleteEvent
}: UpcomingEventsPanelProps) {
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const upcomingEventIds = useMemo(() => new Set(upcomingEvents.map((event) => event._id)), [upcomingEvents]);
  const pastEvents = useMemo(
    () =>
      eventsForConfig
        .filter((event) => !upcomingEventIds.has(event._id))
        .sort((left, right) => new Date(right.scheduledAt).getTime() - new Date(left.scheduledAt).getTime()),
    [eventsForConfig, upcomingEventIds]
  );
  const hasTruncatedPast = pastEvents.length > COLLAPSED_PAST_EVENTS_COUNT;
  const visiblePastEvents =
    hasTruncatedPast && !isHistoryDrawerOpen ? pastEvents.slice(0, COLLAPSED_PAST_EVENTS_COUNT) : pastEvents;

  useEffect(() => {
    setIsHistoryDrawerOpen(false);
  }, [selectedEventConfigName]);

  if (!selectedEventConfigName) {
    return <p className="helper">Select an event from the left panel to view upcoming dates.</p>;
  }

  return (
    <div className="upcoming-panel">
      <div className="upcoming-panel-section">
        <strong>Upcoming</strong>
        {upcomingEvents.length === 0 ? <p className="helper">No upcoming events for this event.</p> : null}
        {upcomingEvents.map((event) => (
          <div
            key={event._id}
            data-testid="upcoming-event-row"
            className={`event-choice upcoming-choice ${selectedEventId === event._id ? "active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => onSelectEvent(event._id)}
            onKeyDown={(keyEvent) => {
              if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                keyEvent.preventDefault();
                onSelectEvent(event._id);
              }
            }}
          >
            <span>{formatIsoToLocal(event.scheduledAt, event.hasExplicitTime)}</span>
            <span className="upcoming-actions">
              <span className="helper">{event.status}</span>
              <button
                className="event-trash-btn"
                type="button"
                title="Delete upcoming event"
                aria-label="Delete upcoming event"
                onClick={(clickEvent) => {
                  clickEvent.preventDefault();
                  clickEvent.stopPropagation();
                  onDeleteEvent(event._id);
                }}
              >
                <TrashIcon />
              </button>
            </span>
          </div>
        ))}
      </div>

      <div className="upcoming-panel-section">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <strong>Past events</strong>
          {hasTruncatedPast ? (
            <Button
              variant="ghost"
              type="button"
              className="history-drawer-toggle"
              onClick={() => setIsHistoryDrawerOpen((open) => !open)}
            >
              {isHistoryDrawerOpen ? "Collapse history" : `Open history drawer (${pastEvents.length})`}
            </Button>
          ) : null}
        </div>
        {pastEvents.length === 0 ? <p className="helper">No past events yet.</p> : null}
        {visiblePastEvents.map((event) => (
          <button
            key={event._id}
            data-testid="past-event-row"
            type="button"
            className={`event-choice ${selectedEventId === event._id ? "active" : ""}`}
            onClick={() => onSelectEvent(event._id)}
          >
            <span>{formatIsoToLocal(event.scheduledAt, event.hasExplicitTime)}</span>
            <span>{event.status}</span>
          </button>
        ))}
        {hasTruncatedPast && !isHistoryDrawerOpen ? (
          <p className="helper">
            Showing {COLLAPSED_PAST_EVENTS_COUNT} of {pastEvents.length} past events.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M9 3h6l1 2h4v2H4V5h4l1-2Zm1 6h2v8h-2V9Zm4 0h2v8h-2V9ZM7 9h2v8H7V9Zm-1 11h12l1-13H5l1 13Z"
      />
    </svg>
  );
}

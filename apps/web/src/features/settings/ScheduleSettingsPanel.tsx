import { useEffect, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { BlackoutDatesEditor } from "./BlackoutDatesEditor";

interface ScheduleSettingsPanelProps {
  profileId: string | null;
  settings: {
    timezone: string;
    reminderLeadHours: number;
    minGapHours: number;
    allowedWindows: Array<{ weekday: number; startLocalTime: string; endLocalTime: string }>;
    blackoutDates: Array<{ startAt: string; endAt?: string; allDay?: boolean; note?: string }>;
  };
  onSave: (payload: {
    timezone: string;
    reminderLeadHours: number;
    minGapHours: number;
    allowedWindows: Array<{ weekday: number; startLocalTime: string; endLocalTime: string }>;
    blackoutDates: Array<{ startAt: string; endAt?: string; allDay?: boolean; note?: string }>;
  }) => void;
  saving?: boolean;
}

export function ScheduleSettingsPanel({ profileId, settings, onSave, saving }: ScheduleSettingsPanelProps) {
  const [timezone, setTimezone] = useState(settings.timezone);
  const [reminderLeadHours, setReminderLeadHours] = useState(24);
  const [minGapHours, setMinGapHours] = useState(24);
  const [windowsJson, setWindowsJson] = useState(
    '[{"weekday":1,"startLocalTime":"18:00","endLocalTime":"21:00"}]'
  );
  const [blackoutDates, setBlackoutDates] = useState<
    Array<{ startAt: string; endAt?: string; allDay?: boolean; note?: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTimezone(settings.timezone);
    setReminderLeadHours(settings.reminderLeadHours);
    setMinGapHours(settings.minGapHours);
    setWindowsJson(JSON.stringify(settings.allowedWindows, null, 2));
    setBlackoutDates(settings.blackoutDates);
  }, [settings]);

  return (
    <Card title="Schedule Settings" subtitle="Allowed windows, blackouts, timezone, and reminder lead-time">
      {!profileId ? <p className="helper">Select a profile to configure scheduling.</p> : null}

      {profileId ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            try {
              setError(null);
              const allowedWindows = JSON.parse(windowsJson);
              onSave({
                timezone,
                reminderLeadHours,
                minGapHours,
                allowedWindows,
                blackoutDates
              });
            } catch (mutationError) {
              setError(mutationError instanceof Error ? mutationError.message : "Failed to save settings");
            }
          }}
        >
          <label htmlFor="timezone">Timezone</label>
          <input
            id="timezone"
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            required
          />

          <div className="row" style={{ marginTop: 8 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="lead">Reminder lead hours</label>
              <input
                id="lead"
                type="number"
                min={1}
                max={168}
                value={reminderLeadHours}
                onChange={(event) => setReminderLeadHours(Number(event.target.value))}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="gap">Min gap hours</label>
              <input
                id="gap"
                type="number"
                min={1}
                max={720}
                value={minGapHours}
                onChange={(event) => setMinGapHours(Number(event.target.value))}
              />
            </div>
          </div>

          <label htmlFor="windows" style={{ marginTop: 8 }}>
            Allowed windows JSON
          </label>
          <textarea
            id="windows"
            value={windowsJson}
            onChange={(event) => setWindowsJson(event.target.value)}
          />

          <div style={{ marginTop: 12 }}>
            <BlackoutDatesEditor blackoutDates={blackoutDates} onChange={setBlackoutDates} />
          </div>

          {error ? <p style={{ color: "#8a2222" }}>{error}</p> : null}
          <div style={{ marginTop: 10 }}>
            <Button type="submit" disabled={saving}>
              Save settings
            </Button>
          </div>
        </form>
      ) : null}
    </Card>
  );
}

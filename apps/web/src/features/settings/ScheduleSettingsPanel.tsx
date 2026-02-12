import { useEffect, useState } from "react";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { AllowedWindowsEditor } from "./AllowedWindowsEditor";
import { BlackoutSelector } from "./BlackoutSelector";

interface ScheduleSettingsPanelProps {
  profileId: string | null;
  settings: {
    timezone: string;
    reminderLeadHours: number;
    minGapHours: number;
    allowedWindows: Array<{ weekday: number; startLocalTime: string; endLocalTime: string }>;
    recurringBlackoutWeekdays: number[];
    blackoutDates: Array<{ startAt: string; endAt?: string; allDay?: boolean; note?: string }>;
  };
  onSave: (payload: {
    timezone: string;
    reminderLeadHours: number;
    minGapHours: number;
    allowedWindows: Array<{ weekday: number; startLocalTime: string; endLocalTime: string }>;
    recurringBlackoutWeekdays: number[];
    blackoutDates: Array<{ startAt: string; endAt?: string; allDay?: boolean; note?: string }>;
  }) => void;
  saving?: boolean;
}

export function ScheduleSettingsPanel({ profileId, settings, onSave, saving }: ScheduleSettingsPanelProps) {
  const [timezone, setTimezone] = useState(settings.timezone);
  const [reminderLeadHours, setReminderLeadHours] = useState(24);
  const [minGapHours, setMinGapHours] = useState(24);
  const [allowedWindows, setAllowedWindows] = useState<
    Array<{ weekday: number; startLocalTime: string; endLocalTime: string }>
  >([]);
  const [recurringBlackoutWeekdays, setRecurringBlackoutWeekdays] = useState<number[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<
    Array<{ startAt: string; endAt?: string; allDay?: boolean; note?: string }>
  >([]);

  useEffect(() => {
    setTimezone(settings.timezone);
    setReminderLeadHours(settings.reminderLeadHours);
    setMinGapHours(settings.minGapHours);
    setAllowedWindows(settings.allowedWindows);
    setRecurringBlackoutWeekdays(settings.recurringBlackoutWeekdays);
    setBlackoutDates(settings.blackoutDates);
  }, [settings]);

  return (
    <Card title="Schedule Settings" subtitle="Allowed windows, blackout rules, timezone, and reminder lead-time">
      {!profileId ? <p className="helper">Select a profile to configure scheduling.</p> : null}

      {profileId ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onSave({
              timezone,
              reminderLeadHours,
              minGapHours,
              allowedWindows,
              recurringBlackoutWeekdays,
              blackoutDates
            });
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

          <div style={{ marginTop: 12 }}>
            <AllowedWindowsEditor allowedWindows={allowedWindows} onChange={setAllowedWindows} />
          </div>

          <div style={{ marginTop: 12 }}>
            <BlackoutSelector
              recurringBlackoutWeekdays={recurringBlackoutWeekdays}
              blackoutDates={blackoutDates}
              onRecurringChange={setRecurringBlackoutWeekdays}
              onDatesChange={setBlackoutDates}
            />
          </div>

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

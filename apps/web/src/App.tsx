import { useMemo, useState } from "react";

import { Badge } from "./components/ui/Badge";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";
import { AuthPanel } from "./features/auth/AuthPanel";
import { AuthProvider, useAuth } from "./features/auth/useAuth";
import { useDashboardData } from "./features/dashboard/useDashboardData";
import { EventSetInspector } from "./features/event-sets/EventSetInspector";
import { EventSetList } from "./features/event-sets/EventSetList";
import { ScheduleSettingsPanel } from "./features/settings/ScheduleSettingsPanel";

function Dashboard() {
  const auth = useAuth();
  const [profileName, setProfileName] = useState("");
  const [partnerName, setPartnerName] = useState("");

  const dashboard = useDashboardData({
    accessToken: auth.accessToken ?? "",
    fallbackTimezone: auth.user?.timezone ?? "UTC"
  });

  if (auth.loading) {
    return <div className="page">Loading...</div>;
  }

  if (!auth.accessToken || !auth.user) {
    return <AuthPanel />;
  }

  const setListItems = useMemo(
    () =>
      dashboard.templates.map((template) => {
        const eventsInCategory = dashboard.events.filter((event) => event.category === template.category);
        const upcomingCount = eventsInCategory.filter(
          (event) =>
            (event.status === "SCHEDULED" || event.status === "RESCHEDULED") &&
            new Date(event.scheduledAt).getTime() > Date.now()
        ).length;

        return {
          category: template.category,
          name: template.name,
          totalCount: eventsInCategory.length,
          upcomingCount
        };
      }),
    [dashboard.events, dashboard.templates]
  );

  const activeError = [
    dashboard.createSetMutation,
    dashboard.updateSetMutation,
    dashboard.createEventMutation,
    dashboard.updateEventMutation,
    dashboard.deleteEventMutation,
    dashboard.saveSettingsMutation,
    dashboard.createProfileMutation
  ].find((mutation) => mutation.error)?.error;

  return (
    <div className="page page-shell">
      <header className="hero">
        <div>
          <h1>Variable Reward Scheduler</h1>
          <p>
            Signed in as {auth.user.email} ({auth.user.timezone})
          </p>
        </div>
        <Button variant="soft" onClick={auth.logout}>
          Logout
        </Button>
      </header>

      {activeError ? (
        <p className="error-banner">
          {activeError instanceof Error ? activeError.message : "A request failed."}
        </p>
      ) : null}

      <main className="dashboard-grid">
        <aside className="dashboard-left">
          <Card title="Profiles" subtitle="Create and switch relationship contexts">
            <div className="profile-list">
              {dashboard.profiles.map((profile) => (
                <div className="profile-item" key={profile._id}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong>{profile.profileName}</strong>
                      {profile.partnerName ? <span className="helper"> with {profile.partnerName}</span> : null}
                    </div>
                    <div className="row">
                      {dashboard.selectedProfileId === profile._id ? <Badge variant="accent">Selected</Badge> : null}
                      <Button variant="soft" onClick={() => dashboard.setSelectedProfileId(profile._id)}>
                        Use
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <hr style={{ borderColor: "var(--line)", opacity: 0.5 }} />

            <form
              onSubmit={(event) => {
                event.preventDefault();
                dashboard.createProfileMutation.mutate({ profileName, partnerName: partnerName || undefined });
                setProfileName("");
                setPartnerName("");
              }}
            >
              <label htmlFor="topProfileName">Profile name</label>
              <input
                id="topProfileName"
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                required
              />

              <label htmlFor="topPartnerName" style={{ marginTop: 8 }}>
                Partner name (optional)
              </label>
              <input
                id="topPartnerName"
                value={partnerName}
                onChange={(event) => setPartnerName(event.target.value)}
              />

              <div style={{ marginTop: 10 }}>
                <Button type="submit" disabled={dashboard.createProfileMutation.isPending}>
                  Create profile
                </Button>
              </div>
            </form>
          </Card>

          <Card title="Category Sets" subtitle="Select and manage one set per category">
            <EventSetList
              items={setListItems}
              selectedCategory={dashboard.selectedCategory}
              onSelect={dashboard.setSelectedCategory}
            />
            <hr style={{ borderColor: "var(--line)", opacity: 0.5 }} />
            <EventSetInspector
              selectedSet={dashboard.selectedSet}
              eventsForCategory={dashboard.eventsForSelectedCategory}
              upcomingForCategory={dashboard.upcomingForSelectedCategory}
              selectedEvent={dashboard.selectedEvent}
              missedOptions={dashboard.missedOptions}
              onSelectEvent={dashboard.setSelectedEventId}
              onCreateSet={(payload) => dashboard.createSetMutation.mutate(payload)}
              onUpdateSet={({ templateId, patch }) =>
                dashboard.updateSetMutation.mutate({ templateId, payload: patch })
              }
              onCreateEvent={(payload) => dashboard.createEventMutation.mutate(payload)}
              onSaveEvent={(eventId, payload) =>
                dashboard.updateEventMutation.mutate({ eventId, payload })
              }
              onDeleteEvent={(eventId) => {
                const confirmed = window.confirm("Delete this event permanently?");
                if (!confirmed) {
                  return;
                }
                dashboard.deleteEventMutation.mutate(eventId);
              }}
              onCompleteEvent={(eventId) => dashboard.completeEventMutation.mutate(eventId)}
              onMissEvent={(eventId) => dashboard.missEventMutation.mutate(eventId)}
              onRescheduleEventPlusDay={(eventId) =>
                dashboard.rescheduleEventMutation.mutate({
                  eventId,
                  scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                  reason: "Adjusted by user"
                })
              }
              onApplyMissedOption={(optionId) =>
                dashboard.applyMissedOptionMutation.mutate({
                  optionId,
                  reason: "Applied from set inspector"
                })
              }
              creatingSet={dashboard.createSetMutation.isPending}
              updatingSet={dashboard.updateSetMutation.isPending}
              creatingEvent={dashboard.createEventMutation.isPending}
              savingEvent={dashboard.updateEventMutation.isPending}
              deletingEvent={dashboard.deleteEventMutation.isPending}
            />
          </Card>
        </aside>

        <section className="dashboard-main">
          <ScheduleSettingsPanel
            profileId={dashboard.selectedProfileId}
            settings={dashboard.settings}
            onSave={(payload) => dashboard.saveSettingsMutation.mutate(payload)}
            saving={dashboard.saveSettingsMutation.isPending}
          />
        </section>
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <Dashboard />
    </AuthProvider>
  );
}

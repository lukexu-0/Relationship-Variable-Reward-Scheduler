import { Component, useEffect, useState, type ReactNode } from "react";

import type { AuthUser } from "./lib/api/client";
import { Badge } from "./components/ui/Badge";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";
import { AuthPanel } from "./features/auth/AuthPanel";
import { AuthProvider, useAuth } from "./features/auth/useAuth";
import { useDashboardData } from "./features/dashboard/useDashboardData";
import { EventSetInspector } from "./features/event-sets/EventSetInspector";
import { EventSetList } from "./features/event-sets/EventSetList";
import { EventCalendar } from "./features/events/EventCalendar";
import { UpcomingEventsPanel } from "./features/events/UpcomingEventsPanel";
import { ScheduleSettingsPanel } from "./features/settings/ScheduleSettingsPanel";

function Dashboard() {
  const auth = useAuth();

  if (auth.loading) {
    return <div className="page">Loading...</div>;
  }

  if (!auth.accessToken || !auth.user) {
    return <AuthPanel />;
  }

  return (
    <AuthenticatedDashboard
      accessToken={auth.accessToken}
      user={auth.user}
      onLogout={auth.logout}
    />
  );
}

interface AuthenticatedDashboardProps {
  accessToken: string;
  user: AuthUser;
  onLogout: () => Promise<void>;
}

function AuthenticatedDashboard({ accessToken, user, onLogout }: AuthenticatedDashboardProps) {
  const [profileCreateOpen, setProfileCreateOpen] = useState(false);
  const [isEventBuilderOpen, setIsEventBuilderOpen] = useState(false);
  const [isScheduleSettingsOpen, setIsScheduleSettingsOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [partnerName, setPartnerName] = useState("");

  const dashboard = useDashboardData({
    accessToken,
    fallbackTimezone: user.timezone
  });

  useEffect(() => {
    if (!isScheduleSettingsOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsScheduleSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isScheduleSettingsOpen]);

  if (dashboard.loading) {
    return <div className="page">Loading dashboard...</div>;
  }

  const eventListItems = dashboard.eventConfigs.map((eventConfig) => {
    const eventsForConfig = dashboard.events.filter((event) => event.eventConfigId === eventConfig._id);
    const upcomingCount = eventsForConfig.filter(
      (event) =>
        (event.status === "SCHEDULED" || event.status === "RESCHEDULED") &&
        new Date(event.scheduledAt).getTime() > Date.now()
    ).length;

    return {
      id: eventConfig._id,
      slug: eventConfig.slug,
      name: eventConfig.name,
      totalCount: eventsForConfig.length,
      upcomingCount
    };
  });

  const activeError = [
    dashboard.createEventConfigMutation,
    dashboard.updateEventConfigMutation,
    dashboard.deleteEventConfigMutation,
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
            Signed in as {user.email} ({user.timezone})
          </p>
        </div>
        <Button variant="soft" onClick={onLogout}>
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
                      {dashboard.selectedProfileId === profile._id ? (
                        <Badge variant="accent" className="profile-selected-badge">
                          Selected
                        </Badge>
                      ) : null}
                      <Button variant="soft" onClick={() => dashboard.setSelectedProfileId(profile._id)}>
                        Use
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="profile-create-toggle-row">
              <Button
                variant="ghost"
                type="button"
                className={`profile-create-toggle ${profileCreateOpen ? "is-open" : ""}`}
                onClick={() => setProfileCreateOpen((open) => !open)}
              >
                <span>New profile</span>
                <span className="profile-create-toggle-arrow" aria-hidden="true">
                  ▾
                </span>
              </Button>
            </div>

            <div className={`profile-create-panel ${profileCreateOpen ? "open" : ""}`}>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  dashboard.createProfileMutation.mutate({ profileName, partnerName: partnerName || undefined });
                  setProfileName("");
                  setPartnerName("");
                  setProfileCreateOpen(false);
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
            </div>
          </Card>

          <Card
            title="Events"
            headerAction={
              <Button
                variant="ghost"
                type="button"
                className={`events-builder-toggle ${isEventBuilderOpen ? "is-open" : ""}`}
                onClick={() => setIsEventBuilderOpen((open) => !open)}
              >
                <span>Event Builder</span>
                <span className="events-builder-toggle-arrow" aria-hidden="true">
                  ▾
                </span>
              </Button>
            }
          >
            <EventSetList
              items={eventListItems}
              selectedEventConfigId={dashboard.selectedEventConfigId}
              onSelect={dashboard.setSelectedEventConfigId}
            />
            {isEventBuilderOpen ? (
              <>
                <hr style={{ borderColor: "var(--line)", opacity: 0.5 }} />
                <EventSetInspector
                  selectedEventConfig={dashboard.selectedEventConfig}
                  eventsForConfig={dashboard.eventsForSelectedConfig}
                  upcomingForConfig={dashboard.upcomingForSelectedConfig}
                  selectedEvent={dashboard.selectedEvent}
                  missedOptions={dashboard.missedOptions}
                  onSelectEvent={dashboard.setSelectedEventId}
                  onCreateEventConfig={(payload) => dashboard.createEventConfigMutation.mutate(payload)}
                  onUpdateEventConfig={({ eventConfigId, patch }) =>
                    dashboard.updateEventConfigMutation.mutate({ eventConfigId, payload: patch })
                  }
                  onDeleteEventConfig={(eventConfigId) => {
                    const confirmed = window.confirm("Delete this event config and all linked events?");
                    if (!confirmed) {
                      return;
                    }
                    dashboard.deleteEventConfigMutation.mutate(eventConfigId);
                  }}
                  onCreateEvent={(payload) => dashboard.createEventMutation.mutate(payload)}
                  onSaveEvent={(eventId, payload) =>
                    dashboard.updateEventMutation.mutate({ eventId, payload })
                  }
                  onDeleteEvent={(eventId) => {
                    dashboard.deleteEventMutation.mutate(eventId);
                  }}
                  onCompleteEvent={(eventId) => dashboard.completeEventMutation.mutate(eventId)}
                  onMissEvent={(eventId) => dashboard.missEventMutation.mutate(eventId)}
                  onRescheduleEventPlusDay={(eventId) =>
                    dashboard.rescheduleEventMutation.mutate({
                      eventId,
                      scheduledDate: toDateInput(new Date(Date.now() + 24 * 60 * 60 * 1000)),
                      reason: "Adjusted by user"
                    })
                  }
                  onApplyMissedOption={(optionId) =>
                    dashboard.applyMissedOptionMutation.mutate({
                      optionId,
                      reason: "Applied from event inspector"
                    })
                  }
                  creatingEventConfig={dashboard.createEventConfigMutation.isPending}
                  updatingEventConfig={dashboard.updateEventConfigMutation.isPending}
                  deletingEventConfig={dashboard.deleteEventConfigMutation.isPending}
                  creatingEvent={dashboard.createEventMutation.isPending}
                  savingEvent={dashboard.updateEventMutation.isPending}
                  deletingEvent={dashboard.deleteEventMutation.isPending}
                />
              </>
            ) : null}
          </Card>
        </aside>

        <section className="dashboard-main">
          <Card title="Calendar" subtitle="Monthly event view">
            <EventCalendar
              events={dashboard.events}
              selectedEventConfigId={dashboard.selectedEventConfigId}
              selectedDate={dashboard.selectedCalendarDate}
              onSelectDate={dashboard.setSelectedCalendarDate}
              onSelectEvent={dashboard.setSelectedEventId}
              onOpenScheduleSettings={() => setIsScheduleSettingsOpen(true)}
            />
          </Card>
          <Card
            title={
              dashboard.selectedEventConfig
                ? `Upcoming Events for ${dashboard.selectedEventConfig.name}`
                : "Upcoming Events"
            }
          >
            <UpcomingEventsPanel
              selectedEventConfigName={dashboard.selectedEventConfig?.name}
              selectedEventId={dashboard.selectedEvent?._id ?? null}
              eventsForConfig={dashboard.eventsForSelectedConfig}
              upcomingEvents={dashboard.upcomingForSelectedConfig}
              onSelectEvent={dashboard.setSelectedEventId}
              onDeleteEvent={(eventId) => {
                dashboard.deleteEventMutation.mutate(eventId);
              }}
            />
          </Card>
        </section>
      </main>

      {isScheduleSettingsOpen ? (
        <div
          className="settings-modal-backdrop"
          data-testid="settings-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsScheduleSettingsOpen(false);
            }
          }}
        >
          <div className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="schedule-settings-title">
            <div className="settings-modal-header">
              <h3 id="schedule-settings-title">Schedule Settings</h3>
              <Button variant="ghost" type="button" onClick={() => setIsScheduleSettingsOpen(false)}>
                Close
              </Button>
            </div>
            <div className="settings-modal-body">
              <ScheduleSettingsPanel
                profileId={dashboard.selectedProfileId}
                settings={dashboard.settings}
                onSave={(payload) => dashboard.saveSettingsMutation.mutate(payload)}
                saving={dashboard.saveSettingsMutation.isPending}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <DashboardErrorBoundary>
        <Dashboard />
      </DashboardErrorBoundary>
    </AuthProvider>
  );
}

interface DashboardErrorBoundaryProps {
  children: ReactNode;
}

interface DashboardErrorBoundaryState {
  hasError: boolean;
}

class DashboardErrorBoundary extends Component<
  DashboardErrorBoundaryProps,
  DashboardErrorBoundaryState
> {
  state: DashboardErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): DashboardErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Dashboard render failure", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page" style={{ maxWidth: 680 }}>
          <Card
            title="UI failed to render"
            subtitle="Reload the page. If this persists, restart the local stack."
          >
            <p className="helper">
              Try hard refresh and clear local storage key <code>reward-auth</code>.
            </p>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

function toDateInput(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

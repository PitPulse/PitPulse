import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { SyncEventForm } from "./sync-event-form";
import { LeaveTeamButton } from "@/components/leave-team-button";
import { CopyInviteLink } from "@/components/copy-invite-link";
import { SortableEvents } from "@/components/sortable-events";
import { AnimateIn, StaggerGroup, StaggerChild } from "@/components/ui/animate-in";
import { TEAM_AI_WINDOW_MS, peekRateLimit } from "@/lib/rate-limit";
import { getTeamAiPromptLimits } from "@/lib/platform-settings";
import { UsageLimitMeter } from "./usage-limit-meter";
import { UpgradeSupporterButton } from "@/components/upgrade-supporter-button";

export const metadata: Metadata = {
  title: "Dashboard | PitPilot",
  description: "Your FRC scouting dashboard — manage events, view data, and access AI strategy tools.",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get profile with org info
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .single();

  // If no org, redirect website admins to admin dashboard, others to join/create flow
  if (!profile?.org_id) {
    if (profile?.is_staff) {
      redirect("/dashboard/admin");
    }
    redirect("/join");
  }

  const org = profile.organizations;
  const isSupporter = org?.plan_tier === "supporter";
  const teamAiPromptLimits = await getTeamAiPromptLimits(supabase);
  const aiWindowHours = Math.round(TEAM_AI_WINDOW_MS / (60 * 60 * 1000));
  const currentPlanAiLimit = teamAiPromptLimits[isSupporter ? "supporter" : "free"];
  const aiUsage = await peekRateLimit(
    `ai-interactions:${profile.org_id}`,
    TEAM_AI_WINDOW_MS,
    currentPlanAiLimit
  );

  const formatDate = (value?: string | null) => {
    if (!value) return "TBA";
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return value;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const { data: orgEvents } = await supabase
    .from("org_events")
    .select(
      "id, is_attending, created_at, events(id, tba_key, name, location, start_date, end_date, year)"
    )
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  const compLabel = (
    compLevel: string,
    matchNumber: number,
    setNumber?: number | null
  ) => {
    const hasLegacy = compLevel !== "qm" && !setNumber && matchNumber >= 100;
    const normalizedSet = hasLegacy
      ? Math.floor(matchNumber / 100)
      : setNumber ?? null;
    const normalizedMatch = hasLegacy ? matchNumber % 100 : matchNumber;

    if (compLevel === "qm") return `Qual ${normalizedMatch}`;

    const prefix =
      compLevel === "sf"
        ? "SF"
        : compLevel === "f"
        ? "F"
        : compLevel.toUpperCase();

    return normalizedSet
      ? `${prefix} ${normalizedSet}-${normalizedMatch}`
      : `${prefix} ${normalizedMatch}`;
  };

  const { count: memberCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("org_id", profile.org_id);

  const { count: scoutingCount } = await supabase
    .from("scouting_entries")
    .select("*", { count: "exact", head: true })
    .eq("org_id", profile.org_id);

  const eventsCount = orgEvents?.length ?? 0;

  const sinceDate = new Date();
  sinceDate.setHours(sinceDate.getHours() - 24);
  const since = sinceDate.toISOString();
  const { count: pulseCount } = await supabase
    .from("team_messages")
    .select("*", { count: "exact", head: true })
    .eq("org_id", profile.org_id)
    .gte("created_at", since);

  const { data: lastPulse } = await supabase
    .from("team_messages")
    .select("created_at")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: reportPreview } = await supabase
    .from("scouting_entries")
    .select(
      "id, created_at, team_number, match_id, auto_score, teleop_score, endgame_score, notes, profiles(display_name), matches (comp_level, match_number, set_number, events (name, year, tba_key))"
    )
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="min-h-screen dashboard-page">
      <Navbar />

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-24">
        {/* ─── Hero + Stats ─── */}
        <StaggerGroup className="mb-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <StaggerChild className="relative overflow-hidden rounded-3xl dashboard-panel dashboard-card p-6">
            {/* Subtle gradient accent */}
            <div className="pointer-events-none absolute top-0 right-0 h-32 w-32 rounded-full bg-teal-500/10 blur-3xl" />
            <div className="relative">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                Team Overview
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <h2 className="text-2xl font-bold text-white">
                  {org?.team_number ? `Team ${org.team_number}` : org?.name}
                </h2>
                {isSupporter && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
                    Supporter
                  </span>
                )}
              </div>
              {org?.team_number && org?.name && (
                <p className="mt-1 text-sm text-gray-300">{org.name}</p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 px-3 py-1.5 text-xs font-semibold capitalize text-teal-400 dark:text-teal-300 ring-1 ring-teal-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
                  {profile.role}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-violet-500/15 px-3 py-1.5 text-xs font-semibold text-violet-600 dark:text-violet-300 ring-1 ring-violet-500/20">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span className="font-mono">{org?.join_code}</span>
                </span>
                {org?.join_code && <CopyInviteLink joinCode={org.join_code} />}
              </div>
              {isSupporter && (
                <p className="mt-3 text-xs font-medium text-green-400">
                  Thank you for supporting us.
                </p>
              )}
              <p className="mt-4 text-sm leading-relaxed text-gray-300">
                Welcome back, <span className="font-medium text-white">{profile.display_name}</span>. Sync events and keep scouting data flowing for the next match.
              </p>
              <UsageLimitMeter
                limit={currentPlanAiLimit}
                remaining={aiUsage.remaining}
                resetAt={aiUsage.resetAt}
                windowHours={aiWindowHours}
              />
            </div>
          </StaggerChild>

          <StaggerChild>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {[
                {
                  label: "Events Synced",
                  value: eventsCount,
                  sub: "Across all seasons",
                },
                {
                  label: "Team Members",
                  value: memberCount ?? 0,
                  sub: "Scouts and captains",
                },
                {
                  label: "Scouting Entries",
                  value: scoutingCount ?? 0,
                  sub: "Total logged this season",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl dashboard-panel dashboard-card p-4"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                      {stat.label}
                    </p>
                    <p className="mt-0.5 text-2xl font-bold text-white">
                      {stat.value}
                    </p>
                    <p className="text-xs text-gray-400">{stat.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </StaggerChild>
        </StaggerGroup>

        {/* ─── Quick Actions ─── */}
        <AnimateIn delay={0.2} className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl dashboard-panel dashboard-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Quick Sync</h3>
                <p className="text-sm text-gray-400">
                  Import teams, matches &amp; EPA from TBA.
                </p>
              </div>
            </div>
            <div className="mt-4">
              {profile.role === "captain" ? (
                <SyncEventForm />
              ) : (
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-400">
                  Only captains can sync events.
                </div>
              )}
            </div>
          </div>
          <div className="rounded-2xl dashboard-panel dashboard-card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-gray-300">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">
                  Team Settings
                </h3>
                <p className="text-sm text-gray-400">
                  Manage roles, codes &amp; org details.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/dashboard/settings"
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5 hover:border-white/20"
              >
                Open settings
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
              {profile.role === "captain" && !isSupporter && (
                <UpgradeSupporterButton />
              )}
              <LeaveTeamButton />
            </div>
          </div>
        </AnimateIn>

        {/* ─── Scouting Reports ─── */}
        <AnimateIn delay={0.3} className="mb-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Scouting Reports
                </h3>
                <p className="text-sm text-gray-400">
                  The latest entries across your team.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/reports"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5 hover:border-white/20"
            >
              View all
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          </div>

          {reportPreview && reportPreview.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pt-1 pb-2 -mx-1 px-1">
              {reportPreview.map((report) => {
                const match = Array.isArray(report.matches)
                  ? report.matches[0]
                  : report.matches;
                const event = match
                  ? Array.isArray(match.events)
                    ? match.events[0]
                    : match.events
                  : null;
                const eventTitle = event?.year
                  ? `${event.year} ${event.name}`
                  : event?.name ?? "Event";
                const reportProfile = Array.isArray(report.profiles)
                  ? report.profiles[0]
                  : report.profiles;
                const scouterName = reportProfile?.display_name ?? "Teammate";
                const matchLabel =
                  match?.comp_level && match?.match_number
                    ? compLabel(
                        match.comp_level,
                        match.match_number,
                        match.set_number
                      )
                    : "Match";

                return (
                  <div
                    key={report.id}
                    className="report-preview-card min-w-[260px] max-w-[280px] flex-1 rounded-2xl dashboard-panel dashboard-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold uppercase tracking-widest text-blue-400">
                          {eventTitle}
                        </p>
                        <h4 className="text-base font-semibold text-white">
                          Team {report.team_number}
                        </h4>
                        <p className="text-xs text-gray-400">
                          {matchLabel} &middot; {formatDate(report.created_at)}
                        </p>
                      </div>
                    </div>

                    <p className="mt-2 text-xs text-gray-400">
                      Scouted by {scouterName}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/scout/${report.match_id}/${report.team_number}`}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-teal-300 dashboard-chip dashboard-chip-action"
                      >
                        Review
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                      </Link>
                      {event?.tba_key && (
                        <Link
                          href={`/dashboard/events/${event.tba_key}`}
                          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-gray-300 dashboard-chip dashboard-chip-action"
                        >
                          Event
                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 dashboard-panel p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <p className="text-sm font-medium text-gray-300">No scouting reports yet</p>
              <p className="mt-1 text-xs text-gray-400">
                Head to an event and scout a match to build your history.
              </p>
            </div>
          )}
        </AnimateIn>

        {/* ─── Events List ─── */}
        <AnimateIn delay={0.4} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </div>
            <h3 className="text-lg font-semibold text-white">Your Events</h3>
          </div>

          {!orgEvents || orgEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 dashboard-panel p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </div>
              <p className="text-sm font-medium text-gray-300">
                No events synced yet
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Use Quick Sync above to import your first event.
              </p>
            </div>
          ) : (
            <SortableEvents
              orgEvents={orgEvents.map((oe) => ({
                id: oe.id,
                is_attending: oe.is_attending,
                events: oe.events ? {
                  id: oe.events.id,
                  tba_key: oe.events.tba_key,
                  name: oe.events.name,
                  location: oe.events.location,
                  start_date: oe.events.start_date,
                  end_date: oe.events.end_date,
                  year: oe.events.year,
                } : null,
              }))}
              isCaptain={profile.role === "captain"}
            />
          )}
        </AnimateIn>

        {/* ─── Team Pulse ─── */}
        <AnimateIn delay={0.5} className="mt-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {(pulseCount ?? 0) > 0 && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-green-400" />
                </span>
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Team Pulse</h3>
              <p className="text-sm text-gray-400">
                Strategy chatter &amp; team updates.
              </p>
            </div>
          </div>
          <div className="rounded-2xl dashboard-panel dashboard-card p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm text-gray-300">
                <span className="font-semibold text-white">{(pulseCount ?? 0).toLocaleString()}</span> new updates in the last 24 hours
              </p>
              {lastPulse?.created_at ? (
                <p className="mt-1 text-xs text-gray-400">
                  Last update{" "}
                  {new Date(lastPulse.created_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  No updates yet. Start the conversation in Team Pulse.
                </p>
              )}
            </div>
            <Link
              href="/dashboard/pulse"
              className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-2 text-sm font-medium text-green-300 transition hover:bg-green-500/15 hover:border-green-500/30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Open channel
            </Link>
          </div>
        </AnimateIn>

      </main>
    </div>
  );
}

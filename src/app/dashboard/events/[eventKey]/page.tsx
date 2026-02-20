import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TeamStatsTable } from "./team-stats-table";
import { Navbar } from "@/components/navbar";
import { SyncStatsButton } from "./sync-stats-button";
import { EventTour } from "./event-tour";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventKey: string }>;
}): Promise<Metadata> {
  const { eventKey } = await params;
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("name, year")
    .eq("tba_key", eventKey)
    .single();
  const title = event
    ? `${event.year ? `${event.year} ` : ""}${event.name} | PitPilot`
    : "Event | PitPilot";
  return { title };
}

function formatSyncTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventKey: string }>;
}) {
  const { eventKey } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, org_id, organizations(team_number)")
    .eq("id", user.id)
    .single();

  const orgTeamNumber = (profile?.organizations as { team_number: number | null } | null)?.team_number ?? null;

  // Get event
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("tba_key", eventKey)
    .single();

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center dashboard-page">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Event not found</h1>
          <p className="text-gray-400">
            Sync event <span className="font-mono">{eventKey}</span> first from the dashboard.
          </p>
          <Link
            href="/dashboard"
            className="back-button"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { data: eventTeams } = await supabase
    .from("event_teams")
    .select("team_number")
    .eq("event_id", event.id);

  const eventTeamNumbers = (eventTeams ?? []).map((team) => team.team_number);
  const isOrgInEvent = orgTeamNumber !== null && eventTeamNumbers.includes(orgTeamNumber);

  const { data: matches } = await supabase
    .from("matches")
    .select("red_teams, blue_teams, red_score, blue_score")
    .eq("event_id", event.id);

  const matchCount = matches?.length ?? 0;

  const { data: lastSync } = await supabase
    .from("team_event_stats")
    .select("last_synced_at")
    .eq("event_id", event.id)
    .order("last_synced_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  const lastSyncLabel = formatSyncTime(lastSync?.last_synced_at ?? null);

  const winRecord = new Map<
    number,
    { wins: number; losses: number; ties: number }
  >();

  const ensureRecord = (team: number) => {
    if (!winRecord.has(team)) {
      winRecord.set(team, { wins: 0, losses: 0, ties: 0 });
    }
    return winRecord.get(team)!;
  };

  for (const match of matches ?? []) {
    if (match.red_score === null || match.blue_score === null) continue;

    const isTie = match.red_score === match.blue_score;
    if (isTie) {
      match.red_teams.forEach((team) => ensureRecord(team).ties++);
      match.blue_teams.forEach((team) => ensureRecord(team).ties++);
      continue;
    }

    const redWon = (match.red_score ?? 0) > (match.blue_score ?? 0);
    match.red_teams.forEach((team) => {
      const record = ensureRecord(team);
      if (redWon) {
        record.wins++;
      } else {
        record.losses++;
      }
    });
    match.blue_teams.forEach((team) => {
      const record = ensureRecord(team);
      if (redWon) {
        record.losses++;
      } else {
        record.wins++;
      }
    });
  }

  const winRateMap = new Map<number, number | null>();
  for (const [team, record] of winRecord.entries()) {
    const total = record.wins + record.losses + record.ties;
    winRateMap.set(team, total > 0 ? record.wins / total : null);
  }

  // Get team stats for this event
  const { data: stats } = await supabase
    .from("team_event_stats")
    .select("*")
    .eq("event_id", event.id)
    .order("epa", { ascending: false, nullsFirst: false });

  const statMap = new Map((stats ?? []).map((stat) => [stat.team_number, stat]));
  const baseTeamNumbers =
    eventTeamNumbers.length > 0
      ? eventTeamNumbers
      : Array.from(statMap.keys());
  const teamCount = baseTeamNumbers.length;
  const { data: teams } = await supabase
    .from("teams")
    .select("team_number, name, city, state")
    .in("team_number", baseTeamNumbers.length > 0 ? baseTeamNumbers : [0]);

  const teamsMap = new Map(teams?.map((t) => [t.team_number, t]) ?? []);

  // Merge stats with team info
  const tableData = baseTeamNumbers.map((teamNumber) => {
    const stat = statMap.get(teamNumber);
    const team = teamsMap.get(teamNumber);
    return {
      team_number: teamNumber,
      name: team?.name ?? "Unknown",
      city: team?.city ?? "",
      state: team?.state ?? "",
      epa: stat?.epa ?? null,
      auto_epa: stat?.auto_epa ?? null,
      teleop_epa: stat?.teleop_epa ?? null,
      endgame_epa: stat?.endgame_epa ?? null,
      win_rate: winRateMap.get(teamNumber) ?? null,
    };
  });

  const eventTitle = event.year ? `${event.year} ${event.name}` : event.name;

  return (
    <div className="min-h-screen dashboard-page">
      <Navbar />
      <EventTour />
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-32">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div data-tour="event-header">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              Event overview
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-bold leading-tight">{eventTitle}</h1>
              {orgTeamNumber !== null && !isOrgInEvent && (
                <span className="inline-flex rounded-full bg-teal-500/20 px-3 py-1 text-xs font-medium text-teal-600 dark:text-teal-300">
                  Not Attending
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-400">
              {event.location} &middot; {event.year} &middot;{" "}
              {teamCount} teams &middot; {matchCount ?? 0} matches
            </p>
            <p className="mt-1 text-xs text-gray-400">
              {lastSyncLabel
                ? `Last stats sync ${lastSyncLabel}`
                : "Stats not synced yet"}
            </p>
            {profile?.role === "captain" && (
              <div className="mt-3">
                <SyncStatsButton eventKey={eventKey} compact />
              </div>
            )}
          </div>
          <div data-tour="event-actions" className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/events/${eventKey}/matches`}
              className="dashboard-action dashboard-action-primary dashboard-action-holo"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              Scout Matches
            </Link>
            {profile?.role === "captain" && (
              <Link
                href={`/dashboard/events/${eventKey}/assignments`}
                className="dashboard-action dashboard-action-ghost"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                Assignments
              </Link>
            )}
            <Link
              href={`/dashboard/events/${eventKey}/analytics`}
              className="dashboard-action dashboard-action-ghost"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Analytics
            </Link>
            {isOrgInEvent && (
              <Link
                href={`/dashboard/events/${eventKey}/draft`}
                className="dashboard-action dashboard-action-ghost"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                Draft Room
              </Link>
            )}
            <Link
              href="/dashboard"
              className="back-button"
            >
              Back
            </Link>
          </div>
        </div>

        <div data-tour="event-team-stats">
          {tableData.length === 0 ? (
            <div className="rounded-3xl border border-teal-500/30 bg-teal-500/10 p-8 text-center">
              <p className="text-teal-700 dark:text-yellow-300">
                Team stats update once matches start or as the event gets closer.
                You can sync again later to pull the latest EPA.
              </p>
            </div>
          ) : (
            <TeamStatsTable
              data={tableData}
              eventKey={eventKey}
              highlightTeam={orgTeamNumber}
            />
          )}
        </div>
      </main>
    </div>
  );
}

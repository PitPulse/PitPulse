import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TeamStatsTable } from "./team-stats-table";
import { Navbar } from "@/components/navbar";
import { SyncStatsButton } from "./sync-stats-button";

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
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-24">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              Event overview
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="text-2xl font-bold leading-tight">{eventTitle}</h1>
              {orgTeamNumber !== null && !isOrgInEvent && (
                <span className="inline-flex rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-300">
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
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/events/${eventKey}/matches`}
              className="dashboard-action dashboard-action-primary"
            >
              Scout Matches
            </Link>
            {profile?.role === "captain" && (
              <Link
                href={`/dashboard/events/${eventKey}/assignments`}
                className="dashboard-action dashboard-action-warm"
              >
                Assignments
              </Link>
            )}
            {isOrgInEvent && (
              <Link
                href={`/dashboard/events/${eventKey}/draft`}
                className="dashboard-action dashboard-action-alt"
              >
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

        {tableData.length === 0 ? (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
            <p className="text-amber-700 dark:text-yellow-300">
              Team stats update once matches start or as the event gets closer.
              You can sync again later to pull the latest EPA.
            </p>
            {profile?.role === "captain" && (
              <SyncStatsButton eventKey={eventKey} />
            )}
          </div>
        ) : (
          <TeamStatsTable
            data={tableData}
            eventKey={eventKey}
            canSync={profile?.role === "captain"}
            highlightTeam={orgTeamNumber}
          />
        )}
      </main>
    </div>
  );
}

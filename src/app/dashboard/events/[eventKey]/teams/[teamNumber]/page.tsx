import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { TeamAIBriefButton } from "./team-ai-brief-button";
import { TeamDetailCharts } from "./team-detail-charts";
import { ExportCsvButton } from "@/components/export-csv-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventKey: string; teamNumber: string }>;
}): Promise<Metadata> {
  const { eventKey, teamNumber } = await params;
  const supabase = await createClient();
  const [{ data: event }, { data: team }] = await Promise.all([
    supabase.from("events").select("name, year").eq("tba_key", eventKey).single(),
    supabase.from("teams").select("name").eq("team_number", parseInt(teamNumber, 10)).single(),
  ]);
  const eventLabel = event ? `${event.year ? `${event.year} ` : ""}${event.name}` : "";
  const teamLabel = team?.name ? `Team ${teamNumber} ${team.name}` : `Team ${teamNumber}`;
  return {
    title: eventLabel
      ? `${teamLabel} — ${eventLabel} | PitPilot`
      : `${teamLabel} | PitPilot`,
  };
}

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ eventKey: string; teamNumber: string }>;
}) {
  const { eventKey, teamNumber: teamNumberStr } = await params;
  const teamNumber = parseInt(teamNumberStr, 10);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) redirect("/join");

  // Get event
  const { data: event } = await supabase
    .from("events")
    .select("id, name, year")
    .eq("tba_key", eventKey)
    .single();

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center dashboard-page">
        <p className="text-gray-400">Event not found.</p>
      </div>
    );
  }

  // Get team info
  const { data: team } = await supabase
    .from("teams")
    .select("team_number, name, city, state")
    .eq("team_number", teamNumber)
    .single();

  // Get EPA stats
  const { data: stats } = await supabase
    .from("team_event_stats")
    .select("*")
    .eq("event_id", event.id)
    .eq("team_number", teamNumber)
    .single();

  // Get all matches this team is in
  const { data: allMatches } = await supabase
    .from("matches")
    .select("*")
    .eq("event_id", event.id)
    .order("comp_level")
    .order("set_number", { ascending: true, nullsFirst: true })
    .order("match_number");

  const teamMatches = (allMatches ?? []).filter(
    (m) => m.red_teams.includes(teamNumber) || m.blue_teams.includes(teamNumber)
  );

  // Fallback win-rate calculation from completed match results
  const record = teamMatches.reduce(
    (acc, match) => {
      if (match.red_score === null || match.blue_score === null) return acc;
      const onRed = match.red_teams.includes(teamNumber);
      const redScore = match.red_score ?? 0;
      const blueScore = match.blue_score ?? 0;

      if (redScore === blueScore) {
        acc.ties += 1;
      } else {
        const won = (onRed && redScore > blueScore) || (!onRed && blueScore > redScore);
        if (won) acc.wins += 1;
        else acc.losses += 1;
      }
      return acc;
    },
    { wins: 0, losses: 0, ties: 0 }
  );
  const totalPlayed = record.wins + record.losses + record.ties;
  const calculatedWinRate = totalPlayed > 0 ? record.wins / totalPlayed : null;
  const displayWinRate = stats?.win_rate ?? calculatedWinRate;

  const matchIds = teamMatches.map((m) => m.id);

  // Get scouting entries for this team (org-scoped via RLS)
  const scoutingEntries =
    matchIds.length > 0
      ? (
          await supabase
            .from("scouting_entries")
            .select("*, profiles(display_name)")
            .eq("team_number", teamNumber)
            .eq("org_id", profile.org_id)
            .in("match_id", matchIds)
            .order("created_at", { ascending: false })
        ).data ?? []
      : [];

  // Build match lookup for display
  const matchMap = new Map(teamMatches.map((m) => [m.id, m]));

  // Compute aggregated scouting stats
  const entries = scoutingEntries ?? [];
  const entryCount = entries.length;

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const aggregated = entryCount > 0
    ? {
        avgAuto: avg(entries.map((e) => e.auto_score)),
        avgTeleop: avg(entries.map((e) => e.teleop_score)),
        avgEndgame: avg(entries.map((e) => e.endgame_score)),
        avgDefense: avg(entries.map((e) => e.defense_rating)),
        avgReliability: avg(entries.map((e) => e.reliability_rating)),
        avgTotal: avg(
          entries.map((e) => e.auto_score + e.teleop_score + e.endgame_score)
        ),
        maxTotal: Math.max(
          ...entries.map((e) => e.auto_score + e.teleop_score + e.endgame_score)
        ),
        minTotal: Math.min(
          ...entries.map((e) => e.auto_score + e.teleop_score + e.endgame_score)
        ),
      }
    : null;

  function compLabel(
    compLevel: string,
    matchNumber: number,
    setNumber?: number | null
  ) {
    const hasLegacy =
      compLevel !== "qm" && !setNumber && matchNumber >= 100;
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
  }

  function formatNum(val: number | null, decimals = 1): string {
    if (val === null) return "—";
    return val.toFixed(decimals);
  }

  function starDisplay(rating: number) {
    return "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
  }

  const eventTitle = event.year ? `${event.year} ${event.name}` : event.name;

  return (
    <div className="min-h-screen dashboard-page">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pb-12 pt-28 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {eventTitle}
            </p>
            <h1 className="text-lg font-bold">
              Team {teamNumber}
              {team?.name && (
                <span className="ml-2 font-normal text-gray-400">
                  {team.name}
                </span>
              )}
            </h1>
            {team?.city && (
              <p className="text-xs text-gray-400">
                {team.city}
                {team.state ? `, ${team.state}` : ""}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <TeamAIBriefButton
              eventKey={eventKey}
              teamNumber={teamNumber}
              teamName={team?.name ?? null}
            />
            <Link
              href={`/dashboard/events/${eventKey}`}
              className="back-button"
            >
              Back
            </Link>
          </div>
        </div>
        {/* EPA Stats Card */}
        <div className="rounded-2xl dashboard-panel p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            EPA Statistics
          </h2>
          {stats ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <div className="rounded-2xl bg-white/5 p-3 text-center">
                  <p className="text-xs text-gray-400">Total EPA</p>
                  <p className="text-2xl font-bold text-white">
                    {formatNum(stats.epa)}
                  </p>
                </div>
              <div className="rounded-2xl bg-white/5 p-3 text-center">
                <p className="text-xs text-gray-400">Auto</p>
                <p className="text-xl font-semibold text-white">
                  {formatNum(stats.auto_epa)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3 text-center">
                <p className="text-xs text-gray-400">Teleop</p>
                <p className="text-xl font-semibold text-white">
                  {formatNum(stats.teleop_epa)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3 text-center">
                <p className="text-xs text-gray-400">Endgame</p>
                <p className="text-xl font-semibold text-white">
                  {formatNum(stats.endgame_epa)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/5 p-3 text-center">
                <p className="text-xs text-gray-400">Win Rate</p>
                <p className="text-xl font-semibold text-white">
                  {displayWinRate !== null
                    ? `${(displayWinRate * 100).toFixed(0)}%`
                    : "—"}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              No EPA stats available. Sync stats from the dashboard.
            </p>
          )}
        </div>

        {/* Aggregated Scouting Summary */}
        <div className="rounded-2xl dashboard-panel p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Scouting Summary
            {entryCount > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({entryCount} {entryCount === 1 ? "entry" : "entries"})
              </span>
            )}
          </h2>
          {aggregated ? (
            <div className="space-y-4">
              {/* Score averages */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl bg-blue-500/10 p-3 text-center">
                  <p className="text-xs text-blue-200">Avg Auto</p>
                  <p className="text-xl font-bold text-blue-100">
                    {aggregated.avgAuto.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-2xl bg-blue-500/10 p-3 text-center">
                  <p className="text-xs text-blue-200">Avg Teleop</p>
                  <p className="text-xl font-bold text-blue-100">
                    {aggregated.avgTeleop.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-2xl bg-blue-500/10 p-3 text-center">
                  <p className="text-xs text-blue-200">Avg Endgame</p>
                  <p className="text-xl font-bold text-blue-100">
                    {aggregated.avgEndgame.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-2xl bg-blue-500/10 p-3 text-center">
                  <p className="text-xs text-blue-200">Avg Total</p>
                  <p className="text-xl font-bold text-blue-100">
                    {aggregated.avgTotal.toFixed(1)}
                  </p>
                  <p className="text-xs text-blue-300">
                    {aggregated.minTotal}–{aggregated.maxTotal}
                  </p>
                </div>
              </div>

              {/* Ratings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-gray-400 mb-1">Avg Defense Rating</p>
                  <p className="text-lg font-semibold text-white">
                    {aggregated.avgDefense.toFixed(1)}/5
                  </p>
                  <p className="text-sm text-yellow-500">
                    {starDisplay(aggregated.avgDefense)}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs text-gray-400 mb-1">
                    Avg Reliability Rating
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {aggregated.avgReliability.toFixed(1)}/5
                  </p>
                  <p className="text-sm text-yellow-500">
                    {starDisplay(aggregated.avgReliability)}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">
              No scouting data yet. Scout this team from the matches page.
            </p>
          )}
        </div>

        {/* Charts */}
        <TeamDetailCharts
          teamNumber={teamNumber}
          scoutingEntries={entries.map((entry) => {
            const match = matchMap.get(entry.match_id);
            return {
              matchLabel: match
                ? compLabel(match.comp_level, match.match_number, match.set_number)
                : "?",
              autoScore: entry.auto_score,
              teleopScore: entry.teleop_score,
              endgameScore: entry.endgame_score,
              defenseRating: entry.defense_rating,
              reliabilityRating: entry.reliability_rating,
            };
          })}
          epa={stats ? {
            auto: stats.auto_epa,
            teleop: stats.teleop_epa,
            endgame: stats.endgame_epa,
            total: stats.epa,
          } : null}
          avgDefense={aggregated?.avgDefense ?? null}
          avgReliability={aggregated?.avgReliability ?? null}
        />

        {/* Match History */}
        <div className="rounded-2xl dashboard-panel p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Match History ({teamMatches.length} matches)
          </h2>
          {teamMatches.length > 0 ? (
            <div className="space-y-2">
              {teamMatches.map((m) => {
                const onRed = m.red_teams.includes(teamNumber);
                const hasScore = m.red_score !== null;
                const won = hasScore && (
                  (onRed && (m.red_score ?? 0) > (m.blue_score ?? 0)) ||
                  (!onRed && (m.blue_score ?? 0) > (m.red_score ?? 0))
                );
                const tied = hasScore && m.red_score === m.blue_score;

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-2xl border border-white/10 bg-gray-950/60 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-white w-20">
                        {compLabel(
                          m.comp_level,
                          m.match_number,
                          m.set_number
                        )}
                      </span>
                      <span
                        className={`match-badge rounded px-1.5 py-0.5 text-xs font-medium ${
                          onRed
                            ? "bg-red-500/20 text-red-200"
                            : "bg-blue-500/20 text-blue-200"
                        }`}
                      >
                        {onRed ? "Red" : "Blue"}
                      </span>
                      {hasScore && (
                        <span
                          className={`match-badge rounded px-1.5 py-0.5 text-xs font-medium ${
                            tied
                              ? "bg-white/10 text-gray-200"
                              : won
                              ? "bg-green-500/20 text-green-200"
                              : "bg-red-500/20 text-red-200"
                          }`}
                        >
                          {tied ? "Tie" : won ? "Won" : "Lost"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {hasScore && (
                        <span className="text-sm text-gray-300">
                          <span className={onRed ? "font-semibold" : ""}>
                            {m.red_score}
                          </span>
                          {" - "}
                          <span className={!onRed ? "font-semibold" : ""}>
                            {m.blue_score}
                          </span>
                        </span>
                      )}
                      <Link
                        href={`/scout/${m.id}/${teamNumber}`}
                        className="rounded border border-white/10 px-2 py-1 text-xs text-gray-200 hover:bg-white/5"
                      >
                        Scout
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No matches found.</p>
          )}
        </div>

        {/* Individual Scouting Entries */}
        {entries.length > 0 && (
          <div className="rounded-2xl dashboard-panel p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Scouting Entries
              </h2>
              <ExportCsvButton
                filename={`team-${teamNumber}-scouting.csv`}
                headers={["Match", "Team", "Scout", "Auto", "Teleop", "Endgame", "Total", "Defense", "Reliability", "Notes"]}
                rows={entries.map((entry) => {
                  const match = matchMap.get(entry.match_id);
                  return [
                    match ? compLabel(match.comp_level, match.match_number, match.set_number) : "Unknown",
                    entry.team_number,
                    entry.profiles?.display_name ?? "Unknown",
                    entry.auto_score,
                    entry.teleop_score,
                    entry.endgame_score,
                    entry.auto_score + entry.teleop_score + entry.endgame_score,
                    entry.defense_rating,
                    entry.reliability_rating,
                    entry.notes || "",
                  ];
                })}
              />
            </div>
            <div className="space-y-3">
              {entries.map((entry) => {
                const match = matchMap.get(entry.match_id);
                const total =
                  entry.auto_score + entry.teleop_score + entry.endgame_score;
                return (
                  <div
                    key={entry.id}
                    className="rounded-2xl border border-white/10 bg-gray-950/60 p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {match
                            ? compLabel(
                                match.comp_level,
                                match.match_number,
                                match.set_number
                              )
                            : "Unknown Match"}
                        </span>
                        <span className="text-xs text-gray-400">
                          by {entry.profiles?.display_name ?? "Unknown"}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-white">
                        {total} pts
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-2 mb-2">
                      <div className="text-center">
                        <p className="text-xs text-gray-400">Auto</p>
                        <p className="text-sm font-semibold text-white">{entry.auto_score}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400">Teleop</p>
                        <p className="text-sm font-semibold text-white">
                          {entry.teleop_score}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400">Endgame</p>
                        <p className="text-sm font-semibold text-white">
                          {entry.endgame_score}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400">Defense</p>
                        <p className="text-sm text-yellow-500">
                          {starDisplay(entry.defense_rating)}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400">Reliable</p>
                        <p className="text-sm text-yellow-500">
                          {starDisplay(entry.reliability_rating)}
                        </p>
                      </div>
                    </div>

                    {entry.notes && (
                      <p className="text-sm text-gray-200 bg-white/5 rounded p-2">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BriefContentSchema, type BriefContent } from "@/types/strategy";
import { GenerateBriefButton } from "./generate-button";
import { BriefAllianceChart } from "./brief-alliance-chart";
import { Navbar } from "@/components/navbar";

export default async function BriefPage({
  params,
}: {
  params: Promise<{ eventKey: string; matchId: string }>;
}) {
  const { eventKey, matchId } = await params;
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

  const { data: org } = await supabase
    .from("organizations")
    .select("team_number")
    .eq("id", profile.org_id)
    .single();

  // Get match
  const { data: match } = await supabase
    .from("matches")
    .select("*, events(name, year)")
    .eq("id", matchId)
    .single();

  if (!match) {
    return (
      <div className="flex min-h-screen items-center justify-center dashboard-page">
        <p className="text-gray-400">Match not found.</p>
      </div>
    );
  }

  // Get scouting averages + EPA for alliance comparison chart
  const allTeamNumbers = [...match.red_teams, ...match.blue_teams];
  const { data: scoutingEntries } = await supabase
    .from("scouting_entries")
    .select("team_number, auto_score, teleop_score, endgame_score")
    .eq("match_id", matchId)
    .in("team_number", allTeamNumbers.length > 0 ? allTeamNumbers : [0]);

  const { data: eventForStats } = await supabase
    .from("events")
    .select("id")
    .eq("tba_key", eventKey)
    .single();

  const { data: epaStats } = eventForStats
    ? await supabase
        .from("team_event_stats")
        .select("team_number, auto_epa, teleop_epa, endgame_epa")
        .eq("event_id", eventForStats.id)
        .in("team_number", allTeamNumbers.length > 0 ? allTeamNumbers : [0])
    : { data: null };

  const scoutAvgMap = new Map<number, { auto: number; teleop: number; endgame: number }>();
  for (const entry of scoutingEntries ?? []) {
    const existing = scoutAvgMap.get(entry.team_number);
    if (!existing) {
      scoutAvgMap.set(entry.team_number, {
        auto: entry.auto_score,
        teleop: entry.teleop_score,
        endgame: entry.endgame_score,
      });
    } else {
      existing.auto += entry.auto_score;
      existing.teleop += entry.teleop_score;
      existing.endgame += entry.endgame_score;
    }
  }
  const scoutCountMap = new Map<number, number>();
  for (const entry of scoutingEntries ?? []) {
    scoutCountMap.set(entry.team_number, (scoutCountMap.get(entry.team_number) ?? 0) + 1);
  }
  for (const [team, avg] of scoutAvgMap.entries()) {
    const count = scoutCountMap.get(team) ?? 1;
    avg.auto /= count;
    avg.teleop /= count;
    avg.endgame /= count;
  }

  const epaMap = new Map(
    (epaStats ?? []).map((s) => [
      s.team_number,
      { auto: s.auto_epa, teleop: s.teleop_epa, endgame: s.endgame_epa },
    ])
  );

  const allianceChartTeams = allTeamNumbers.map((tn) => ({
    teamNumber: tn,
    alliance: (match.red_teams.includes(tn) ? "red" : "blue") as "red" | "blue",
    scoutAvg: scoutAvgMap.get(tn) ?? null,
    epa: epaMap.get(tn) ?? null,
  }));

  // Get brief
  const { data: brief } = await supabase
    .from("strategy_briefs")
    .select("*")
    .eq("match_id", matchId)
    .eq("org_id", profile.org_id)
    .single();

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

  const matchLabel = compLabel(
    match.comp_level,
    match.match_number,
    match.set_number
  );
  const parsedContent = brief?.content
    ? BriefContentSchema.safeParse(brief.content)
    : null;
  const content = parsedContent?.success
    ? parsedContent.data
    : (brief?.content as BriefContent | null);
  const scoutingPriorities = content?.scoutingPriorities ?? {
    teamsNeedingCoverage: [],
    scoutActions: [],
  };
  const matchCompleted = match.red_score !== null || match.blue_score !== null;
  const orgTeamNumber = org?.team_number ?? null;
  const isOurMatch = orgTeamNumber
    ? match.red_teams.includes(orgTeamNumber) ||
      match.blue_teams.includes(orgTeamNumber)
    : true;

  const eventTitle =
    match.events?.year && match.events?.name
      ? `${match.events.year} ${match.events.name}`
      : match.events?.name;

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
              {matchLabel} — {matchCompleted ? "Match Brief (Reference)" : "Pre-Match Brief"}
            </h1>
          </div>
          <Link
            href={`/dashboard/events/${eventKey}/matches`}
            className="back-button"
          >
            Back
          </Link>
        </div>
        {matchCompleted && (
          <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            This match already has a score. Brief generation is in reference mode and does not use final score as input.
          </div>
        )}
        {!content ? (
          <div className="rounded-2xl dashboard-panel p-8 text-center">
            <p className="text-gray-400 mb-4">
              {!isOurMatch
                ? "Briefs are only available for matches your team is playing."
                : matchCompleted
                ? "No brief generated yet for this match. You can still generate a reference brief."
                : "No pre-match brief generated yet for this match."}
            </p>
            {isOurMatch && (
              <GenerateBriefButton
                matchId={matchId}
                label={matchCompleted ? "Generate Reference Brief" : "Generate Pre-Match Brief"}
              />
            )}
          </div>
        ) : (
          <>
            {/* Prediction Card */}
            <div className="rounded-2xl dashboard-panel p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Match Prediction
              </h2>
              <div className="flex items-center justify-between">
                <div className="text-center">
                  <p className="text-sm font-medium text-red-300">Red Alliance</p>
                  <p className="text-3xl font-bold text-red-200">
                    {content.prediction.redScore}
                  </p>
                  <p className="text-xs text-gray-400">
                    {match.red_teams.join(", ")}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-400">vs</p>
                  <span
                    className={`mt-1 inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                      content.prediction.winner === "red"
                        ? "bg-red-500/20 text-red-200"
                        : "bg-blue-500/20 text-blue-200"
                    }`}
                  >
                    {content.prediction.winner === "red" ? "Red" : "Blue"} favored
                  </span>
                  <p className="mt-1 text-xs text-gray-400">
                    {content.prediction.confidence} confidence
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-blue-300">Blue Alliance</p>
                  <p className="text-3xl font-bold text-blue-200">
                    {content.prediction.blueScore}
                  </p>
                  <p className="text-xs text-gray-400">
                    {match.blue_teams.join(", ")}
                  </p>
                </div>
              </div>
            </div>

            {/* Alliance Comparison Chart */}
            <BriefAllianceChart teams={allianceChartTeams} />

            {/* Alliance Analysis */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Red */}
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
                <h3 className="mb-3 font-semibold text-red-200">Red Alliance</h3>
                <p className="mb-3 text-sm text-gray-200">
                  Total EPA:{" "}
                  <span className="font-semibold">
                    {content.redAlliance.totalEPA.toFixed(1)}
                  </span>
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-green-300">Strengths</p>
                    <ul className="mt-1 space-y-1">
                      {content.redAlliance.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-gray-200">
                          • {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-red-300">Weaknesses</p>
                    <ul className="mt-1 space-y-1">
                      {content.redAlliance.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-gray-200">
                          • {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              {/* Blue */}
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-5">
                <h3 className="mb-3 font-semibold text-blue-200">Blue Alliance</h3>
                <p className="mb-3 text-sm text-gray-200">
                  Total EPA:{" "}
                  <span className="font-semibold">
                    {content.blueAlliance.totalEPA.toFixed(1)}
                  </span>
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-green-300">Strengths</p>
                    <ul className="mt-1 space-y-1">
                      {content.blueAlliance.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-gray-200">
                          • {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-red-300">Weaknesses</p>
                    <ul className="mt-1 space-y-1">
                      {content.blueAlliance.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-gray-200">
                          • {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Analysis */}
            <div className="rounded-2xl dashboard-panel p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Team Analysis
              </h2>
              <div className="space-y-4">
                {content.teamAnalysis.map((team) => (
                  <div
                    key={team.teamNumber}
                    className={`rounded-2xl border p-4 ${
                      team.alliance === "red"
                        ? "border-red-500/30 bg-red-500/10"
                        : "border-blue-500/30 bg-blue-500/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white">
                          Team {team.teamNumber}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            team.role === "scorer"
                              ? "bg-green-500/20 text-green-200"
                              : team.role === "defender"
                              ? "bg-cyan-500/20 text-cyan-200"
                              : "bg-white/10 text-gray-200"
                          }`}
                        >
                          {team.role}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-300">
                        EPA: {team.epaBreakdown.total.toFixed(1)}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="text-center rounded bg-white/10 p-1.5">
                        <p className="text-xs text-gray-400">Auto</p>
                        <p className="text-sm font-semibold text-white">
                          {team.epaBreakdown.auto.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-center rounded bg-white/10 p-1.5">
                        <p className="text-xs text-gray-400">Teleop</p>
                        <p className="text-sm font-semibold text-white">
                          {team.epaBreakdown.teleop.toFixed(1)}
                        </p>
                      </div>
                      <div className="text-center rounded bg-white/10 p-1.5">
                        <p className="text-xs text-gray-400">Endgame</p>
                        <p className="text-sm font-semibold text-white">
                          {team.epaBreakdown.endgame.toFixed(1)}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-gray-200">
                      {team.scoutingInsights}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategy Recommendations */}
            <div className="rounded-2xl dashboard-panel p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Scout Focus
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-amber-200">
                    Teams Needing Coverage
                  </h3>
                  {scoutingPriorities.teamsNeedingCoverage.length > 0 ? (
                    <ul className="space-y-1.5">
                      {scoutingPriorities.teamsNeedingCoverage.map((item, i) => (
                        <li key={`${item.teamNumber}-${i}`} className="text-sm text-gray-200">
                          • Team {item.teamNumber} ({item.alliance}, {item.priority}): {item.reason} Focus: {item.focus}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">
                      No urgent scouting gaps flagged for this match.
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-cyan-200">
                    Scout Actions
                  </h3>
                  {scoutingPriorities.scoutActions.length > 0 ? (
                    <ul className="space-y-1.5">
                      {scoutingPriorities.scoutActions.map((action, i) => (
                        <li key={i} className="text-sm text-gray-200">
                          • {action}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-400">
                      No additional scout action items provided.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Strategy Recommendations */}
            <div className="rounded-2xl dashboard-panel p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Strategy Recommendations
              </h2>
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-red-200">
                    For Red Alliance
                  </h3>
                  <ul className="space-y-1.5">
                    {content.strategy.redRecommendations.map((r, i) => (
                      <li key={i} className="text-sm text-gray-200">
                        • {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-blue-200">
                    For Blue Alliance
                  </h3>
                  <ul className="space-y-1.5">
                    {content.strategy.blueRecommendations.map((r, i) => (
                      <li key={i} className="text-sm text-gray-200">
                        • {r}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {content.strategy.keyMatchups.length > 0 && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-gray-200">
                    Key Matchups
                  </h3>
                  <ul className="space-y-1.5">
                    {content.strategy.keyMatchups.map((m, i) => (
                      <li key={i} className="text-sm text-gray-300">
                        ⚡ {m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Regenerate */}
            <div className="text-center">
              <GenerateBriefButton
                matchId={matchId}
                label={matchCompleted ? "Regenerate Reference Brief" : "Regenerate Pre-Match Brief"}
              />
              <p className="mt-2 text-xs text-gray-400">
                Generated {new Date(brief!.created_at).toLocaleString()}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

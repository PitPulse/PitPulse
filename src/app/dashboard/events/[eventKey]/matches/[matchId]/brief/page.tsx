import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { BriefContent } from "@/types/strategy";
import { GenerateBriefButton } from "./generate-button";
import { PostMatchAnalysis } from "./post-match-analysis";
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

  // Get match
  const { data: match } = await supabase
    .from("matches")
    .select("*, events(name)")
    .eq("id", matchId)
    .single();

  if (!match) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-gray-400">Match not found.</p>
      </div>
    );
  }

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
  const content = brief?.content as BriefContent | null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pb-12 pt-24 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {match.events?.name}
            </p>
            <h1 className="text-lg font-bold">
              {matchLabel} — AI Strategy Brief
            </h1>
          </div>
          <Link
            href={`/dashboard/events/${eventKey}/matches`}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/5"
          >
            Back
          </Link>
        </div>
        {!content ? (
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-8 text-center">
            <p className="text-gray-400 mb-4">
              No strategy brief generated yet for this match.
            </p>
            <GenerateBriefButton matchId={matchId} />
          </div>
        ) : (
          <>
            {/* Prediction Card */}
            <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
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

            {/* ML Model Prediction — shown when available */}
            {content.mlPrediction && (
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="rounded bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-200">
                    ML Model
                  </span>
                  <h3 className="text-sm font-medium text-gray-200">
                    XGBoost Prediction
                  </h3>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Red Score</p>
                    <p className="text-lg font-bold text-red-200">
                      {content.mlPrediction.redScore}
                    </p>
                  </div>
                  <div className="text-center">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        content.mlPrediction.winner === "red"
                          ? "bg-red-500/20 text-red-200"
                          : "bg-blue-500/20 text-blue-200"
                      }`}
                    >
                      {content.mlPrediction.winner === "red" ? "Red" : "Blue"}{" "}
                      {(content.mlPrediction.winProbability * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400">Blue Score</p>
                    <p className="text-lg font-bold text-blue-200">
                      {content.mlPrediction.blueScore}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Post-Match Analysis — shown when actual scores are available */}
            {match.red_score !== null && match.blue_score !== null && (
              <PostMatchAnalysis
                prediction={content.prediction}
                actualRedScore={match.red_score}
                actualBlueScore={match.blue_score}
                redTeams={match.red_teams}
                blueTeams={match.blue_teams}
              />
            )}

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
            <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
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
                              ? "bg-orange-500/20 text-orange-200"
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
            <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
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
                label="Regenerate Brief"
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

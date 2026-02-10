import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { PickListContent } from "@/types/strategy";
import { GeneratePickListButton } from "./generate-button";
import { Navbar } from "@/components/navbar";

export default async function PickListPage({
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
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) redirect("/join");

  // Get event
  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("tba_key", eventKey)
    .single();

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-gray-400">Event not found.</p>
      </div>
    );
  }

  // Get team names for display
  const { data: teams } = await supabase.from("teams").select("team_number, name");
  const teamNames: Record<number, string> = {};
  for (const t of teams ?? []) {
    teamNames[t.team_number] = t.name ?? `Team ${t.team_number}`;
  }

  // Get pick list
  const { data: pickList } = await supabase
    .from("pick_lists")
    .select("*")
    .eq("event_id", event.id)
    .eq("org_id", profile.org_id)
    .single();

  const content = pickList?.content as PickListContent | null;

  function synergyColor(synergy: string) {
    if (synergy === "high") return "bg-green-500/20 text-green-200";
    if (synergy === "medium") return "bg-yellow-500/20 text-yellow-200";
    return "bg-white/10 text-gray-200";
  }

  function roleColor(role: string) {
    if (role === "scorer") return "bg-blue-500/20 text-blue-200";
    if (role === "defender") return "bg-orange-500/20 text-orange-200";
    if (role === "versatile") return "bg-purple-500/20 text-purple-200";
    return "bg-white/10 text-gray-200";
  }

  function scoreColor(score: number) {
    if (score >= 80) return "text-green-200 bg-green-500/20";
    if (score >= 60) return "text-blue-200 bg-blue-500/20";
    if (score >= 40) return "text-yellow-200 bg-yellow-500/20";
    return "text-gray-200 bg-white/10";
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pb-12 pt-24 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {event.name}
            </p>
            <h1 className="text-lg font-bold">Alliance Pick List</h1>
          </div>
          <Link
            href={`/dashboard/events/${eventKey}`}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/5"
          >
            Back
          </Link>
        </div>
        {!content ? (
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-8 text-center">
            <h2 className="text-lg font-semibold text-white mb-2">
              No Pick List Yet
            </h2>
            <p className="text-gray-400 mb-4">
              Generate an AI-powered pick list based on EPA stats and your team&apos;s
              scouting data.
            </p>
            <GeneratePickListButton eventId={event.id} />
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white">
                  Strategy Summary
                </h2>
                {content.yourTeamNumber && (
                  <span className="text-sm text-gray-400">
                    For Team {content.yourTeamNumber}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-200 leading-relaxed">
                {content.summary}
              </p>
            </div>

            {/* Rankings */}
            <div className="rounded-2xl border border-white/10 bg-gray-900/60 shadow-sm overflow-hidden">
              <div className="border-b border-white/10 bg-white/5 px-6 py-3">
                <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                  Ranked Teams ({content.rankings.length})
                </h2>
              </div>

              <div className="divide-y divide-white/10">
                {content.rankings.map((team) => (
                  <div
                    key={team.teamNumber}
                    className="px-6 py-4 hover:bg-white/5 transition"
                  >
                    {/* Top row: rank, team, score, badges */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                            team.rank <= 3
                              ? "bg-purple-600 text-white"
                              : team.rank <= 8
                              ? "bg-purple-500/20 text-purple-200"
                              : "bg-white/10 text-gray-200"
                          }`}
                        >
                          {team.rank}
                        </span>
                        <div>
                          <span className="font-semibold text-white">
                            Team {team.teamNumber}
                          </span>
                          <span className="ml-2 text-sm text-gray-400">
                            {teamNames[team.teamNumber] ?? ""}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${roleColor(team.role)}`}
                        >
                          {team.role}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${synergyColor(team.synergy)}`}
                        >
                          {team.synergy} synergy
                        </span>
                        <span
                          className={`rounded-md px-2 py-1 text-sm font-bold ${scoreColor(team.overallScore)}`}
                        >
                          {team.overallScore}
                        </span>
                      </div>
                    </div>

                    {/* EPA breakdown */}
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      <div className="rounded bg-white/5 p-1.5 text-center">
                        <p className="text-xs text-gray-400">EPA</p>
                        <p className="text-sm font-semibold text-white">
                          {team.epa.total.toFixed(1)}
                        </p>
                      </div>
                      <div className="rounded bg-white/5 p-1.5 text-center">
                        <p className="text-xs text-gray-400">Auto</p>
                        <p className="text-sm font-semibold text-white">
                          {team.epa.auto.toFixed(1)}
                        </p>
                      </div>
                      <div className="rounded bg-white/5 p-1.5 text-center">
                        <p className="text-xs text-gray-400">Teleop</p>
                        <p className="text-sm font-semibold text-white">
                          {team.epa.teleop.toFixed(1)}
                        </p>
                      </div>
                      <div className="rounded bg-white/5 p-1.5 text-center">
                        <p className="text-xs text-gray-400">Endgame</p>
                        <p className="text-sm font-semibold text-white">
                          {team.epa.endgame.toFixed(1)}
                        </p>
                      </div>
                    </div>

                    {/* Pick reason */}
                    <p className="text-sm text-gray-200 mb-1">
                      {team.pickReason}
                    </p>

                    {/* Synergy reason */}
                    <p className="text-xs text-gray-400 italic">
                      Synergy: {team.synergyReason}
                    </p>

                    {/* Strengths & Weaknesses */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {team.strengths.map((s, i) => (
                        <span
                          key={`s-${i}`}
                          className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-200"
                        >
                          + {s}
                        </span>
                      ))}
                      {team.weaknesses.map((w, i) => (
                        <span
                          key={`w-${i}`}
                          className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-200"
                        >
                          − {w}
                        </span>
                      ))}
                    </div>

                    {/* Scouting summary */}
                    {team.scoutingSummary !== "No scouting data" && (
                      <p className="mt-2 text-xs text-gray-400">
                        📋 {team.scoutingSummary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Regenerate */}
            <div className="text-center">
              <GeneratePickListButton
                eventId={event.id}
                label="Regenerate Pick List"
              />
              <p className="mt-2 text-xs text-gray-400">
                Generated {new Date(pickList!.created_at).toLocaleString()}
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

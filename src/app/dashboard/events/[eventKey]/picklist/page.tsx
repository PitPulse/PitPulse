import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { PickListContent } from "@/types/strategy";
import { GeneratePickListButton } from "./generate-button";
import { Navbar } from "@/components/navbar";
import { StrategyChat } from "../strategy-chat";

export default async function PickListPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventKey: string }>;
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const { eventKey } = await params;
  const askParam =
    typeof searchParams?.ask === "string" ? searchParams.ask : null;
  const initialAsk = askParam
    ? `Give me a quick briefing on Team ${askParam} for this event.`
    : "";
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
    if (role === "defender") return "bg-cyan-500/20 text-cyan-200";
    if (role === "versatile") return "bg-purple-500/20 text-purple-200";
    return "bg-white/10 text-gray-200";
  }

  function scoreColor(score: number) {
    if (score >= 80) return "text-green-200 bg-green-500/20";
    if (score >= 60) return "text-blue-200 bg-blue-500/20";
    if (score >= 40) return "text-yellow-200 bg-yellow-500/20";
    return "text-gray-200 bg-white/10";
  }

  const eventTitle = event.year ? `${event.year} ${event.name}` : event.name;
  const generatedAt = pickList?.created_at
    ? new Date(pickList.created_at).toLocaleString()
    : null;

  return (
    <div className="min-h-screen dashboard-page">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-12 pt-24 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {eventTitle}
            </p>
            <h1 className="text-2xl font-bold text-white">Alliance Pick List</h1>
            <p className="mt-1 text-sm text-gray-400">
              AI-ranked partners based on complementarity, EPA, and your scouting.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!content && (
              <GeneratePickListButton eventId={event.id} showDataHint={false} />
            )}
            <Link href={`/dashboard/events/${eventKey}`} className="back-button">
              Back
            </Link>
          </div>
        </div>

        {!content ? (
          <div className="rounded-2xl dashboard-panel p-8 text-center">
            <h2 className="text-lg font-semibold text-white mb-2">
              No Pick List Yet
            </h2>
            <p className="text-gray-400 mb-4">
              Generate an AI-powered pick list based on EPA stats and your team&apos;s
              scouting data. For best suggestions, log plenty of scouting entries
              before generating.
            </p>
            <GeneratePickListButton eventId={event.id} />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
            <div className="space-y-6">
              <section className="rounded-2xl dashboard-panel p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Strategy Summary
                    </h2>
                    <p className="text-xs text-gray-400">
                      {content.rankings.length} teams ranked
                      {content.yourTeamNumber
                        ? ` • built for Team ${content.yourTeamNumber}`
                        : ""}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-300">
                    {generatedAt ? `Generated ${generatedAt}` : "Generated just now"}
                  </span>
                </div>
                <p className="mt-4 text-sm text-gray-200 leading-relaxed">
                  {content.summary}
                </p>
              </section>

              <section className="rounded-2xl dashboard-panel p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300">
                  <span className="text-[10px] uppercase tracking-widest text-gray-400">
                    Legend
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${roleColor("scorer")}`}>
                    scorer
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${roleColor("defender")}`}>
                    defender
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${roleColor("versatile")}`}>
                    versatile
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${synergyColor("high")}`}>
                    high synergy
                  </span>
                  <span className={`rounded-full px-2 py-0.5 ${synergyColor("medium")}`}>
                    medium synergy
                  </span>
                </div>
              </section>

              <section className="rounded-2xl dashboard-table overflow-hidden">
                <div className="border-b border-white/10 bg-white/5 px-6 py-3">
                  <h2 className="text-sm font-semibold text-gray-200 uppercase tracking-wider">
                    Ranked Teams
                  </h2>
                </div>

                <div className="divide-y divide-white/10">
                  {content.rankings.map((team) => (
                    <div
                      key={team.teamNumber}
                      className="px-6 py-5 hover:bg-white/5 transition"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <span
                            className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
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
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-base font-semibold text-white">
                                Team {team.teamNumber}
                              </span>
                              <span className="text-sm text-gray-400">
                                {teamNames[team.teamNumber] ?? ""}
                              </span>
                            </div>
                            <p className="mt-2 text-sm text-gray-200">
                              {team.pickReason}
                            </p>
                            <p className="mt-1 text-xs text-gray-400 italic">
                              Synergy: {team.synergyReason}
                            </p>
                            {team.scoutingSummary !== "No scouting data" && (
                              <p className="mt-2 text-xs text-gray-400">
                                Scouting: {team.scoutingSummary}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${roleColor(team.role)}`}
                          >
                            {team.role}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${synergyColor(team.synergy)}`}
                          >
                            {team.synergy} synergy
                          </span>
                          <span
                            className={`rounded-md px-2.5 py-1 text-sm font-bold ${scoreColor(team.overallScore)}`}
                          >
                            {team.overallScore}
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div className="rounded-lg bg-white/5 p-2 text-center">
                          <p className="text-[10px] uppercase tracking-widest text-gray-400">
                            EPA
                          </p>
                          <p className="text-sm font-semibold text-white">
                            {team.epa.total.toFixed(1)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2 text-center">
                          <p className="text-[10px] uppercase tracking-widest text-gray-400">
                            Auto
                          </p>
                          <p className="text-sm font-semibold text-white">
                            {team.epa.auto.toFixed(1)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2 text-center">
                          <p className="text-[10px] uppercase tracking-widest text-gray-400">
                            Teleop
                          </p>
                          <p className="text-sm font-semibold text-white">
                            {team.epa.teleop.toFixed(1)}
                          </p>
                        </div>
                        <div className="rounded-lg bg-white/5 p-2 text-center">
                          <p className="text-[10px] uppercase tracking-widest text-gray-400">
                            Endgame
                          </p>
                          <p className="text-sm font-semibold text-white">
                            {team.epa.endgame.toFixed(1)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
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
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-6">
              <section className="rounded-2xl dashboard-panel p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                      Ask PitPilot
                    </p>
                    <h2 className="text-lg font-bold text-white">
                      Strategy chat for this event
                    </h2>
                    <p className="text-sm text-gray-400">
                      Get quick insights on opponents and alliance fit.
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <StrategyChat eventKey={eventKey} initialInput={initialAsk} />
                </div>
              </section>

              <section className="rounded-2xl dashboard-panel p-6">
                <h3 className="text-sm font-semibold text-white">
                  Refresh the list
                </h3>
                <p className="mt-2 text-xs text-gray-400">
                  Regenerate after new scouting data or updated EPA stats.
                </p>
                <div className="mt-4">
                  <GeneratePickListButton
                    eventId={event.id}
                    label="Regenerate Pick List"
                    showDataHint={false}
                  />
                </div>
              </section>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

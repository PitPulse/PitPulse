import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";

export default async function MatchListPage({
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

  // Get event
  const { data: event } = await supabase
    .from("events")
    .select("id, name")
    .eq("tba_key", eventKey)
    .single();

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <p className="text-gray-400">Event not found. Sync it first.</p>
      </div>
    );
  }

  // Get matches ordered by comp_level, set_number, then match_number
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("event_id", event.id)
    .order("comp_level")
    .order("set_number", { ascending: true, nullsFirst: true })
    .order("match_number");

  // Get user's scouting entries for this event
  const matchIds = matches?.map((m) => m.id) ?? [];
  let myEntries: Array<{ match_id: string; team_number: number }> = [];
  if (matchIds.length > 0) {
    const { data } = await supabase
      .from("scouting_entries")
      .select("match_id, team_number")
      .eq("scouted_by", user.id)
      .in("match_id", matchIds);
    myEntries = data ?? [];
  }

  const scoutedSet = new Set(
    myEntries?.map((e) => `${e.match_id}-${e.team_number}`) ?? []
  );

  // Get user's org for brief check
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();
  if (!profile?.org_id) redirect("/join");

  // Check which matches have existing briefs
  let existingBriefs: Array<{ match_id: string }> = [];
  if (matchIds.length > 0 && profile?.org_id) {
    const { data } = await supabase
      .from("strategy_briefs")
      .select("match_id")
      .eq("org_id", profile.org_id)
      .in("match_id", matchIds);
    existingBriefs = data ?? [];
  }

  const briefSet = new Set(
    existingBriefs?.map((b) => b.match_id) ?? []
  );

  // Get user's assignments for this event
  let myAssignments: Array<{ match_id: string; team_number: number }> = [];
  if (matchIds.length > 0) {
    const { data } = await supabase
      .from("scout_assignments")
      .select("match_id, team_number")
      .eq("assigned_to", user.id)
      .in("match_id", matchIds);
    myAssignments = data ?? [];
  }

  const assignedSet = new Set(
    myAssignments?.map((a) => `${a.match_id}-${a.team_number}`) ?? []
  );

  // Group matches by comp_level
  const qualMatches = matches?.filter((m) => m.comp_level === "qm") ?? [];
  const playoffMatches = matches?.filter((m) => m.comp_level !== "qm") ?? [];

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

  function MatchCard({
    match,
  }: {
    match: NonNullable<typeof matches>[number];
  }) {
    const hasScore = match.red_score !== null;
    const hasBrief = briefSet.has(match.id);
    return (
      <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">
            {compLabel(
              match.comp_level,
              match.match_number,
              match.set_number
            )}
          </span>
          <div className="flex items-center gap-2">
            {hasScore && (
              <span className="text-xs text-gray-400">
                {match.red_score} - {match.blue_score}
              </span>
            )}
            <Link
              href={`/dashboard/events/${eventKey}/matches/${match.id}/brief`}
              className={`rounded px-2 py-1 text-xs font-medium transition ${
                hasBrief
                  ? "bg-purple-500/20 text-purple-200 hover:bg-purple-500/30"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-purple-200"
              }`}
            >
              {hasBrief ? "View Brief" : "AI Brief"}
            </Link>
          </div>
        </div>

        {/* Red Alliance */}
        <div className="mb-1 flex gap-1">
          {match.red_teams.map((team) => {
            const scouted = scoutedSet.has(`${match.id}-${team}`);
            const assigned = assignedSet.has(`${match.id}-${team}`);
            return (
              <Link
                key={team}
                href={`/scout/${match.id}/${team}`}
                className={`flex-1 rounded px-2 py-1.5 text-center text-xs font-medium transition ${
                  scouted
                    ? "bg-red-500/30 text-red-100 ring-2 ring-red-400/60"
                    : assigned
                    ? "bg-red-500/20 text-red-100 ring-2 ring-orange-400/60"
                    : "bg-red-500/10 text-red-200 hover:bg-red-500/20"
                }`}
              >
                {team}
                {scouted ? " ✓" : assigned ? " ★" : ""}
              </Link>
            );
          })}
        </div>

        {/* Blue Alliance */}
        <div className="flex gap-1">
          {match.blue_teams.map((team) => {
            const scouted = scoutedSet.has(`${match.id}-${team}`);
            const assigned = assignedSet.has(`${match.id}-${team}`);
            return (
              <Link
                key={team}
                href={`/scout/${match.id}/${team}`}
                className={`flex-1 rounded px-2 py-1.5 text-center text-xs font-medium transition ${
                  scouted
                    ? "bg-blue-500/30 text-blue-100 ring-2 ring-blue-400/60"
                    : assigned
                    ? "bg-blue-500/20 text-blue-100 ring-2 ring-orange-400/60"
                    : "bg-blue-500/10 text-blue-200 hover:bg-blue-500/20"
                }`}
              >
                {team}
                {scouted ? " ✓" : assigned ? " ★" : ""}
              </Link>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 pb-12 pt-24 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {event.name}
            </p>
            <h1 className="text-lg font-bold">Scout matches</h1>
            <p className="text-xs text-gray-400">
              Tap a team number to scout
            </p>
          </div>
          <Link
            href={`/dashboard/events/${eventKey}`}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/5"
          >
            Back
          </Link>
        </div>
        {/* Qual Matches */}
        {qualMatches.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Qualification Matches ({qualMatches.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {qualMatches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        )}

        {/* Playoff Matches */}
        {playoffMatches.length > 0 && (
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
              Playoff Matches ({playoffMatches.length})
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {playoffMatches.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        )}

        {(!matches || matches.length === 0) && (
          <p className="text-center text-sm text-gray-400 py-8">
            No matches found. Sync the event first.
          </p>
        )}
      </main>
    </div>
  );
}

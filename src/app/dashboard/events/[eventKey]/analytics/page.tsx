import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { AnalyticsDashboard } from "./analytics-dashboard";

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
    ? `Analytics — ${event.year ? `${event.year} ` : ""}${event.name} | PitPilot`
    : "Analytics | PitPilot";
  return { title };
}

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

export default async function AnalyticsPage({
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

  // Get all matches
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("event_id", event.id)
    .order("comp_level")
    .order("set_number", { ascending: true, nullsFirst: true })
    .order("match_number");

  const matchIds = matches?.map((m) => m.id) ?? [];

  // Get all scouting entries for this event (org-scoped)
  const scoutingEntries =
    matchIds.length > 0
      ? (
          await supabase
            .from("scouting_entries")
            .select("*, profiles(display_name)")
            .eq("org_id", profile.org_id)
            .in("match_id", matchIds)
            .order("created_at", { ascending: true })
        ).data ?? []
      : [];

  // Get team EPA stats
  const { data: stats } = await supabase
    .from("team_event_stats")
    .select("*")
    .eq("event_id", event.id);

  const statsMap = new Map(
    (stats ?? []).map((s) => [s.team_number, s])
  );

  // Get team names
  const teamNumbers = Array.from(
    new Set(scoutingEntries.map((e) => e.team_number))
  );
  const { data: teams } = await supabase
    .from("teams")
    .select("team_number, name")
    .in("team_number", teamNumbers.length > 0 ? teamNumbers : [0]);

  const teamNameMap = new Map(
    (teams ?? []).map((t) => [t.team_number, t.name])
  );

  // Build match label lookup
  const matchMap = new Map(
    (matches ?? []).map((m) => [
      m.id,
      {
        label: compLabel(m.comp_level, m.match_number, m.set_number),
        redTeams: m.red_teams as number[],
        blueTeams: m.blue_teams as number[],
      },
    ])
  );

  // Safely parse Json fields from Supabase
  function toStringArray(val: unknown): string[] {
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === "string");
    return [];
  }
  function toBoolRecord(val: unknown): Record<string, boolean> | null {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        if (typeof v === "boolean") out[k] = v;
      }
      return Object.keys(out).length > 0 ? out : null;
    }
    return null;
  }

  // Build data for client
  const scoutingRows = scoutingEntries.map((entry) => {
    const match = matchMap.get(entry.match_id);
    return {
      matchLabel: match?.label ?? "?",
      teamNumber: entry.team_number,
      teamName: teamNameMap.get(entry.team_number) ?? "Unknown",
      scoutedBy: entry.profiles?.display_name ?? "Unknown",
      autoScore: entry.auto_score,
      autoStartPosition: entry.auto_start_position ?? null,
      autoNotes: entry.auto_notes || "",
      teleopScore: entry.teleop_score,
      intakeMethods: toStringArray(entry.intake_methods),
      endgameScore: entry.endgame_score,
      climbLevels: toStringArray(entry.climb_levels),
      shootingRanges: toStringArray(entry.shooting_ranges),
      shootingReliability: entry.shooting_reliability ?? null,
      cycleTimeRating: entry.cycle_time_rating ?? null,
      defenseRating: entry.defense_rating,
      reliabilityRating: entry.reliability_rating,
      abilityAnswers: toBoolRecord(entry.ability_answers),
      notes: entry.notes || "",
    };
  });

  const teamStatsData = teamNumbers.map((num) => {
    const stat = statsMap.get(num);
    const teamEntries = scoutingEntries.filter((e) => e.team_number === num);
    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      teamNumber: num,
      teamName: teamNameMap.get(num) ?? "Unknown",
      entryCount: teamEntries.length,
      scoutAvg: teamEntries.length > 0
        ? {
            auto: avg(teamEntries.map((e) => e.auto_score)),
            teleop: avg(teamEntries.map((e) => e.teleop_score)),
            endgame: avg(teamEntries.map((e) => e.endgame_score)),
          }
        : null,
      epa: stat
        ? {
            auto: stat.auto_epa,
            teleop: stat.teleop_epa,
            endgame: stat.endgame_epa,
            total: stat.epa,
          }
        : null,
      avgDefense: teamEntries.length > 0
        ? avg(teamEntries.map((e) => e.defense_rating))
        : null,
      avgReliability: teamEntries.length > 0
        ? avg(teamEntries.map((e) => e.reliability_rating))
        : null,
    };
  });

  const eventTitle = event.year ? `${event.year} ${event.name}` : event.name;

  return (
    <div className="min-h-screen dashboard-page">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-32 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {eventTitle}
            </p>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="mt-1 text-sm text-gray-400">
              {scoutingEntries.length} scouting entries across{" "}
              {teamNumbers.length} teams
            </p>
          </div>
          <Link
            href={`/dashboard/events/${eventKey}`}
            className="back-button"
          >
            Back
          </Link>
        </div>

        <AnalyticsDashboard
          eventTitle={eventTitle}
          eventKey={eventKey}
          scoutingRows={scoutingRows}
          teamStats={teamStatsData}
        />
      </main>
    </div>
  );
}

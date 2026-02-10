import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TeamStatsTable } from "./team-stats-table";
import { Navbar } from "@/components/navbar";

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

  // Get event
  const { data: event } = await supabase
    .from("events")
    .select("*")
    .eq("tba_key", eventKey)
    .single();

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Event not found</h1>
          <p className="text-gray-400">
            Sync event <span className="font-mono">{eventKey}</span> first from the dashboard.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/5"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Get team stats for this event
  const { data: stats } = await supabase
    .from("team_event_stats")
    .select("*")
    .eq("event_id", event.id)
    .order("epa", { ascending: false, nullsFirst: false });

  // Get team names
  const teamNumbers = stats?.map((s) => s.team_number) ?? [];
  const { data: teams } = await supabase
    .from("teams")
    .select("team_number, name, city, state")
    .in("team_number", teamNumbers.length > 0 ? teamNumbers : [0]);

  const teamsMap = new Map(teams?.map((t) => [t.team_number, t]) ?? []);

  // Merge stats with team info
  const tableData = (stats ?? []).map((s) => {
    const team = teamsMap.get(s.team_number);
    return {
      team_number: s.team_number,
      name: team?.name ?? "Unknown",
      city: team?.city ?? "",
      state: team?.state ?? "",
      epa: s.epa,
      auto_epa: s.auto_epa,
      teleop_epa: s.teleop_epa,
      endgame_epa: s.endgame_epa,
      win_rate: s.win_rate,
    };
  });

  // Get match count
  const { count: matchCount } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("event_id", event.id);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-24">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              Event overview
            </p>
            <h1 className="mt-2 text-2xl font-bold">{event.name}</h1>
            <p className="mt-1 text-sm text-gray-400">
              {event.location} &middot; {event.year} &middot;{" "}
              {teamNumbers.length} teams &middot; {matchCount ?? 0} matches
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/dashboard/events/${eventKey}/matches`}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
            >
              Scout Matches
            </Link>
            <Link
              href={`/dashboard/events/${eventKey}/assignments`}
              className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
            >
              Assignments
            </Link>
            <Link
              href={`/dashboard/events/${eventKey}/picklist`}
              className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500"
            >
              Pick List
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/5"
            >
              Back
            </Link>
          </div>
        </div>

        {tableData.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-8 text-center">
            <p className="text-gray-400">
              No team stats yet. Sync stats from the dashboard.
            </p>
          </div>
        ) : (
          <TeamStatsTable data={tableData} eventKey={eventKey} />
        )}
      </main>
    </div>
  );
}

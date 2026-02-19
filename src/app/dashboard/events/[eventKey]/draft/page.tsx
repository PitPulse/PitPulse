import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchEventRankings } from "@/lib/tba";
import { Navbar } from "@/components/navbar";
import type { PickListContent } from "@/types/strategy";
import { DraftRoom } from "./draft-room";
import { getScoutingFormConfig } from "@/lib/platform-settings";

export default async function DraftRoomPage({
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
      <div className="min-h-screen dashboard-page">
        <Navbar />
        <main className="mx-auto max-w-3xl px-4 pb-12 pt-32">
          <div className="rounded-2xl dashboard-panel p-8 text-center">
            <p className="text-gray-400">
              Event not found. Sync it first from the dashboard.
            </p>
            <Link href="/dashboard" className="back-button mt-4">
              Back to dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  let rankings: Array<{ rank: number; teamNumber: number }> = [];
  try {
    rankings = await fetchEventRankings(eventKey);
  } catch {
    rankings = [];
  }
  rankings = rankings.sort((a, b) => a.rank - b.rank);

  const { data: eventTeams } = await supabase
    .from("event_teams")
    .select("team_number")
    .eq("event_id", event.id);

  const teamSet = new Set<number>(
    rankings.map((r) => r.teamNumber).filter((num) => !Number.isNaN(num))
  );
  for (const row of eventTeams ?? []) {
    teamSet.add(row.team_number);
  }

  const teamNumbers = Array.from(teamSet);
  const { data: teams } = await supabase
    .from("teams")
    .select("team_number, name")
    .in("team_number", teamNumbers.length > 0 ? teamNumbers : [0]);

  const teamNames: Record<number, string> = {};
  for (const team of teams ?? []) {
    teamNames[team.team_number] = team.name ?? `Team ${team.team_number}`;
  }

  const { data: pickListRow } = await supabase
    .from("pick_lists")
    .select("content")
    .eq("event_id", event.id)
    .eq("org_id", profile.org_id)
    .maybeSingle();

  const pickList = pickListRow?.content as PickListContent | null;

  const { data: draftSession, error: draftSessionError } = await supabase
    .from("draft_sessions")
    .select("id, state")
    .eq("event_id", event.id)
    .eq("org_id", profile.org_id)
    .maybeSingle();
  const storageEnabled = !draftSessionError;

  const [eventTitle, scoutingFormConfig] = await Promise.all([
    Promise.resolve(event.year ? `${event.year} ${event.name}` : event.name),
    getScoutingFormConfig(supabase),
  ]);

  return (
    <div className="min-h-screen dashboard-page">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-32 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              Draft room
            </p>
            <h1 className="text-2xl font-bold text-white">{eventTitle}</h1>
            <p className="text-sm text-gray-400">
              AI pick guidance on the left, manual draft board on the right.
            </p>
          </div>
          <Link href={`/dashboard/events/${eventKey}`} className="back-button">
            Back
          </Link>
        </div>

        <DraftRoom
          eventId={event.id}
          eventKey={eventKey}
          orgId={profile.org_id}
          rankings={rankings}
          teamNames={teamNames}
          pickList={pickList}
          existingSession={draftSession ?? null}
          storageEnabled={storageEnabled}
          formConfig={scoutingFormConfig}
        />
      </main>
    </div>
  );
}

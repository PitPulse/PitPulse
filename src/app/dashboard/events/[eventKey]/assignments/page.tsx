import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AssignmentGrid } from "./assignment-grid";
import { MyAssignments } from "./my-assignments";
import { Navbar } from "@/components/navbar";
import { AssignmentsTour } from "./assignments-tour";

export default async function AssignmentsPage({
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
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) redirect("/join");

  const isCaptain = profile.role === "captain";

  const { data: org } = await supabase
    .from("organizations")
    .select("team_number")
    .eq("id", profile.org_id)
    .single();

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

  // Get matches ordered by comp_level, set_number, and match_number
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .eq("event_id", event.id)
    .order("comp_level", { ascending: true })
    .order("set_number", { ascending: true, nullsFirst: true })
    .order("match_number", { ascending: true });

  // Get org members
  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("org_id", profile.org_id);

  // Get existing assignments
  const { data: assignments } = await supabase
    .from("scout_assignments")
    .select("*")
    .eq("org_id", profile.org_id)
    .in(
      "match_id",
      (matches ?? []).map((m) => m.id)
    );

  const eventTitle = event.year ? `${event.year} ${event.name}` : event.name;

  return (
    <div className="min-h-screen dashboard-page">
      <Navbar />
      <AssignmentsTour isCaptain={isCaptain} />
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-32">
        <div data-tour="assignments-header" className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {eventTitle}
            </p>
            <h1 className="text-lg font-bold">Scout Assignments</h1>
          </div>
          <Link
            href={`/dashboard/events/${eventKey}`}
            className="back-button"
          >
            Back
          </Link>
        </div>
        <div data-tour="assignments-workspace">
          {isCaptain ? (
            <AssignmentGrid
              matches={matches ?? []}
              members={members ?? []}
              assignments={assignments ?? []}
              orgId={profile.org_id}
              eventKey={eventKey}
              orgTeamNumber={org?.team_number ?? null}
            />
          ) : (
            <MyAssignments
              matches={matches ?? []}
              assignments={(assignments ?? []).filter(
                (a) => a.assigned_to === user.id
              )}
            />
          )}
        </div>
      </main>
    </div>
  );
}

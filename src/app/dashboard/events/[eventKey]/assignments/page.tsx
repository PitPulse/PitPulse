import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AssignmentGrid } from "./assignment-grid";
import { MyAssignments } from "./my-assignments";
import { Navbar } from "@/components/navbar";

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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-24">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              {event.name}
            </p>
            <h1 className="text-lg font-bold">Scout Assignments</h1>
          </div>
          <Link
            href={`/dashboard/events/${eventKey}`}
            className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/5"
          >
            Back
          </Link>
        </div>
        {isCaptain ? (
          <AssignmentGrid
            matches={matches ?? []}
            members={members ?? []}
            assignments={assignments ?? []}
            orgId={profile.org_id}
            eventKey={eventKey}
          />
        ) : (
          <MyAssignments
            matches={matches ?? []}
            assignments={(assignments ?? []).filter(
              (a) => a.assigned_to === user.id
            )}
          />
        )}
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { ReportsList } from "./reports-list";

export const metadata: Metadata = {
  title: "My Reports | PitPilot",
  description: "Review every scouting report you have submitted.",
};

export default async function ReportsPage() {
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

  const { data: reports } = await supabase
    .from("scouting_entries")
    .select(
      "id, created_at, team_number, match_id, auto_score, teleop_score, endgame_score, defense_rating, reliability_rating, notes, profiles(display_name), matches (comp_level, match_number, set_number, event_id, events (name, year, tba_key))"
    )
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false });

  const isCaptain = profile?.role === "captain";

  // Normalize joined data — Supabase returns single-row joins as objects,
  // but the types sometimes reflect arrays. Normalise here so the client
  // component receives a consistent shape.
  const normalizedReports = (reports ?? []).map((r) => {
    const matchRaw = Array.isArray(r.matches) ? r.matches[0] : r.matches;
    const eventRaw = matchRaw
      ? Array.isArray(matchRaw.events)
        ? matchRaw.events[0]
        : matchRaw.events
      : null;
    return {
      ...r,
      matches: matchRaw ? { ...matchRaw, events: eventRaw } : null,
      profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles,
    };
  });

  return (
    <div className="min-h-screen dashboard-page">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-12 pt-32 space-y-6">
        <ReportsList
          initialReports={normalizedReports as never}
          orgId={profile.org_id}
          isCaptain={isCaptain}
        />
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ScoutingForm } from "./scouting-form";

export default async function ScoutPage({
  params,
}: {
  params: Promise<{ matchId: string; teamNumber: string }>;
}) {
  const { matchId, teamNumber } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) redirect("/join");

  // Get match info
  const { data: match } = await supabase
    .from("matches")
    .select("*, events(name, tba_key)")
    .eq("id", matchId)
    .single();

  if (!match) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <p className="text-gray-400">Match not found.</p>
      </div>
    );
  }

  // Check for existing entry
  const { data: existing } = await supabase
    .from("scouting_entries")
    .select("*")
    .eq("match_id", matchId)
    .eq("team_number", parseInt(teamNumber))
    .eq("scouted_by", user.id)
    .maybeSingle();

  const hasLegacy =
    match.comp_level !== "qm" && !match.set_number && match.match_number >= 100;
  const normalizedSet = hasLegacy
    ? Math.floor(match.match_number / 100)
    : match.set_number ?? null;
  const normalizedMatch = hasLegacy
    ? match.match_number % 100
    : match.match_number;
  const prefix =
    match.comp_level === "sf"
      ? "SF"
      : match.comp_level === "f"
      ? "F"
      : match.comp_level.toUpperCase();
  const compLabel =
    match.comp_level === "qm"
      ? `Qual ${normalizedMatch}`
      : normalizedSet
      ? `${prefix} ${normalizedSet}-${normalizedMatch}`
      : `${prefix} ${normalizedMatch}`;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-white/10 bg-gray-950/80 backdrop-blur">
        <div className="mx-auto max-w-lg px-4 py-3">
          <p className="text-xs text-gray-400">
            {match.events?.name ?? "Event"}
          </p>
          <h1 className="text-lg font-bold text-white">
            {compLabel} &mdash; Team {teamNumber}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        <ScoutingForm
          matchId={matchId}
          teamNumber={parseInt(teamNumber)}
          orgId={profile.org_id}
          userId={user.id}
          existing={existing}
        />
      </main>
    </div>
  );
}

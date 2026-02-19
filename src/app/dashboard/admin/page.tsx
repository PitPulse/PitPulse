import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { AdminPanel } from "./admin-panel";
import {
  getEventSyncMinYear,
  getScoutingAbilityQuestions,
  getScoutingFormConfig,
  getTeamAiPromptLimits,
} from "@/lib/platform-settings";

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, is_staff")
    .eq("id", user.id)
    .single();

  if (!profile?.is_staff) {
    redirect("/dashboard");
  }

  const [orgsRes, profilesRes, entriesRes, matchesRes, eventsRes] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, team_number, join_code, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("scouting_entries").select("id", { count: "exact", head: true }),
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }),
  ]);

  const { data: testimonials } = await supabase
    .from("testimonials")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: announcements } = await supabase
    .from("announcements")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: contactMessages } = await supabase
    .from("contact_messages")
    .select("id, email, subject, message, status, response, created_at, responded_at")
    .order("created_at", { ascending: false });

  // Analytics: signups over time (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const cutoff = thirtyDaysAgo.toISOString();

  const [signupsRes, orgsTimeRes, entriesTimeRes, messagesTimeRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true }),
    supabase
      .from("organizations")
      .select("created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true }),
    supabase
      .from("scouting_entries")
      .select("created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true }),
    supabase
      .from("team_messages")
      .select("created_at")
      .gte("created_at", cutoff)
      .order("created_at", { ascending: true }),
  ]);

  // Aggregate by day
  function aggregateByDay(rows: { created_at: string }[] | null): { date: string; count: number }[] {
    const map = new Map<string, number>();
    // Pre-fill last 30 days
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      map.set(key, 0);
    }
    for (const row of rows ?? []) {
      const key = row.created_at.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  }

  const analytics = {
    signups: aggregateByDay(signupsRes.data),
    organizations: aggregateByDay(orgsTimeRes.data),
    scoutingEntries: aggregateByDay(entriesTimeRes.data),
    messages: aggregateByDay(messagesTimeRes.data),
  };

  const [eventSyncMinYear, scoutingAbilityQuestions, teamAiPromptLimits, scoutingFormConfig] = await Promise.all([
    getEventSyncMinYear(supabase),
    getScoutingAbilityQuestions(supabase),
    getTeamAiPromptLimits(supabase),
    getScoutingFormConfig(supabase),
  ]);

  return (
    <>
      <Navbar />
      <AdminPanel
        stats={{
          organizations: orgsRes.data?.length ?? 0,
          users: profilesRes.count ?? 0,
          entries: entriesRes.count ?? 0,
          matches: matchesRes.count ?? 0,
          events: eventsRes.count ?? 0,
        }}
        organizations={orgsRes.data ?? []}
        testimonials={testimonials ?? []}
        announcements={announcements ?? []}
        contactMessages={contactMessages ?? []}
        analytics={analytics}
        eventSyncMinYear={eventSyncMinYear}
        scoutingAbilityQuestions={scoutingAbilityQuestions}
        teamAiPromptLimits={teamAiPromptLimits}
        scoutingFormConfig={scoutingFormConfig}
        adminName={profile.display_name ?? user.email ?? "Admin"}
        adminEmail={user.email ?? ""}
      />
    </>
  );
}

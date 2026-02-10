import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { AdminPanel } from "./admin-panel";

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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-24">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Website Admin
          </p>
          <h1 className="mt-2 text-3xl font-bold">Platform overview</h1>
          <p className="mt-2 text-sm text-gray-300">
            Manage teams, testimonials, announcements, and website analytics.
          </p>
        </div>

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
        />
      </main>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { PulseClient } from "./pulse-client";

export default async function TeamPulsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, display_name, role")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    redirect("/join");
  }

  const { data: messages } = await supabase
    .from("team_messages")
    .select("id, content, message_type, match_key, created_at, author_id, profiles(display_name)")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: true })
    .limit(200);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-24">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              Team Pulse
            </p>
            <h1 className="mt-2 text-3xl font-bold">Stay synced in real time</h1>
            <p className="mt-2 max-w-2xl text-sm text-gray-300">
              A lightweight team channel for strategy calls, quick updates, and
              match-day coordination.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-white/5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            Back to dashboard
          </Link>
        </div>

        <PulseClient
          orgId={profile.org_id}
          userId={profile.id}
          displayName={profile.display_name}
          initialMessages={messages ?? []}
        />
      </main>
    </div>
  );
}

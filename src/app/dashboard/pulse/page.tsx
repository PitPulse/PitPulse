import { redirect } from "next/navigation";
import Link from "next/link";
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
    .select("id, org_id, display_name, role, team_roles")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    redirect("/join");
  }

  const { data: messages } = await supabase
    .from("team_messages")
    .select(
      "id, content, message_type, match_key, created_at, author_id, reply_to_id, profiles(display_name, team_roles)"
    )
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: true })
    .limit(200);

  return (
    <div className="min-h-screen dashboard-page">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-32">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
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
            className="back-button"
          >
            Back to dashboard
          </Link>
        </div>

        <PulseClient
          orgId={profile.org_id}
          userId={profile.id}
          displayName={profile.display_name}
          teamRoles={profile.team_roles ?? []}
          initialMessages={messages ?? []}
        />
      </main>
    </div>
  );
}

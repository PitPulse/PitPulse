import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings | ScoutAI",
  description: "Manage your ScoutAI team settings, join codes, and member roles.",
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    redirect("/join");
  }

  const org = profile.organizations;

  // Get member count
  const { count: memberCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("org_id", profile.org_id);

  const { data: members } = await supabase
    .from("profiles")
    .select("id, display_name, role, created_at")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 pb-12 pt-24">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              Settings
            </p>
            <h1 className="mt-2 text-3xl font-bold">Team &amp; account setup</h1>
            <p className="mt-2 text-sm text-gray-300">
              Manage your team details, join code, and profile preferences.
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

        <SettingsForm
          profile={{
            displayName: profile.display_name,
            email: user.email ?? "",
            role: profile.role,
          }}
          org={{
            name: org?.name ?? "",
            teamNumber: org?.team_number ?? null,
            joinCode: org?.join_code ?? "",
          }}
          memberCount={memberCount ?? 0}
          isCaptain={profile.role === "captain"}
          members={members ?? []}
        />
      </main>
    </div>
  );
}

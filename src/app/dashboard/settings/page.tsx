import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { TeamSettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Settings | PitPilot",
  description: "Manage your PitPilot team settings, join codes, and member roles.",
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
    <div className="min-h-screen dashboard-page">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 pb-12 pt-24">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
              Settings
            </p>
            <h1 className="mt-2 text-3xl font-bold">Team settings</h1>
            <p className="mt-2 text-sm text-gray-300">
              Manage organization details, join codes, and member roles.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard"
              className="back-button"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <TeamSettingsForm
          org={{
            name: org?.name ?? "",
            teamNumber: org?.team_number ?? null,
            joinCode: org?.join_code ?? "",
            planTier: (org?.plan_tier as "free" | "supporter" | undefined) ?? "free",
          }}
          memberCount={memberCount ?? 0}
          isCaptain={profile.role === "captain"}
          members={members ?? []}
        />
      </main>
    </div>
  );
}

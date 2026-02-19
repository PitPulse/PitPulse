import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { AccountSettingsForm } from "./account-settings-form";

export const metadata: Metadata = {
  title: "Account Settings | PitPilot",
  description: "Manage your PitPilot account profile and preferences.",
};

export default async function AccountSettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, role, org_id, team_roles")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    redirect("/join");
  }

  return (
    <div className="min-h-screen dashboard-page">
      <Navbar />

      <main className="mx-auto max-w-4xl px-4 pb-12 pt-32">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
              Account
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white">Account settings</h1>
            <p className="mt-2 text-sm text-gray-300">
              Update your profile details and view account info.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard/settings" className="back-button">
              Team settings
            </Link>
            <Link
              href="/dashboard"
              className="back-button"
            >
              Back to dashboard
            </Link>
          </div>
        </div>

        <AccountSettingsForm
          profile={{
            displayName: profile.display_name,
            email: user.email ?? "",
            role: profile.role,
            teamRoles: profile.team_roles ?? [],
          }}
        />
      </main>
    </div>
  );
}

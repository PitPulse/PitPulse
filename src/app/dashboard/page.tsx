import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { SyncEventForm } from "./sync-event-form";
import { LeaveTeamButton } from "@/components/leave-team-button";

export const metadata: Metadata = {
  title: "Dashboard | ScoutAI",
  description: "Your FRC scouting dashboard — manage events, view data, and access AI strategy tools.",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get profile with org info
  const { data: profile } = await supabase
    .from("profiles")
    .select("*, organizations(*)")
    .eq("id", user.id)
    .single();

  // If no org, redirect website admins to admin dashboard, others to join/create flow
  if (!profile?.org_id) {
    if (profile?.is_staff) {
      redirect("/dashboard/admin");
    }
    redirect("/join");
  }

  const org = profile.organizations;

  const formatDate = (value?: string | null) => {
    if (!value) return "TBA";
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return value;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Get synced events
  const { data: events } = await supabase
    .from("events")
    .select("*")
    .order("start_date", { ascending: false });

  const { count: memberCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("org_id", profile.org_id);

  const { count: scoutingCount } = await supabase
    .from("scouting_entries")
    .select("*", { count: "exact", head: true })
    .eq("org_id", profile.org_id);

  const eventsCount = events?.length ?? 0;

  const { data: pulseMessages } = await supabase
    .from("team_messages")
    .select("id, content, message_type, created_at, profiles(display_name)")
    .eq("org_id", profile.org_id)
    .order("created_at", { ascending: false })
    .limit(5);

  const pulsePreview =
    pulseMessages && pulseMessages.length > 0
      ? pulseMessages.map((message) => {
          const profileName = Array.isArray(message.profiles)
            ? message.profiles[0]?.display_name
            : message.profiles?.display_name;
          const snippet =
            message.content.length > 120
              ? `${message.content.slice(0, 120)}…`
              : message.content;
          return (
            <div
              key={message.id}
              className="rounded-2xl border border-white/10 bg-gray-900/60 px-4 py-3"
            >
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="font-semibold text-gray-200">
                  {profileName ?? "Teammate"}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-0.5 uppercase tracking-wide text-gray-300">
                  {message.message_type}
                </span>
                <span>
                  {new Date(message.created_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-200">{snippet}</p>
            </div>
          );
        })
      : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <Navbar />

      {/* Main content */}
      <main className="mx-auto max-w-7xl px-4 pb-12 pt-24">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
              Team Overview
            </p>
            <h2 className="mt-2 text-2xl font-bold text-white">
              {org?.team_number ? `Team ${org.team_number}` : org?.name}
            </h2>
            {org?.team_number && org?.name && (
              <p className="mt-1 text-sm text-gray-300">{org.name}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-gray-300">
              <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-300 capitalize">
                {profile.role}
              </span>
              <span className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-gray-200">
                Join code
                <span className="font-mono text-white">{org?.join_code}</span>
              </span>
            </div>
            <p className="mt-4 text-sm text-gray-300">
              Welcome back, {profile.display_name}. Sync events and keep scouting
              data flowing for the next match.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Events Synced
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {eventsCount}
              </p>
              <p className="text-xs text-gray-400">Across all seasons</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Team Members
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {memberCount ?? 0}
              </p>
              <p className="text-xs text-gray-400">
                Scouts, strategists, and captains
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                Scouting Entries
              </p>
              <p className="mt-2 text-2xl font-bold text-white">
                {scoutingCount ?? 0}
              </p>
              <p className="text-xs text-gray-400">Total logged this season</p>
            </div>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white">Quick Sync</h3>
            <p className="mt-1 text-sm text-gray-300">
              Pull teams, matches, and EPA data for a new event.
            </p>
            <div className="mt-4">
              <SyncEventForm />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white">
              Team Settings
            </h3>
            <p className="mt-1 text-sm text-gray-300">
              Manage join codes, roles, and organization details.
            </p>
            <Link
              href="/dashboard/settings"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-white/5"
            >
              Open settings
            </Link>
            <div className="mt-4">
              <LeaveTeamButton />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-white">
              Strategy Tools
            </h3>
            <p className="mt-1 text-sm text-gray-300">
              Open event pages to build briefs, picklists, and assignments.
            </p>
            <p className="mt-4 text-sm font-medium text-blue-300">
              Select an event below
            </p>
          </div>
        </div>

        {/* Events List */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Your Events</h3>

          {!events || events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-gray-900/50 p-8 text-center text-sm text-gray-400">
              <p className="text-base font-semibold text-white">
                No events synced yet
              </p>
              <p className="mt-2 text-sm text-gray-400">
                Use Quick Sync above to import your first event.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <Link
                  key={event.id}
                  href={`/dashboard/events/${event.tba_key}`}
                  className="block rounded-2xl border border-white/10 bg-gray-900/60 p-5 shadow-sm transition hover:border-blue-500/60 hover:shadow-md"
                >
                  <h4 className="text-base font-semibold text-white">
                    {event.name}
                  </h4>
                  <p className="mt-2 text-xs text-gray-400">{event.location}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {formatDate(event.start_date)} &mdash;{" "}
                    {formatDate(event.end_date)}
                  </p>
                  <span className="mt-3 inline-flex items-center rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300">
                    Open event
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="mt-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-white">Team Pulse</h3>
              <p className="text-sm text-gray-400">
                Recent team updates and strategy chatter.
              </p>
            </div>
            <Link
              href="/dashboard/pulse"
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-gray-200 hover:bg-white/5"
            >
              Open channel
            </Link>
          </div>
          <div className="grid gap-3">
            {pulsePreview ? (
              pulsePreview
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-gray-900/40 p-6 text-sm text-gray-400">
                No pulse updates yet. Start the conversation in Team Pulse.
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 rounded-2xl border bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950 p-6 text-white shadow-lg">
          <h3 className="text-lg font-semibold">Next match strategy</h3>
          <p className="mt-2 text-sm text-blue-100/80">
            Open an event, pick a match, and generate AI briefs with scouting
            context.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              AI Briefs
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              Alliance Picks
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">
              Scout Assignments
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

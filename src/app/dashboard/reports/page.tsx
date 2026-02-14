import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/navbar";
import { ConfirmButton } from "@/components/confirm-button";
import {
  deleteAllScoutingReports,
  deleteScoutingReport,
} from "@/lib/scouting-report-actions";

export const metadata: Metadata = {
  title: "My Reports | PitPilot",
  description: "Review every scouting report you have submitted.",
};

function compLabel(
  compLevel: string,
  matchNumber: number,
  setNumber?: number | null
) {
  const hasLegacy = compLevel !== "qm" && !setNumber && matchNumber >= 100;
  const normalizedSet = hasLegacy
    ? Math.floor(matchNumber / 100)
    : setNumber ?? null;
  const normalizedMatch = hasLegacy ? matchNumber % 100 : matchNumber;

  if (compLevel === "qm") return `Qual ${normalizedMatch}`;

  const prefix =
    compLevel === "sf"
      ? "SF"
      : compLevel === "f"
      ? "F"
      : compLevel.toUpperCase();

  return normalizedSet
    ? `${prefix} ${normalizedSet}-${normalizedMatch}`
    : `${prefix} ${normalizedMatch}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function starDisplay(rating: number) {
  return "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));
}

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

  return (
    <div className="min-h-screen dashboard-page">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 pb-12 pt-24 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
              Scouting history
            </p>
            <h1 className="text-2xl font-bold text-white">
              My Scouting Reports
            </h1>
            <p className="text-sm text-gray-400">
              Every scouting report you have submitted, newest first.
              Captains are recommended to clear reports at the start of each
              season so older data does not affect AI insights.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isCaptain ? (
              <form action={deleteAllScoutingReports as unknown as (formData: FormData) => void}>
                <ConfirmButton
                  type="submit"
                  title="Delete all scouting reports?"
                  description="This permanently deletes every scouting entry submitted by your team. This cannot be undone."
                  confirmLabel="Delete all reports"
                  cancelLabel="Cancel"
                  tone="danger"
                  className="rounded-lg border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-300 transition hover:border-red-400/60 hover:bg-red-500/10"
                >
                  Delete all reports
                </ConfirmButton>
              </form>
            ) : (
              <button
                type="button"
                disabled
                className="rounded-lg border border-red-500/20 px-3 py-2 text-sm font-semibold text-red-300/50 opacity-60"
                title="Only captains can delete all reports."
              >
                Delete all reports
              </button>
            )}
            <Link href="/dashboard" className="back-button">
              Back to dashboard
            </Link>
          </div>
        </div>

        {!reports || reports.length === 0 ? (
          <div className="rounded-2xl border border-dashed dashboard-panel p-8 text-center text-sm text-gray-400">
            No scouting reports yet. Scout a match to see your history here.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => {
              const match = Array.isArray(report.matches)
                ? report.matches[0]
                : report.matches;
              const event = match
                ? Array.isArray(match.events)
                  ? match.events[0]
                  : match.events
                : null;
              const eventTitle = event?.year
                ? `${event.year} ${event.name}`
                : event?.name ?? "Event";
              const profileEntry = Array.isArray(report.profiles)
                ? report.profiles[0]
                : report.profiles;
              const scouterName = profileEntry?.display_name ?? "Teammate";
              const matchLabel =
                match?.comp_level && match?.match_number
                  ? compLabel(
                      match.comp_level,
                      match.match_number,
                      match.set_number
                    )
                  : "Match";
              return (
                <div
                  key={report.id}
                  className="rounded-2xl dashboard-panel dashboard-card p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest text-teal-400">
                        {eventTitle}
                      </p>
                      <h2 className="text-lg font-semibold text-white">
                        Team {report.team_number}
                      </h2>
                      <p className="text-xs text-gray-400">
                        {matchLabel} &middot; {formatDate(report.created_at)}
                      </p>
                      <p className="mt-1 text-xs text-gray-400">
                        Scouted by {scouterName}
                      </p>
                    </div>
                    <form action={deleteScoutingReport as unknown as (formData: FormData) => void}>
                      <input type="hidden" name="reportId" value={report.id} />
                      <ConfirmButton
                        type="submit"
                        title="Delete this report?"
                        description="This removes the scouting report from your team history. This cannot be undone."
                        confirmLabel="Delete report"
                        cancelLabel="Cancel"
                        tone="danger"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-sm text-gray-300 transition hover:border-red-400/60 hover:text-red-200 hover:bg-red-500/10"
                        aria-label="Delete report"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6V4h8v2" />
                          <path d="M19 6l-1 14H6L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </ConfirmButton>
                    </form>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                    <div className="rounded-lg bg-white/5 p-3 text-center">
                      <p className="text-xs text-gray-400">Auto</p>
                      <p className="text-sm font-semibold text-white">
                        {report.auto_score}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3 text-center">
                      <p className="text-xs text-gray-400">Teleop</p>
                      <p className="text-sm font-semibold text-white">
                        {report.teleop_score}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3 text-center">
                      <p className="text-xs text-gray-400">Endgame</p>
                      <p className="text-sm font-semibold text-white">
                        {report.endgame_score}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3 text-center">
                      <p className="text-xs text-gray-400">Defense</p>
                      <p className="text-sm text-yellow-400">
                        {starDisplay(report.defense_rating)}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3 text-center">
                      <p className="text-xs text-gray-400">Reliable</p>
                      <p className="text-sm text-yellow-400">
                        {starDisplay(report.reliability_rating)}
                      </p>
                    </div>
                  </div>

                  {report.notes && (
                    <p className="mt-3 rounded-lg bg-white/5 p-3 text-sm text-gray-200">
                      {report.notes}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/scout/${report.match_id}/${report.team_number}`}
                      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-teal-300 dashboard-chip"
                    >
                      Review entry
                    </Link>
                    {event?.tba_key && (
                      <Link
                        href={`/dashboard/events/${event.tba_key}`}
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold text-gray-200 dashboard-chip"
                      >
                        Open event
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

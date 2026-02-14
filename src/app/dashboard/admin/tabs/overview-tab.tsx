"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  resetAllTeamAiCooldowns,
  updateEventSyncMinYear,
  updateScoutingAbilityQuestions,
  updateTeamAiPromptLimits,
} from "@/lib/staff-actions";
import { Button } from "@/components/ui/button";
import { StaggerGroup, StaggerChild } from "@/components/ui/animate-in";
import { TEAM_AI_WINDOW_MS } from "@/lib/rate-limit";

interface OverviewTabProps {
  stats: {
    organizations: number;
    users: number;
    entries: number;
    matches: number;
    events: number;
  };
  eventSyncMinYear: number;
  scoutingAbilityQuestions: string[];
  teamAiPromptLimits: {
    free: number;
    supporter: number;
  };
}

export function OverviewTab({
  stats,
  eventSyncMinYear,
  scoutingAbilityQuestions,
  teamAiPromptLimits,
}: OverviewTabProps) {
  const router = useRouter();
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [questions, setQuestions] = useState<string[]>(
    scoutingAbilityQuestions.length > 0 ? scoutingAbilityQuestions : [""]
  );
  const [freeLimit, setFreeLimit] = useState(teamAiPromptLimits.free);
  const [supporterLimit, setSupporterLimit] = useState(teamAiPromptLimits.supporter);
  const aiWindowHours = Math.round(TEAM_AI_WINDOW_MS / (60 * 60 * 1000));

  async function handleUpdateEventWindow(formData: FormData) {
    const result = await updateEventSyncMinYear(formData);
    if (result?.error) {
      setStatus(result.error);
      return;
    }
    setStatus("Event sync window updated.");
    startTransition(() => router.refresh());
  }

  async function handleSaveScoutingQuestions() {
    const normalized = questions
      .map((question) => question.trim().replace(/\s+/g, " "))
      .filter((question) => question.length > 0);

    const formData = new FormData();
    formData.set("questionsJson", JSON.stringify(normalized));

    const result = await updateScoutingAbilityQuestions(formData);
    if (result?.error) {
      setStatus(result.error);
      return;
    }

    setStatus("Scouting list updated.");
    startTransition(() => router.refresh());
  }

  async function handleSaveAiLimits() {
    const formData = new FormData();
    formData.set("freeAiLimit", String(freeLimit));
    formData.set("supporterAiLimit", String(supporterLimit));

    const result = await updateTeamAiPromptLimits(formData);
    if ("error" in result) {
      setStatus(result.error ?? "Failed to update AI prompt limits.");
      return;
    }

    setStatus("AI prompt limits updated.");
    startTransition(() => router.refresh());
  }

  async function handleResetAllAiCooldowns() {
    if (!window.confirm("Reset AI cooldowns for all teams now?")) {
      return;
    }

    const result = await resetAllTeamAiCooldowns();
    if ("error" in result) {
      setStatus(result.error ?? "Failed to reset AI cooldowns.");
      return;
    }

    setStatus(
      `Reset AI cooldowns for ${result.deleted} team bucket${
        result.deleted === 1 ? "" : "s"
      } (${result.backend}).`
    );
    startTransition(() => router.refresh());
  }

  const cards = [
    {
      label: "Organizations",
      value: stats.organizations,
      sub: "Registered teams",
      color: "text-teal-400",
      bg: "bg-teal-500/10",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      ),
    },
    {
      label: "Users",
      value: stats.users,
      sub: "Profiles created",
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      ),
    },
    {
      label: "Scouting Entries",
      value: stats.entries,
      sub: "Total submissions",
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      ),
    },
    {
      label: "Matches",
      value: stats.matches,
      sub: "Synced matches",
      color: "text-green-400",
      bg: "bg-green-500/10",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      ),
    },
    {
      label: "Events",
      value: stats.events,
      sub: "Synced events",
      color: "text-teal-400",
      bg: "bg-teal-500/10",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Platform Overview</h2>
          <p className="text-sm text-gray-400">Key metrics at a glance.</p>
        </div>
      </div>
      <StaggerGroup className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((s) => (
          <StaggerChild key={s.label}>
            <div className="rounded-2xl dashboard-panel dashboard-card p-5">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.bg} ${s.color}`}>
                  {s.icon}
                </div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{s.label}</p>
              </div>
              <p className={`mt-3 text-3xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
              <p className="mt-0.5 text-xs text-gray-400">{s.sub}</p>
            </div>
          </StaggerChild>
        ))}
      </StaggerGroup>

      <div className="mt-6 rounded-2xl dashboard-panel dashboard-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h18v18H3z"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Event Sync Window</h3>
            <p className="mt-1 text-sm text-gray-400">
              Teams can sync events from January 1 of the selected year up to today.
            </p>
          </div>
        </div>
        <form action={handleUpdateEventWindow} className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="eventSyncMinYear" className="block text-xs font-medium text-gray-400">
              Earliest year
            </label>
            <input
              id="eventSyncMinYear"
              name="eventSyncMinYear"
              type="number"
              min={1992}
              defaultValue={eventSyncMinYear}
              className="dashboard-input mt-1 w-36 px-3 py-2 text-sm"
              required
            />
          </div>
          <Button type="submit" size="md" loading={isPending}>
            Save window
          </Button>
        </form>
        <p className="mt-2 text-xs text-gray-500">
          Current window: {eventSyncMinYear}-01-01 to today.
        </p>
        {status && (
          <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-300">
            {status}
          </p>
        )}
      </div>

      <div className="mt-6 rounded-2xl dashboard-panel dashboard-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2v20" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H7" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Team AI Prompt Limits</h3>
            <p className="mt-1 text-sm text-gray-400">
              Set shared prompt caps per plan for each {aiWindowHours}-hour window.
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium text-gray-400">Free plan limit</span>
            <input
              type="number"
              min={1}
              max={50}
              value={freeLimit}
              onChange={(e) =>
                setFreeLimit(Math.max(1, Math.min(50, Number(e.target.value) || 1)))
              }
              className="dashboard-input mt-1 w-full px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-400">Supporter plan limit</span>
            <input
              type="number"
              min={1}
              max={50}
              value={supporterLimit}
              onChange={(e) =>
                setSupporterLimit(
                  Math.max(1, Math.min(50, Number(e.target.value) || 1))
                )
              }
              className="dashboard-input mt-1 w-full px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            size="sm"
            loading={isPending}
            onClick={handleSaveAiLimits}
          >
            Save AI limits
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={isPending}
            onClick={handleResetAllAiCooldowns}
          >
            Reset all cooldowns
          </Button>
          <p className="text-xs text-gray-500">
            Applies team-wide to strategy chat, pick list, and team/match briefs.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl dashboard-panel dashboard-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 11h6" />
              <path d="M9 15h6" />
              <path d="M5 7h14" />
              <path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
            </svg>
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Scouting List Builder</h3>
            <p className="mt-1 text-sm text-gray-400">
              Add yes/no ability questions shown on every scouting form.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {questions.map((question, index) => (
            <div key={`question-${index}`} className="flex items-center gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) =>
                  setQuestions((prev) =>
                    prev.map((item, itemIndex) =>
                      itemIndex === index ? e.target.value : item
                    )
                  )
                }
                placeholder="e.g. Can cross the charge station?"
                className="dashboard-input w-full px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  setQuestions((prev) =>
                    prev.length <= 1
                      ? [""]
                      : prev.filter((_, itemIndex) => itemIndex !== index)
                  )
                }
                className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setQuestions((prev) => [...prev, ""])}
          >
            Add question
          </Button>
          <Button
            type="button"
            size="sm"
            loading={isPending}
            onClick={handleSaveScoutingQuestions}
          >
            Save scouting list
          </Button>
          <p className="text-xs text-gray-500">
            These render as Yes/No ability toggles on scout forms.
          </p>
        </div>
      </div>
    </div>
  );
}

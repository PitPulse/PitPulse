"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/components/toast";
import {
  formatRateLimitUsageMessage,
  readRateLimitSnapshot,
  resolveRateLimitMessage,
} from "@/lib/rate-limit-ui";
import type { ScoutingFormConfig, FormOptionItem } from "@/lib/platform-settings";
import { usePickListLoading } from "./picklist-content";

type TeamProfile = {
  autoStartPositions: string[];
  shootingRanges: string[];
  intakeAbilities: string[];
  cycleTimeRating: number;
  reliabilityRating: number;
  preferredRole: "scorer" | "defender" | "support" | "versatile";
  notes: string;
};

const defaultTeamProfile: TeamProfile = {
  autoStartPositions: [],
  shootingRanges: [],
  intakeAbilities: [],
  cycleTimeRating: 3,
  reliabilityRating: 3,
  preferredRole: "versatile",
  notes: "",
};

function clampStar(value: number): number {
  return Math.max(1, Math.min(5, Math.round(value)));
}

function StarRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-300">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={`${label}-${star}`}
            type="button"
            onClick={() => onChange(star)}
            className="text-xl transition hover:scale-105"
          >
            <span className={star <= value ? "text-yellow-300" : "text-gray-600"}>
              ★
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function GeneratePickListButton({
  eventId,
  label = "Generate Pick List",
  showDataHint = true,
  requireTeamProfile = false,
  formConfig,
  compact = false,
}: {
  eventId: string;
  label?: string;
  showDataHint?: boolean;
  requireTeamProfile?: boolean;
  formConfig?: ScoutingFormConfig;
  /** Use a smaller, subtler button style for tight spaces (e.g. draft room header). */
  compact?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [teamProfile, setTeamProfile] = useState<TeamProfile>(defaultTeamProfile);
  const pickListLoading = usePickListLoading();
  const storageKey = useMemo(
    () => `scoutai:picklist-team-profile:v1:${eventId}`,
    [eventId]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  // Build valid-key sets from config for filtering cached values
  const startPosSet = useMemo(
    () => new Set(formConfig?.autoStartPositions ?? ["left", "center", "right"]),
    [formConfig]
  );
  const shootingKeySet = useMemo(
    () => new Set((formConfig?.shootingRangeOptions ?? [{ key: "close" }, { key: "mid" }, { key: "long" }]).map((o) => o.key)),
    [formConfig]
  );
  const intakeKeySet = useMemo(
    () => new Set((formConfig?.intakeOptions ?? [{ key: "depot" }, { key: "human_intake" }]).map((o) => o.key)),
    [formConfig]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TeamProfile> | null;
      if (!parsed) return;
      const legacyShootingRange = (parsed as { shootingRange?: unknown }).shootingRange;
      setTeamProfile({
        autoStartPositions: Array.isArray(parsed.autoStartPositions)
          ? parsed.autoStartPositions.filter((v): v is string => typeof v === "string" && startPosSet.has(v))
          : [],
        shootingRanges: Array.isArray(parsed.shootingRanges)
          ? parsed.shootingRanges.filter((v): v is string => typeof v === "string" && shootingKeySet.has(v))
          : typeof legacyShootingRange === "string" && shootingKeySet.has(legacyShootingRange)
          ? [legacyShootingRange]
          : [],
        intakeAbilities: Array.isArray(parsed.intakeAbilities)
          ? Array.from(new Set(parsed.intakeAbilities.filter((v): v is string => typeof v === "string" && intakeKeySet.has(v))))
          : [],
        cycleTimeRating: clampStar(Number(parsed.cycleTimeRating ?? 3)),
        reliabilityRating: clampStar(Number(parsed.reliabilityRating ?? 3)),
        preferredRole:
          parsed.preferredRole === "scorer" ||
          parsed.preferredRole === "defender" ||
          parsed.preferredRole === "support" ||
          parsed.preferredRole === "versatile"
            ? parsed.preferredRole
            : "versatile",
        notes: typeof parsed.notes === "string" ? parsed.notes : "",
      });
    } catch {
      // Ignore malformed cache.
    }
  }, [storageKey, startPosSet, shootingKeySet, intakeKeySet]);

  function updateTeamProfile(next: TeamProfile) {
    setTeamProfile(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Ignore local storage failures.
    }
  }

  async function handleGenerate(profile: TeamProfile | null = null) {
    setLoading(true);
    pickListLoading.setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/strategy/picklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          teamProfile: profile,
        }),
      });
      const usage = readRateLimitSnapshot(res.headers);
      if (usage) {
        toast(formatRateLimitUsageMessage(usage, "ai"), "info");
      }

      const responseText = await res.text();
      let data: Record<string, unknown> | null = null;
      if (responseText) {
        try {
          data = JSON.parse(responseText) as Record<string, unknown>;
        } catch {
          data = null;
        }
      }

      if (!res.ok || data?.success !== true) {
        const fallbackError =
          typeof data?.error === "string" && data.error.trim().length > 0
            ? data.error
            : responseText.trim().length > 0
            ? responseText.trim().slice(0, 180)
            : `Request failed (${res.status})`;
        setError(
          resolveRateLimitMessage(
            res.status,
            fallbackError,
            "ai"
          )
        );
        setLoading(false);
        pickListLoading.setLoading(false);
        return;
      }

      setShowProfileModal(false);
      // Keep skeleton visible until the router finishes fetching new server data.
      await router.refresh();
      toast("Pick list generated successfully!", "success");
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
    pickListLoading.setLoading(false);
  }

  function toggleArrayItem(field: "autoStartPositions" | "shootingRanges" | "intakeAbilities", value: string) {
    const arr = teamProfile[field];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    updateTeamProfile({ ...teamProfile, [field]: next });
  }

  // Resolved option arrays from config (with fallback defaults)
  const startPositionOptions = formConfig?.autoStartPositions ?? ["left", "center", "right"];
  const shootingRangeOptions: FormOptionItem[] = formConfig?.shootingRangeOptions ?? [
    { key: "close", label: "Close" },
    { key: "mid", label: "Mid" },
    { key: "long", label: "Long" },
  ];
  const intakeAbilityOptions: FormOptionItem[] = formConfig?.intakeOptions ?? [
    { key: "depot", label: "Ground" },
    { key: "human_intake", label: "Human Player" },
  ];

  return (
    <div>
      <button
        onClick={() => {
          if (requireTeamProfile) {
            setShowProfileModal(true);
            return;
          }
          void handleGenerate(null);
        }}
        disabled={loading}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            : "dashboard-action dashboard-action-primary dashboard-action-holo min-h-10 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-65"
        }
      >
        {loading ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <span className={`rounded-full bg-white/90 [animation:ping_1.05s_ease-in-out_infinite] ${compact ? "h-1.5 w-1.5" : "h-2 w-2"}`} />
              <span className={`rounded-full bg-white/75 [animation:ping_1.05s_ease-in-out_120ms_infinite] ${compact ? "h-1.5 w-1.5" : "h-2 w-2"}`} />
              <span className={`rounded-full bg-white/55 [animation:ping_1.05s_ease-in-out_240ms_infinite] ${compact ? "h-1.5 w-1.5" : "h-2 w-2"}`} />
            </span>
            {compact ? "Generating..." : "Generating best pick list"}
          </>
        ) : (
          <>
            {compact && (
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            )}
            {label}
          </>
        )}
      </button>
      {showDataHint && (
        <p className="mt-2 text-xs text-gray-400">
          For best suggestions, make sure your team has plenty of scouting data
          logged before generating.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {mounted &&
        createPortal(
          <AnimatePresence>
            {showProfileModal && (
              <motion.div
                className="fixed inset-0 z-[2200] flex items-center justify-center px-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                <motion.div
                  className="fixed inset-0 bg-black/65 backdrop-blur-md"
                  onClick={() => setShowProfileModal(false)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                />
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  initial={{ opacity: 0, y: 18, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 340, damping: 28 }}
                  className="relative w-full max-w-xl rounded-2xl border border-white/15 bg-[#0a1020]/95 p-5 shadow-[0_18px_80px_rgba(0,0,0,0.58)]"
                >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-20 rounded-t-2xl bg-gradient-to-b from-indigo-300/15 to-transparent" />
                <div className="relative flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                      AI Suggestions
                    </p>
                    <h3 className="mt-1 text-lg font-semibold text-white">
                      We need a bit more info about your robot
                    </h3>
                    <p className="mt-1 text-xs text-gray-400">
                      This helps judge alliance synergy more accurately.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
              {startPositionOptions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Auto Starting Positions
                </p>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(startPositionOptions.length, 3)}, minmax(0, 1fr))` }}>
                  {startPositionOptions.map((position) => (
                    <button
                      key={position}
                      type="button"
                      onClick={() => toggleArrayItem("autoStartPositions", position)}
                      className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                        teamProfile.autoStartPositions.includes(position)
                          ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
                          : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      {position}
                    </button>
                  ))}
                </div>
              </div>
              )}

              {shootingRangeOptions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Shooting Range
                </p>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(shootingRangeOptions.length, 3)}, minmax(0, 1fr))` }}>
                  {shootingRangeOptions.map((range) => (
                    <button
                      key={range.key}
                      type="button"
                      onClick={() => toggleArrayItem("shootingRanges", range.key)}
                      className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                        teamProfile.shootingRanges.includes(range.key)
                          ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
                          : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-gray-500">Select all ranges your robot can reliably score from.</p>
              </div>
              )}

              {intakeAbilityOptions.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Intake Abilities
                </p>
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(intakeAbilityOptions.length, 2)}, minmax(0, 1fr))` }}>
                  {intakeAbilityOptions.map((ability) => (
                    <button
                      key={ability.key}
                      type="button"
                      onClick={() => toggleArrayItem("intakeAbilities", ability.key)}
                      className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                        teamProfile.intakeAbilities.includes(ability.key)
                          ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
                          : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      {ability.label}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-gray-500">Select every source your robot can intake from.</p>
              </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <StarRow
                  label="Cycle Time"
                  value={teamProfile.cycleTimeRating}
                  onChange={(value) =>
                    updateTeamProfile({ ...teamProfile, cycleTimeRating: value })
                  }
                />
                <StarRow
                  label="Reliability"
                  value={teamProfile.reliabilityRating}
                  onChange={(value) =>
                    updateTeamProfile({ ...teamProfile, reliabilityRating: value })
                  }
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Preferred Role
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["scorer", "defender", "support", "versatile"] as const).map(
                    (role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() =>
                          updateTeamProfile({
                            ...teamProfile,
                            preferredRole: role,
                          })
                        }
                        className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                          teamProfile.preferredRole === role
                            ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
                            : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                        }`}
                      >
                        {role}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Notes
                </p>
                <textarea
                  value={teamProfile.notes}
                  onChange={(event) =>
                    updateTeamProfile({
                      ...teamProfile,
                      notes: event.target.value.slice(0, 400),
                    })
                  }
                  rows={3}
                  placeholder="Short notes about your robot's strengths or limits..."
                  className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:outline-none"
                />
              </div>
            </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-400">
                    Saved locally for this event.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProfileModal(false);
                      void handleGenerate(teamProfile);
                    }}
                    disabled={loading}
                    className="dashboard-action dashboard-action-primary dashboard-action-holo px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {loading ? (
                      <>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-white/90 [animation:ping_1.05s_ease-in-out_infinite]" />
                          <span className="h-2 w-2 rounded-full bg-white/75 [animation:ping_1.05s_ease-in-out_120ms_infinite]" />
                          <span className="h-2 w-2 rounded-full bg-white/55 [animation:ping_1.05s_ease-in-out_240ms_infinite]" />
                        </span>
                        Generating...
                      </>
                    ) : (
                      "Generate AI Suggestions"
                    )}
                  </button>
                </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
}

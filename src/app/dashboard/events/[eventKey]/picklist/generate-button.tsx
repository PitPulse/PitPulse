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

type ShootingRange = "close" | "mid" | "long";
type IntakeAbility = "floor" | "station" | "chute" | "shelf";

type TeamProfile = {
  autoStartPositions: Array<"left" | "center" | "right">;
  shootingRanges: ShootingRange[];
  intakeAbilities: IntakeAbility[];
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

const SHOOTING_RANGE_OPTIONS: Array<{ key: ShootingRange; label: string }> = [
  { key: "close", label: "Close" },
  { key: "mid", label: "Mid" },
  { key: "long", label: "Long" },
];

const INTAKE_ABILITY_OPTIONS: Array<{ key: IntakeAbility; label: string }> = [
  { key: "floor", label: "Floor / Ground" },
  { key: "station", label: "Station Feed" },
  { key: "chute", label: "Chute Feed" },
  { key: "shelf", label: "Shelf / Source" },
];

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
}: {
  eventId: string;
  label?: string;
  showDataHint?: boolean;
  requireTeamProfile?: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [teamProfile, setTeamProfile] = useState<TeamProfile>(defaultTeamProfile);
  const storageKey = useMemo(
    () => `scoutai:picklist-team-profile:v1:${eventId}`,
    [eventId]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

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
          ? parsed.autoStartPositions.filter(
              (value): value is "left" | "center" | "right" =>
                value === "left" || value === "center" || value === "right"
            )
          : [],
        shootingRanges: Array.isArray(parsed.shootingRanges)
          ? parsed.shootingRanges.filter(
              (value): value is ShootingRange =>
                value === "close" || value === "mid" || value === "long"
            )
          : legacyShootingRange === "close" ||
            legacyShootingRange === "mid" ||
            legacyShootingRange === "long"
          ? [legacyShootingRange]
          : [],
        intakeAbilities: Array.isArray(parsed.intakeAbilities)
          ? parsed.intakeAbilities.filter(
              (value): value is IntakeAbility =>
                value === "floor" ||
                value === "station" ||
                value === "chute" ||
                value === "shelf"
            )
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
  }, [storageKey]);

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

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(
          resolveRateLimitMessage(
            res.status,
            data.error ?? "Failed to generate pick list",
            "ai"
          )
        );
        return;
      }

      setShowProfileModal(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function toggleStartPosition(position: "left" | "center" | "right") {
    const hasPosition = teamProfile.autoStartPositions.includes(position);
    const next = hasPosition
      ? teamProfile.autoStartPositions.filter((value) => value !== position)
      : [...teamProfile.autoStartPositions, position];
    updateTeamProfile({ ...teamProfile, autoStartPositions: next });
  }

  function toggleShootingRange(range: ShootingRange) {
    const hasRange = teamProfile.shootingRanges.includes(range);
    const next = hasRange
      ? teamProfile.shootingRanges.filter((value) => value !== range)
      : [...teamProfile.shootingRanges, range];
    updateTeamProfile({ ...teamProfile, shootingRanges: next });
  }

  function toggleIntakeAbility(ability: IntakeAbility) {
    const hasAbility = teamProfile.intakeAbilities.includes(ability);
    const next = hasAbility
      ? teamProfile.intakeAbilities.filter((value) => value !== ability)
      : [...teamProfile.intakeAbilities, ability];
    updateTeamProfile({ ...teamProfile, intakeAbilities: next });
  }

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
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-300/35 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(139,92,246,0.35)] transition duration-200 hover:-translate-y-0.5 hover:from-fuchsia-500 hover:via-purple-500 hover:to-indigo-500 hover:shadow-[0_14px_34px_rgba(139,92,246,0.45)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
        )}
        {loading ? "Generating Pick List..." : label}
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
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Auto Starting Positions
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(["left", "center", "right"] as const).map((position) => (
                    <button
                      key={position}
                      type="button"
                      onClick={() => toggleStartPosition(position)}
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

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Shooting Range
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SHOOTING_RANGE_OPTIONS.map((range) => (
                    <button
                      key={range.key}
                      type="button"
                      onClick={() => toggleShootingRange(range.key)}
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

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Intake Abilities
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {INTAKE_ABILITY_OPTIONS.map((ability) => (
                    <button
                      key={ability.key}
                      type="button"
                      onClick={() => toggleIntakeAbility(ability.key)}
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
                <p className="mt-1.5 text-[11px] text-gray-500">Select every game piece source your robot can intake from.</p>
              </div>

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
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-300/35 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(139,92,246,0.35)] transition duration-200 hover:-translate-y-0.5 hover:from-fuchsia-500 hover:via-purple-500 hover:to-indigo-500 hover:shadow-[0_14px_34px_rgba(139,92,246,0.45)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
                    )}
                    {loading ? "Generating..." : "Generate AI Suggestions"}
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveRateLimitMessage } from "@/lib/rate-limit-ui";

type TeamProfile = {
  autoStartPositions: Array<"left" | "center" | "right">;
  shootingRange: "close" | "mid" | "long" | null;
  cycleTimeRating: number;
  reliabilityRating: number;
  preferredRole: "scorer" | "defender" | "support" | "versatile";
  notes: string;
};

const defaultTeamProfile: TeamProfile = {
  autoStartPositions: [],
  shootingRange: null,
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
}: {
  eventId: string;
  label?: string;
  showDataHint?: boolean;
  requireTeamProfile?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [teamProfile, setTeamProfile] = useState<TeamProfile>(defaultTeamProfile);
  const storageKey = useMemo(
    () => `scoutai:picklist-team-profile:v1:${eventId}`,
    [eventId]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TeamProfile> | null;
      if (!parsed) return;
      setTeamProfile({
        autoStartPositions: Array.isArray(parsed.autoStartPositions)
          ? parsed.autoStartPositions.filter(
              (value): value is "left" | "center" | "right" =>
                value === "left" || value === "center" || value === "right"
            )
          : [],
        shootingRange:
          parsed.shootingRange === "close" ||
          parsed.shootingRange === "mid" ||
          parsed.shootingRange === "long"
            ? parsed.shootingRange
            : null,
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

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(
          resolveRateLimitMessage(
            res.status,
            data.error ?? "Failed to generate pick list"
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
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-500 disabled:opacity-50"
      >
        {loading && (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
        )}
        {loading ? "Generating... (this may take a moment)" : label}
      </button>
      {showDataHint && (
        <p className="mt-2 text-xs text-gray-400">
          For best suggestions, make sure your team has plenty of scouting data
          logged before generating.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {showProfileModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowProfileModal(false)}
          />
          <div className="relative z-[1101] w-full max-w-xl rounded-2xl dashboard-panel p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                  AI Suggestions
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  We need a bit more info about your robot
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  This helps Claude judge alliance synergy more accurately.
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
                  {([
                    { key: "close", label: "Close" },
                    { key: "mid", label: "Mid" },
                    { key: "long", label: "Long" },
                  ] as const).map((range) => (
                    <button
                      key={range.key}
                      type="button"
                      onClick={() =>
                        updateTeamProfile({
                          ...teamProfile,
                          shootingRange: range.key,
                        })
                      }
                      className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                        teamProfile.shootingRange === range.key
                          ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
                          : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
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
                onClick={() => void handleGenerate(teamProfile)}
                disabled={loading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-purple-500 disabled:opacity-50"
              >
                {loading ? "Generating..." : "Generate AI Suggestions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

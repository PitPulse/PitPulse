"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { useToast } from "@/components/toast";
import type { BriefContent } from "@/types/strategy";
import {
  formatRateLimitUsageMessage,
  readRateLimitSnapshot,
  resolveRateLimitMessage,
} from "@/lib/rate-limit-ui";
import {
  isEpaOnlyScoutingInsight,
  stripEpaOnlyScoutingPrefix,
} from "@/lib/brief-scouting-insights";

interface MatchBriefOverlayButtonProps {
  matchId: string;
  eventTitle?: string | null;
  matchLabel: string;
  redTeams: number[];
  blueTeams: number[];
  hasBrief: boolean;
  hasScore: boolean;
}

export function MatchBriefOverlayButton({
  matchId,
  eventTitle,
  matchLabel,
  redTeams,
  blueTeams,
  hasBrief,
  hasScore,
}: MatchBriefOverlayButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [brief, setBrief] = useState<BriefContent | null>(null);
  const [hasBriefState, setHasBriefState] = useState(hasBrief);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [freshlyGenerated, setFreshlyGenerated] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  async function loadExistingBrief() {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/strategy/brief?matchId=${encodeURIComponent(matchId)}`);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) {
          setBrief(null);
          return;
        }
        throw new Error(data.error || "Failed to load brief");
      }

      setBrief((data.brief as BriefContent) ?? null);
      setGeneratedAt(typeof data.createdAt === "string" ? data.createdAt : null);
      setHasBriefState(Boolean(data.brief));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load brief");
    } finally {
      setFetching(false);
    }
  }

  async function generateBrief() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/strategy/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId }),
      });
      const usage = readRateLimitSnapshot(res.headers);
      if (usage) {
        toast(formatRateLimitUsageMessage(usage, "ai"), "info");
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          resolveRateLimitMessage(
            res.status,
            data.error || "Failed to generate brief",
            "ai"
          )
        );
      }

      setBrief(data.brief as BriefContent);
      setGeneratedAt(new Date().toISOString());
      setHasBriefState(true);
      setFreshlyGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate brief");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
    if (hasBriefState && !brief && !fetching) {
      void loadExistingBrief();
    }
  }

  const buttonLabel = useMemo(() => {
    if (hasBriefState) return "View Brief";
    return hasScore ? "Generate Brief" : "Pre-Match Brief";
  }, [hasBriefState, hasScore]);

  const scoutingPriorities = useMemo(
    () =>
      brief?.scoutingPriorities ?? {
        teamsNeedingCoverage: [],
        scoutActions: [],
      },
    [brief]
  );
  const noScoutingTeams = useMemo(
    () =>
      brief?.teamAnalysis
        .filter((team) => isEpaOnlyScoutingInsight(team.scoutingInsights))
        .map((team) => team.teamNumber) ?? [],
    [brief]
  );

  const portalRoot = typeof document !== "undefined" ? document.body : null;

  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.div
            className="relative z-[1001] w-full max-w-4xl rounded-2xl dashboard-panel p-5 shadow-2xl"
            initial={{ opacity: 0, y: 18, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                  {eventTitle ?? "Event"}
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  {matchLabel} — {hasScore ? "Match Brief (Reference)" : "Pre-Match Brief"}
                </h3>
                <div className="mt-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                      hasScore
                        ? "border border-amber-300/35 bg-amber-400/10 text-amber-100"
                        : "border border-cyan-300/35 bg-cyan-400/10 text-cyan-100"
                    }`}
                  >
                    {hasScore ? "Reference Mode" : "Pre-Match Mode"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
              >
                Close
              </button>
            </div>

            {hasScore && (
              <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                This match already has a score. Brief generation is in reference mode and does not use final score as input.
              </div>
            )}

            {(fetching || loading) && (
              <div className="mt-4 rounded-xl border border-cyan-300/25 bg-cyan-500/10 px-4 py-4">
                <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {fetching ? "Loading brief..." : "Generating AI brief..."}
                </div>
                <div className="mt-3 space-y-2">
                  <div className="h-2.5 w-11/12 animate-pulse rounded bg-white/10" />
                  <div className="h-2.5 w-10/12 animate-pulse rounded bg-white/10 [animation-delay:120ms]" />
                  <div className="h-2.5 w-8/12 animate-pulse rounded bg-white/10 [animation-delay:220ms]" />
                </div>
              </div>
            )}

            {!fetching && !loading && !brief && (
              <div className="mt-4 rounded-2xl border border-cyan-300/25 bg-gradient-to-br from-cyan-500/10 via-cyan-400/5 to-transparent p-6">
                <div className="flex items-center gap-2 text-cyan-100">
                  <Sparkles className="h-4 w-4" />
                  <p className="text-sm font-semibold">
                    {hasScore ? "Reference brief ready" : "Pre-match brief ready"}
                  </p>
                </div>
                <p className="mt-2 text-sm text-gray-300">
                  {hasScore
                    ? "This match is complete, but you can still generate a strategy reference brief."
                    : "Build a one-page strategy brief with EPA signal and your team’s scouting notes."}
                </p>
                <div className="mt-3 grid gap-2 text-xs text-gray-300 sm:grid-cols-3">
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Prediction + confidence</div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Alliance strengths/risks</div>
                  <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">Actionable match plan</div>
                </div>
                <button
                  type="button"
                  onClick={() => void generateBrief()}
                  className="mt-4 dashboard-action dashboard-action-holo px-4 py-2 text-sm"
                >
                  {hasScore ? "Generate reference brief" : "Generate pre-match brief"}
                </button>
              </div>
            )}

            {!fetching && !loading && brief && (
              <div className="mt-4 max-h-[72vh] space-y-5 overflow-y-auto pr-1">
                <motion.div
                  className="rounded-2xl dashboard-panel p-5"
                  {...(freshlyGenerated ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: 0.05 } } : {})}
                >
                  <h4 className="mb-3 text-base font-semibold text-white">Match Prediction</h4>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-center">
                      <p className="text-xs font-medium text-red-300">Red Alliance</p>
                      <p className="text-3xl font-bold text-red-200">{brief.prediction.redScore}</p>
                      <p className="text-xs text-gray-400">{redTeams.join(", ")}</p>
                    </div>
                    <div className="text-center">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                          brief.prediction.winner === "red"
                            ? "bg-red-500/20 text-red-200"
                            : "bg-blue-500/20 text-blue-200"
                        }`}
                      >
                        {brief.prediction.winner === "red" ? "Red" : "Blue"} favored
                      </span>
                      <p className="mt-1 text-xs text-gray-400">
                        {brief.prediction.confidence} confidence
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-blue-300">Blue Alliance</p>
                      <p className="text-3xl font-bold text-blue-200">{brief.prediction.blueScore}</p>
                      <p className="text-xs text-gray-400">{blueTeams.join(", ")}</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="grid gap-4 md:grid-cols-2"
                  {...(freshlyGenerated ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: 0.15 } } : {})}
                >
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                    <h5 className="mb-2 text-sm font-semibold text-red-200">Red Alliance</h5>
                    <p className="mb-2 text-xs text-gray-200">
                      Total EPA: <span className="font-semibold">{brief.redAlliance.totalEPA.toFixed(1)}</span>
                    </p>
                    <p className="text-xs font-medium text-green-300">Strengths</p>
                    <ul className="mt-1 space-y-1 text-sm text-gray-200">
                      {brief.redAlliance.strengths.map((item, index) => (
                        <li key={`red-strength-${index}`}>• {item}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs font-medium text-red-300">Weaknesses</p>
                    <ul className="mt-1 space-y-1 text-sm text-gray-200">
                      {brief.redAlliance.weaknesses.map((item, index) => (
                        <li key={`red-weakness-${index}`}>• {item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4">
                    <h5 className="mb-2 text-sm font-semibold text-blue-200">Blue Alliance</h5>
                    <p className="mb-2 text-xs text-gray-200">
                      Total EPA: <span className="font-semibold">{brief.blueAlliance.totalEPA.toFixed(1)}</span>
                    </p>
                    <p className="text-xs font-medium text-green-300">Strengths</p>
                    <ul className="mt-1 space-y-1 text-sm text-gray-200">
                      {brief.blueAlliance.strengths.map((item, index) => (
                        <li key={`blue-strength-${index}`}>• {item}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs font-medium text-red-300">Weaknesses</p>
                    <ul className="mt-1 space-y-1 text-sm text-gray-200">
                      {brief.blueAlliance.weaknesses.map((item, index) => (
                        <li key={`blue-weakness-${index}`}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </motion.div>

                <motion.div
                  className="rounded-2xl dashboard-panel p-5"
                  {...(freshlyGenerated ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: 0.25 } } : {})}
                >
                  <h4 className="mb-3 text-base font-semibold text-white">Team Analysis</h4>
                  {noScoutingTeams.length > 0 && (
                    <div className="mb-3 rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                      {noScoutingTeams.length === 1
                        ? `No scouting data available for Team ${noScoutingTeams[0]}; Analysis is based on EPA only for them.`
                        : `No scouting data available for Teams ${noScoutingTeams.join(", ")}; Analysis is based on EPA only for them.`}
                    </div>
                  )}
                  <div className="space-y-3">
                    {brief.teamAnalysis.map((team) => (
                      <div
                        key={team.teamNumber}
                        className={`rounded-xl border p-3 ${
                          team.alliance === "red"
                            ? "border-red-500/30 bg-red-500/10"
                            : "border-blue-500/30 bg-blue-500/10"
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">
                              Team {team.teamNumber}
                            </span>
                            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-200">
                              {team.role}
                            </span>
                          </div>
                          <span className="text-xs text-gray-300">
                            EPA: {team.epaBreakdown.total.toFixed(1)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-200">
                          {stripEpaOnlyScoutingPrefix(team.scoutingInsights) ||
                            "EPA-only analysis currently available for this team."}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div
                  className="rounded-2xl dashboard-panel p-5"
                  {...(freshlyGenerated ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: 0.35 } } : {})}
                >
                  <h4 className="mb-3 text-base font-semibold text-white">Scout Focus</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-amber-200">Teams Needing Coverage</p>
                      {scoutingPriorities.teamsNeedingCoverage.length > 0 ? (
                        <ul className="space-y-2 text-sm text-gray-200">
                          {scoutingPriorities.teamsNeedingCoverage.map((item, index) => (
                            <li key={`${item.teamNumber}-${index}`}>
                              <span>• Team {item.teamNumber} ({item.alliance}, {item.priority}): {item.reason}</span>
                              {item.focus && (
                                <p className="ml-4 mt-0.5 text-gray-400">↳ Focus: {item.focus}</p>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400">
                          No urgent scouting gaps flagged for this match.
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-cyan-200">Scout Actions</p>
                      {scoutingPriorities.scoutActions.length > 0 ? (
                        <ul className="space-y-1 text-sm text-gray-200">
                          {scoutingPriorities.scoutActions.map((item, index) => (
                            <li key={`scout-action-${index}`}>• {item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-400">
                          No additional scout action items provided.
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className="rounded-2xl dashboard-panel p-5"
                  {...(freshlyGenerated ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: 0.45 } } : {})}
                >
                  <h4 className="mb-3 text-base font-semibold text-white">Strategy Recommendations</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-semibold text-red-200">For Red Alliance</p>
                      <ul className="space-y-1 text-sm text-gray-200">
                        {brief.strategy.redRecommendations.map((item, index) => (
                          <li key={`red-rec-${index}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold text-blue-200">For Blue Alliance</p>
                      <ul className="space-y-1 text-sm text-gray-200">
                        {brief.strategy.blueRecommendations.map((item, index) => (
                          <li key={`blue-rec-${index}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {brief.strategy.keyMatchups.length > 0 && (
                    <div className="mt-4 border-t border-white/10 pt-3">
                      <p className="mb-1 text-xs font-semibold text-gray-200">Key Matchups</p>
                      <ul className="space-y-1 text-sm text-gray-300">
                        {brief.strategy.keyMatchups.map((item, index) => (
                          <li key={`key-matchup-${index}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              {brief && (
                <button
                  type="button"
                  onClick={() => void generateBrief()}
                  disabled={loading || fetching}
                  className="dashboard-action dashboard-action-holo px-4 py-2 text-sm disabled:pointer-events-none disabled:opacity-50"
                >
                  {(loading || fetching) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {loading
                    ? "Generating brief..."
                    : hasScore
                    ? "Regenerate reference brief"
                    : "Regenerate pre-match brief"}
                </button>
              )}
              {generatedAt && (
                <p className="text-xs text-gray-400">
                  Generated {new Date(generatedAt).toLocaleString()}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition ${
          hasBriefState
            ? "border border-cyan-300/30 bg-cyan-400/20 text-cyan-100 hover:bg-cyan-400/30"
            : "border border-white/10 bg-white/5 text-gray-300 hover:border-cyan-300/35 hover:bg-cyan-400/15 hover:text-cyan-100"
        }`}
      >
        <Sparkles className="h-3 w-3" />
        {buttonLabel}
      </button>
      {portalRoot && createPortal(modal, portalRoot)}
    </>
  );
}

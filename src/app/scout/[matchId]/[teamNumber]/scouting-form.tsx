"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CounterButton } from "@/components/counter-button";
import { StarRating } from "@/components/star-rating";
import { saveOffline, getPendingCount } from "@/lib/offline-queue";
import {
  saveDraft,
  getDraft,
  removeDraft,
  buildDraftKey,
  DRAFT_SCHEMA_VERSION,
  type DraftFormData,
} from "@/lib/offline-drafts";
import type { Tables } from "@/types/supabase";

const INTAKE_OPTIONS = [
  { key: "depot", label: "Ground Intake" },
  { key: "human_intake", label: "Human Intake" },
] as const;

type IntakeMethod = (typeof INTAKE_OPTIONS)[number]["key"];
type ShootingRange = "close" | "mid" | "long";
type ClimbLevel = "level_1" | "level_2" | "level_3";

const CLIMB_LEVEL_OPTIONS = [
  { key: "level_1", label: "Level 1" },
  { key: "level_2", label: "Level 2" },
  { key: "level_3", label: "Level 3" },
] as const;

interface ScoutingFormProps {
  matchId: string;
  teamNumber: number;
  orgId: string;
  userId: string;
  eventKey?: string | null;
  abilityQuestions: string[];
  existing: Tables<"scouting_entries"> | null;
}

function parseAbilityAnswers(
  value: Tables<"scouting_entries">["ability_answers"] | null | undefined
): Record<string, boolean> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const parsed: Record<string, boolean> = {};
  for (const [key, answer] of Object.entries(value as Record<string, unknown>)) {
    if (typeof key !== "string") continue;
    if (typeof answer !== "boolean") continue;
    parsed[key] = answer;
  }

  return parsed;
}

function parseIntakeMethods(
  value: Tables<"scouting_entries">["intake_methods"] | null | undefined
): IntakeMethod[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<IntakeMethod>(INTAKE_OPTIONS.map((option) => option.key));
  return Array.from(
    new Set(
      value.filter(
        (item): item is IntakeMethod =>
          typeof item === "string" && allowed.has(item as IntakeMethod)
      )
    )
  );
}

function parseShootingRanges(
  rangesValue:
    | Tables<"scouting_entries">["shooting_ranges"]
    | null
    | undefined,
  singleValue: Tables<"scouting_entries">["shooting_range"] | null | undefined
): ShootingRange[] {
  const allowed = new Set<ShootingRange>(["close", "mid", "long"]);

  if (Array.isArray(rangesValue)) {
    const ranges = Array.from(
      new Set(
        rangesValue.filter(
          (item): item is ShootingRange =>
            typeof item === "string" && allowed.has(item as ShootingRange)
        )
      )
    );
    if (ranges.length > 0) {
      return ranges;
    }
  }

  if (
    singleValue === "close" ||
    singleValue === "mid" ||
    singleValue === "long"
  ) {
    return [singleValue];
  }

  return [];
}

function parseClimbLevels(
  levelsValue:
    | Tables<"scouting_entries">["climb_levels"]
    | null
    | undefined,
  singleValue: Tables<"scouting_entries">["endgame_state"] | null | undefined
): ClimbLevel[] {
  const allowed = new Set<ClimbLevel>(["level_1", "level_2", "level_3"]);

  if (Array.isArray(levelsValue)) {
    const levels = Array.from(
      new Set(
        levelsValue.filter(
          (item): item is ClimbLevel =>
            typeof item === "string" && allowed.has(item as ClimbLevel)
        )
      )
    );
    if (levels.length > 0) {
      return levels;
    }
  }

  if (
    singleValue === "level_1" ||
    singleValue === "level_2" ||
    singleValue === "level_3"
  ) {
    return [singleValue];
  }

  return [];
}


function stripUnsupportedScoutingColumns<T extends Record<string, unknown>>(
  payload: T,
  errorMessage: string
) {
  const next = { ...payload } as Record<string, unknown>;
  const msg = errorMessage.toLowerCase();

  if (msg.includes("ability_answers")) {
    delete next.ability_answers;
  }

  if (msg.includes("intake_methods")) {
    delete next.intake_methods;
  }

  if (msg.includes("shooting_ranges")) {
    delete next.shooting_ranges;
  }

  if (msg.includes("climb_levels")) {
    delete next.climb_levels;
  }

  return next as T;
}

export function ScoutingForm({
  matchId,
  teamNumber,
  orgId,
  userId,
  eventKey,
  abilityQuestions,
  existing,
}: ScoutingFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [autoScore, setAutoScore] = useState(existing?.auto_score ?? 0);
  const [autoStartPosition, setAutoStartPosition] = useState<
    "left" | "center" | "right" | null
  >(() => {
    const value = existing?.auto_start_position;
    return value === "left" || value === "center" || value === "right"
      ? value
      : null;
  });
  const [shootingRanges, setShootingRanges] = useState<ShootingRange[]>(() =>
    parseShootingRanges(existing?.shooting_ranges, existing?.shooting_range)
  );
  const [shootingReliability, setShootingReliability] = useState(
    existing?.shooting_reliability ?? 3
  );
  const [autoNotes, setAutoNotes] = useState(existing?.auto_notes ?? "");
  const [teleopScore, setTeleopScore] = useState(existing?.teleop_score ?? 0);
  const [intakeMethods, setIntakeMethods] = useState<IntakeMethod[]>(() =>
    parseIntakeMethods(existing?.intake_methods)
  );
  const [endgameScore, setEndgameScore] = useState(
    existing?.endgame_score ?? 0
  );
  const [climbLevels, setClimbLevels] = useState<ClimbLevel[]>(() =>
    parseClimbLevels(existing?.climb_levels, existing?.endgame_state)
  );
  const [defenseRating, setDefenseRating] = useState(
    existing?.defense_rating ?? 3
  );
  const [cycleTimeRating, setCycleTimeRating] = useState(
    existing?.cycle_time_rating ?? 3
  );
  const [reliabilityRating, setReliabilityRating] = useState(
    existing?.reliability_rating ?? 3
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [abilityAnswers, setAbilityAnswers] = useState<
    Record<string, boolean | null>
  >(() => {
    const existingAnswers = parseAbilityAnswers(existing?.ability_answers);
    const initial: Record<string, boolean | null> = {};
    for (const question of abilityQuestions) {
      initial[question] =
        typeof existingAnswers[question] === "boolean"
          ? existingAnswers[question]
          : null;
    }
    return initial;
  });

  const autoRef = useRef<HTMLDivElement | null>(null);
  const teleopRef = useRef<HTMLDivElement | null>(null);
  const endgameRef = useRef<HTMLDivElement | null>(null);
  const ratingsRef = useRef<HTMLDivElement | null>(null);
  const abilitiesRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<HTMLDivElement | null>(null);

  // ── Draft auto-save / restore ──────────────────────────────────
  const draftKey = useMemo(
    () => buildDraftKey(eventKey, matchId, teamNumber, userId),
    [eventKey, matchId, teamNumber, userId]
  );

  // Restore draft on mount (only if there's no server-side existing entry)
  useEffect(() => {
    if (existing) return; // Server data takes precedence
    let cancelled = false;
    void getDraft(draftKey).then((draft) => {
      if (cancelled || !draft) return;
      const d = draft.form_data;
      setAutoScore(d.auto_score);
      setAutoStartPosition(
        d.auto_start_position === "left" ||
          d.auto_start_position === "center" ||
          d.auto_start_position === "right"
          ? d.auto_start_position
          : null
      );
      setAutoNotes(d.auto_notes);
      setShootingRanges(d.shooting_ranges as ShootingRange[]);
      setShootingReliability(d.shooting_reliability);
      setTeleopScore(d.teleop_score);
      setIntakeMethods(d.intake_methods as IntakeMethod[]);
      setEndgameScore(d.endgame_score);
      setClimbLevels(d.climb_levels as ClimbLevel[]);
      setDefenseRating(d.defense_rating);
      setCycleTimeRating(d.cycle_time_rating);
      setReliabilityRating(d.reliability_rating);
      setNotes(d.notes);
      if (d.ability_answers) {
        setAbilityAnswers(d.ability_answers);
      }
      setDraftRestored(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, existing]);

  // Auto-dismiss "Draft restored" banner after 6 seconds
  useEffect(() => {
    if (!draftRestored) return;
    const timer = setTimeout(() => setDraftRestored(false), 6000);
    return () => clearTimeout(timer);
  }, [draftRestored]);

  // Auto-save draft every 5 seconds (debounced via timeout)
  // Skip the initial mount — only save once user has actually changed something
  const draftMountedRef = useRef(false);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!draftMountedRef.current) {
      draftMountedRef.current = true;
      return;
    }
    // Don't save drafts after successful submission
    if (submitted) return;

    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      const formData: DraftFormData = {
        auto_score: autoScore,
        auto_start_position: autoStartPosition,
        auto_notes: autoNotes,
        shooting_ranges: shootingRanges,
        shooting_reliability: shootingReliability,
        teleop_score: teleopScore,
        intake_methods: intakeMethods,
        endgame_score: endgameScore,
        climb_levels: climbLevels,
        defense_rating: defenseRating,
        cycle_time_rating: cycleTimeRating,
        reliability_rating: reliabilityRating,
        ability_answers: abilityAnswers,
        notes,
      };
      void saveDraft({
        id: draftKey,
        event_key: eventKey ?? "none",
        match_id: matchId,
        team_number: teamNumber,
        user_id: userId,
        form_data: formData,
        _schema: DRAFT_SCHEMA_VERSION,
        _savedAt: new Date().toISOString(),
      });
    }, 5000);

    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [
    autoScore,
    autoStartPosition,
    autoNotes,
    shootingRanges,
    shootingReliability,
    teleopScore,
    intakeMethods,
    endgameScore,
    climbLevels,
    defenseRating,
    cycleTimeRating,
    reliabilityRating,
    abilityAnswers,
    notes,
    submitted,
    draftKey,
    eventKey,
    matchId,
    teamNumber,
    userId,
  ]);

  const steps = useMemo(
    () => {
      const base = [
        { label: "Auto", progressLabel: "Auto", ref: autoRef },
        { label: "Teleop", progressLabel: "Teleop", ref: teleopRef },
        { label: "Endgame", progressLabel: "Endgame", ref: endgameRef },
        { label: "Ratings", progressLabel: "Ratings", ref: ratingsRef },
      ];

      if (abilityQuestions.length > 0) {
        base.push({ label: "Abilities", progressLabel: "Ability", ref: abilitiesRef });
      }

      base.push({ label: "Notes", progressLabel: "Notes", ref: notesRef });
      return base;
    },
    [abilityQuestions.length]
  );

  const abilityAnswersPayload = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(abilityAnswers).filter(
          (entry): entry is [string, boolean] => typeof entry[1] === "boolean"
        )
      ),
    [abilityAnswers]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    let frame: number | null = null;
    const updateActiveStep = () => {
      const marker = window.innerHeight * 0.28;
      let nextStep = 0;

      steps.forEach((step, index) => {
        const section = step.ref.current;
        if (!section) return;
        const rect = section.getBoundingClientRect();
        if (rect.top <= marker) nextStep = index;
      });

      setActiveStep((prev) => (prev === nextStep ? prev : nextStep));
    };

    const onViewportChange = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(updateActiveStep);
    };

    updateActiveStep();
    window.addEventListener("scroll", onViewportChange, { passive: true });
    window.addEventListener("resize", onViewportChange);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onViewportChange);
      window.removeEventListener("resize", onViewportChange);
    };
  }, [steps]);

  const entryData = {
    match_id: matchId,
    team_number: teamNumber,
    auto_score: autoScore,
    auto_start_position: autoStartPosition,
    shooting_reliability: shootingReliability,
    auto_notes: autoNotes.trim() || null,
    teleop_score: teleopScore,
    intake_methods: intakeMethods.length > 0 ? intakeMethods : null,
    endgame_score: endgameScore,
    climb_levels: climbLevels.length > 0 ? climbLevels : null,
    endgame_state: climbLevels[0] ?? null,
    defense_rating: defenseRating,
    cycle_time_rating: cycleTimeRating,
    reliability_rating: reliabilityRating,
    shooting_ranges: shootingRanges.length > 0 ? shootingRanges : null,
    shooting_range: shootingRanges[0] ?? null,
    ability_answers: abilityAnswersPayload,
    notes: notes.trim(),
  };

  async function handleSubmit() {
    setLoading(true);
    setError(null);

    const entry = {
      ...entryData,
      org_id: orgId,
      scouted_by: userId,
    };

    try {
      let payload = { ...entry };
      let attempts = 0;

      while (attempts < 5) {
        const result = await supabase
          .from("scouting_entries")
          .upsert(payload, {
            onConflict: "match_id,team_number,scouted_by",
          });

        if (!result.error) {
          break;
        }

        const nextPayload = stripUnsupportedScoutingColumns(
          payload,
          result.error.message
        );
        const changed =
          Object.keys(nextPayload).length < Object.keys(payload).length;
        if (!changed) {
          throw new Error(result.error.message);
        }

        payload = nextPayload;
        attempts += 1;
      }

      // Submitted online successfully — clear draft since server confirmed
      void removeDraft(draftKey);
      setSubmitted(true);
      setSavedOffline(false);
      setLoading(false);
      setTimeout(() => {
        if (eventKey) {
          router.push(`/dashboard/events/${eventKey}/matches?updated=1`);
          router.refresh();
        } else {
          router.back();
        }
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save.";
      const lowerMessage = message.toLowerCase();
      const shouldSaveOffline =
        typeof navigator !== "undefined" &&
        (!navigator.onLine ||
          lowerMessage.includes("fetch") ||
          lowerMessage.includes("network") ||
          lowerMessage.includes("timeout"));

      if (!shouldSaveOffline) {
        setError(message);
        setLoading(false);
        return;
      }

      // Network issue (offline/timeout) — save to IndexedDB
      try {
        await saveOffline({
          id: `${matchId}-${teamNumber}-${userId}`,
          ...entry,
          created_at: new Date().toISOString(),
        });
        const count = await getPendingCount();
        setPendingCount(count);
        setSubmitted(true);
        setSavedOffline(true);
        setLoading(false);
      } catch {
        setError("Failed to save. Please try again.");
        setLoading(false);
      }
    }
  }

  if (submitted) {
    return (
      <div className="space-y-4 pb-8">
        <div
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border p-8 backdrop-blur-sm ${
            savedOffline
              ? "border-teal-400/30 bg-teal-500/10"
              : "border-emerald-400/30 bg-emerald-500/10"
          }`}
        >
          <div className="text-4xl">{savedOffline ? "📱" : "✓"}</div>
          <p
            className={`text-lg font-semibold ${
              savedOffline ? "text-teal-200" : "text-emerald-200"
            }`}
          >
            {savedOffline
              ? "Saved Offline"
              : existing
              ? "Entry Updated!"
              : "Entry Submitted!"}
          </p>
          {savedOffline && (
            <>
              <p className="text-sm text-teal-200/80 text-center">
                Your entry is saved on this device and will sync automatically
                when you reconnect.
              </p>
              <p className="text-xs text-teal-200/70">
                {pendingCount} {pendingCount === 1 ? "entry" : "entries"} queued
              </p>
            </>
          )}
          {!savedOffline && (
            <p className="text-sm text-emerald-200/80">Returning to match list...</p>
          )}
        </div>

        {savedOffline && (
          <div className="rounded-xl border border-teal-400/30 bg-teal-500/10 p-4 text-sm text-teal-200">
            Offline mode is active. You can keep scouting and we&apos;ll sync your
            entries when the connection returns. Some pages (like the dashboard)
            won&apos;t load until you&apos;re back online.
          </div>
        )}

        {savedOffline && (
          <button
            onClick={() => router.back()}
            className="back-button back-button-block back-button-lg"
          >
            Back to Matches
          </button>
        )}
      </div>
    );
  }

  return (
      <div className="space-y-6 overflow-x-hidden pb-8">
      {error && (
        <div role="alert" className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {draftRestored && (
        <div className="flex items-center justify-between rounded-md border border-teal-400/30 bg-teal-500/10 p-3 text-sm text-teal-200">
          <span>Draft restored from a previous session</span>
          <button
            type="button"
            onClick={() => setDraftRestored(false)}
            className="ml-2 text-xs text-teal-300/70 hover:text-teal-200"
            aria-label="Dismiss draft restored notice"
          >
            ✕
          </button>
        </div>
      )}

      <nav
        aria-label="Scouting form progress"
        className="sticky top-2 z-20 scout-panel p-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">
            Progress
          </p>
          <p className="text-xs text-gray-400" aria-live="polite">
            Step {activeStep + 1} of {steps.length}
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={activeStep + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={`Scouting progress: step ${activeStep + 1} of ${steps.length}, ${steps[activeStep]?.label ?? ""}`}
          className="mt-3 grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
          }}
        >
          {steps.map((step, index) => (
            <button
              key={step.label}
              type="button"
              aria-label={`Go to ${step.label} section${index <= activeStep ? " (completed)" : ""}`}
              onClick={() =>
                step.ref.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              className="min-w-0 min-h-[44px] text-center"
            >
              <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                <span
                  className={`block h-full rounded-full bg-cyan-400 transition-all duration-500 ease-out ${
                    index <= activeStep ? "w-full" : "w-0"
                  }`}
                />
              </span>
              <span
                className={`mt-1 block truncate text-[11px] font-medium uppercase tracking-[0.1em] transition-colors duration-300 sm:text-xs ${
                  index === activeStep ? "text-cyan-200" : "text-gray-400"
                }`}
              >
                {step.progressLabel}
              </span>
            </button>
          ))}
        </div>
      </nav>

      {/* Auto Section */}
      <section
        ref={autoRef}
        onTouchStart={() => setActiveStep(0)}
        onMouseDown={() => setActiveStep(0)}
        className="scout-panel p-4"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-300">
          Autonomous
        </h2>
          <div className="space-y-4">
          <div className="flex flex-wrap items-end justify-center gap-6">
            <CounterButton label="Points" value={autoScore} onChange={setAutoScore} />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Starting Route
            </p>
            <div className="grid grid-cols-3 gap-2">
              {(["left", "center", "right"] as const).map((route) => (
                <button
                  key={route}
                  type="button"
                  onClick={() => setAutoStartPosition(route)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    autoStartPosition === route
                      ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
                      : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {route}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="auto-comments" className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Auto Comments
            </label>
            <textarea
              id="auto-comments"
              value={autoNotes}
              onChange={(e) => setAutoNotes(e.target.value)}
              placeholder="Route success, misses, timing notes..."
              rows={3}
              className="w-full px-3 py-2 text-sm text-white shadow-sm placeholder:text-gray-500 scout-input"
            />
          </div>
        </div>
      </section>

      {/* Teleop Section */}
      <section
        ref={teleopRef}
        onTouchStart={() => setActiveStep(1)}
        onMouseDown={() => setActiveStep(1)}
        className="scout-panel p-4"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-300">
          Teleop
        </h2>
        <div className="flex flex-wrap items-end justify-center gap-6">
          <CounterButton
            label="Points"
            value={teleopScore}
            onChange={setTeleopScore}
          />
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Intake Method
          </p>
          <p className="text-[11px] text-gray-500">Multi-select</p>
          <div className="grid grid-cols-2 gap-2">
            {INTAKE_OPTIONS.map((option) => {
              const active = intakeMethods.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() =>
                    setIntakeMethods((prev) =>
                      prev.includes(option.key)
                        ? prev.filter((item) => item !== option.key)
                        : [...prev, option.key]
                    )
                  }
                  className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    active
                      ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
                      : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Endgame Section */}
      <section
        ref={endgameRef}
        onTouchStart={() => setActiveStep(2)}
        onMouseDown={() => setActiveStep(2)}
        className="scout-panel p-4"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-purple-300">
          Endgame
        </h2>
        <div className="flex flex-wrap items-end justify-center gap-6">
          <CounterButton
            label="Points"
            value={endgameScore}
            onChange={setEndgameScore}
          />
        </div>

        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Climb
          </p>
          <p className="text-[11px] text-gray-500">Multi-select</p>
          <div className="grid grid-cols-3 gap-2">
            {CLIMB_LEVEL_OPTIONS.map((option) => {
              const active = climbLevels.includes(option.key);
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() =>
                    setClimbLevels((prev) =>
                      prev.includes(option.key)
                        ? prev.filter((item) => item !== option.key)
                        : [...prev, option.key]
                    )
                  }
                  className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    active
                      ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
                      : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Ratings Section */}
      <section
        ref={ratingsRef}
        onTouchStart={() => setActiveStep(3)}
        onMouseDown={() => setActiveStep(3)}
        className="scout-panel p-4"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-teal-300">
          Ratings
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Shooting Range
            </p>
            <p className="text-[11px] text-gray-500">Multi-select</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: "close", label: "Close" },
                { key: "mid", label: "Mid" },
                { key: "long", label: "Long" },
              ] as const).map((range) => (
                <button
                  key={`ratings-${range.key}`}
                  type="button"
                  onClick={() =>
                    setShootingRanges((prev) =>
                      prev.includes(range.key)
                        ? prev.filter((item) => item !== range.key)
                        : [...prev, range.key]
                    )
                  }
                  className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    shootingRanges.includes(range.key)
                      ? "border-cyan-400/70 bg-cyan-500/15 text-cyan-200"
                      : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <StarRating
              label="Defense Ability"
              value={defenseRating}
              onChange={setDefenseRating}
            />
            <StarRating
              label="Cycle Time"
              value={cycleTimeRating}
              onChange={setCycleTimeRating}
            />
            <StarRating
              label="Auto Shooting Reliability"
              value={shootingReliability}
              onChange={setShootingReliability}
            />
            <StarRating
              label="Overall Reliability"
              value={reliabilityRating}
              onChange={setReliabilityRating}
            />
          </div>
        </div>
      </section>

      {abilityQuestions.length > 0 && (
        <section
          ref={abilitiesRef}
          onTouchStart={() => setActiveStep(4)}
          onMouseDown={() => setActiveStep(4)}
          className="scout-panel p-4"
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-300">
            Ability Checks
          </h2>
          <div className="space-y-3">
            {abilityQuestions.map((question) => {
              const answer = abilityAnswers[question] ?? null;
              return (
                <div
                  key={question}
                  className="rounded-md border border-white/10 bg-white/[0.03] p-3"
                >
                  <p className="text-sm font-medium text-slate-200">{question}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setAbilityAnswers((prev) => ({
                          ...prev,
                          [question]: true,
                        }))
                      }
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                        answer === true
                          ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-200"
                          : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAbilityAnswers((prev) => ({
                          ...prev,
                          [question]: false,
                        }))
                      }
                      className={`rounded-md border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                        answer === false
                          ? "border-rose-400/70 bg-rose-500/20 text-rose-200"
                          : "border-white/10 bg-white/5 text-gray-300 hover:bg-white/10"
                      }`}
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setAbilityAnswers((prev) => ({
                          ...prev,
                          [question]: null,
                        }))
                      }
                      className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 transition hover:bg-white/10"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Notes Section */}
      <section
        ref={notesRef}
        onTouchStart={() => setActiveStep(abilityQuestions.length > 0 ? 5 : 4)}
        onMouseDown={() => setActiveStep(abilityQuestions.length > 0 ? 5 : 4)}
        className="scout-panel p-4"
      >
        <label htmlFor="scouting-notes" className="mb-3 block text-sm font-semibold uppercase tracking-wider text-gray-300">
          Notes
        </label>
        <textarea
          id="scouting-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Quick observations..."
          rows={3}
          className="w-full px-3 py-2 text-sm text-white shadow-sm placeholder:text-gray-500 scout-input"
        />
      </section>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full rounded-lg bg-cyan-600 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-cyan-500 active:bg-cyan-700 disabled:opacity-50"
      >
        {loading
          ? "Submitting..."
          : existing
            ? "Update Entry"
            : "Submit Scouting Entry"}
      </button>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CounterButton } from "@/components/counter-button";
import { StarRating } from "@/components/star-rating";
import { saveOffline, getPendingCount } from "@/lib/offline-queue";
import type { Tables } from "@/types/supabase";

interface ScoutingFormProps {
  matchId: string;
  teamNumber: number;
  orgId: string;
  userId: string;
  eventKey?: string | null;
  existing: Tables<"scouting_entries"> | null;
}

export function ScoutingForm({
  matchId,
  teamNumber,
  orgId,
  userId,
  eventKey,
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
  const [shootingRange, setShootingRange] = useState<
    "close" | "mid" | "long" | null
  >(() => {
    const value = existing?.shooting_range;
    return value === "close" || value === "mid" || value === "long"
      ? value
      : null;
  });
  const [shootingReliability, setShootingReliability] = useState(
    existing?.shooting_reliability ?? 3
  );
  const [autoNotes, setAutoNotes] = useState(existing?.auto_notes ?? "");
  const [teleopScore, setTeleopScore] = useState(existing?.teleop_score ?? 0);
  const [endgameScore, setEndgameScore] = useState(
    existing?.endgame_score ?? 0
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
  const [activeStep, setActiveStep] = useState(0);

  const autoRef = useRef<HTMLDivElement | null>(null);
  const teleopRef = useRef<HTMLDivElement | null>(null);
  const endgameRef = useRef<HTMLDivElement | null>(null);
  const ratingsRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<HTMLDivElement | null>(null);

  const steps = useMemo(
    () => [
      { label: "Auto", ref: autoRef },
      { label: "Teleop", ref: teleopRef },
      { label: "Endgame", ref: endgameRef },
      { label: "Ratings", ref: ratingsRef },
      { label: "Notes", ref: notesRef },
    ],
    []
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
    shooting_range: shootingRange,
    shooting_reliability: shootingReliability,
    auto_notes: autoNotes.trim() || null,
    teleop_score: teleopScore,
    endgame_score: endgameScore,
    defense_rating: defenseRating,
    cycle_time_rating: cycleTimeRating,
    reliability_rating: reliabilityRating,
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
      const result = await supabase
        .from("scouting_entries")
        .upsert(entry, { onConflict: "match_id,team_number,scouted_by" });

      if (result.error) {
        throw new Error(result.error.message);
      }

      // Submitted online successfully
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
              ? "border-amber-400/30 bg-amber-500/10"
              : "border-emerald-400/30 bg-emerald-500/10"
          }`}
        >
          <div className="text-4xl">{savedOffline ? "📱" : "✓"}</div>
          <p
            className={`text-lg font-semibold ${
              savedOffline ? "text-amber-200" : "text-emerald-200"
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
              <p className="text-sm text-amber-200/80 text-center">
                Your entry is saved on this device and will sync automatically
                when you reconnect.
              </p>
              <p className="text-xs text-amber-200/70">
                {pendingCount} {pendingCount === 1 ? "entry" : "entries"} queued
              </p>
            </>
          )}
          {!savedOffline && (
            <p className="text-sm text-emerald-200/80">Returning to match list...</p>
          )}
        </div>

        {savedOffline && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-200">
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
      <div className="space-y-6 pb-8">
      {error && (
        <div className="rounded-md border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="sticky top-2 z-20 scout-panel p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">
            Progress
          </p>
          <p className="text-xs text-gray-400">
            Step {activeStep + 1} of {steps.length}
          </p>
        </div>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {steps.map((step, index) => (
            <button
              key={step.label}
              type="button"
              onClick={() =>
                step.ref.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              className="text-left"
            >
              <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
                <span
                  className={`block h-full rounded-full bg-cyan-400 transition-all duration-500 ease-out ${
                    index <= activeStep ? "w-full" : "w-0"
                  }`}
                />
              </span>
              <span
                className={`mt-1 block text-[10px] uppercase tracking-widest transition-colors duration-300 ${
                  index === activeStep ? "text-cyan-200" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Auto Section */}
      <section
        ref={autoRef}
        onTouchStart={() => setActiveStep(0)}
        onMouseDown={() => setActiveStep(0)}
        className="scout-panel p-4"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-300">
          Autonomous
        </h2>
        <div className="space-y-4">
          <div className="flex flex-wrap justify-center gap-6">
            <CounterButton
              label="Points"
              value={autoScore}
              onChange={setAutoScore}
            />
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
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Auto Comments
            </p>
            <textarea
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
        <div className="flex flex-wrap justify-center gap-6">
            <CounterButton
              label="Points"
              value={teleopScore}
              onChange={setTeleopScore}
            />
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
        <div className="flex flex-wrap justify-center gap-6">
          <CounterButton
            label="Endgame Points"
            value={endgameScore}
            onChange={setEndgameScore}
          />
        </div>
      </section>

      {/* Ratings Section */}
      <section
        ref={ratingsRef}
        onTouchStart={() => setActiveStep(3)}
        onMouseDown={() => setActiveStep(3)}
        className="scout-panel p-4"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-300">
          Ratings
        </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
              Shooting Range
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: "close", label: "Close" },
                { key: "mid", label: "Mid" },
                { key: "long", label: "Long" },
              ] as const).map((range) => (
                <button
                  key={`ratings-${range.key}`}
                  type="button"
                  onClick={() => setShootingRange(range.key)}
                  className={`rounded-md border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    shootingRange === range.key
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

      {/* Notes Section */}
      <section
        ref={notesRef}
        onTouchStart={() => setActiveStep(4)}
        onMouseDown={() => setActiveStep(4)}
        className="scout-panel p-4"
      >
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-300">
          Notes
        </h2>
        <textarea
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

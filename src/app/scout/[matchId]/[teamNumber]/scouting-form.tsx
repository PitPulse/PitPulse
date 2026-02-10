"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CounterButton } from "@/components/counter-button";
import { StarRating } from "@/components/star-rating";
import { QRExport } from "@/components/qr-export";
import { saveOffline, getPendingCount } from "@/lib/offline-queue";
import type { Tables } from "@/types/supabase";

interface ScoutingFormProps {
  matchId: string;
  teamNumber: number;
  orgId: string;
  userId: string;
  existing: Tables<"scouting_entries"> | null;
}

export function ScoutingForm({
  matchId,
  teamNumber,
  orgId,
  userId,
  existing,
}: ScoutingFormProps) {
  const router = useRouter();
  const supabase = createClient();

  const [autoScore, setAutoScore] = useState(existing?.auto_score ?? 0);
  const [teleopScore, setTeleopScore] = useState(existing?.teleop_score ?? 0);
  const [endgameScore, setEndgameScore] = useState(
    existing?.endgame_score ?? 0
  );
  const [defenseRating, setDefenseRating] = useState(
    existing?.defense_rating ?? 3
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

  const entryData = {
    match_id: matchId,
    team_number: teamNumber,
    auto_score: autoScore,
    teleop_score: teleopScore,
    endgame_score: endgameScore,
    defense_rating: defenseRating,
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
      let result;
      if (existing) {
        result = await supabase
          .from("scouting_entries")
          .update(entry)
          .eq("id", existing.id);
      } else {
        result = await supabase.from("scouting_entries").insert(entry);
      }

      if (result.error) {
        throw new Error(result.error.message);
      }

      // Submitted online successfully
      setSubmitted(true);
      setSavedOffline(false);
      setLoading(false);
      setTimeout(() => router.back(), 2000);
    } catch {
      // Any network error (offline, timeout, server error) — save to IndexedDB
      // At FRC venues, network is often spotty — catch ALL failures, not just offline
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

        {/* QR Code backup — always available after submit */}
        <QRExport data={entryData} />

        {savedOffline && (
          <button
            onClick={() => router.back()}
            className="w-full rounded-lg bg-white/10 py-3 text-sm font-medium text-gray-200 transition hover:bg-white/20"
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

      {/* Auto Section */}
      <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-blue-300">
          Autonomous
        </h2>
        <div className="flex flex-wrap justify-center gap-6">
          <CounterButton
            label="Game Pieces"
            value={autoScore}
            onChange={setAutoScore}
          />
        </div>
      </section>

      {/* Teleop Section */}
      <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-emerald-300">
          Teleop
        </h2>
        <div className="flex flex-wrap justify-center gap-6">
          <CounterButton
            label="Game Pieces"
            value={teleopScore}
            onChange={setTeleopScore}
          />
        </div>
      </section>

      {/* Endgame Section */}
      <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-4 shadow-sm">
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
      <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-amber-300">
          Ratings
        </h2>
        <div className="space-y-4">
          <StarRating
            label="Defense Ability"
            value={defenseRating}
            onChange={setDefenseRating}
          />
          <StarRating
            label="Overall Reliability"
            value={reliabilityRating}
            onChange={setReliabilityRating}
          />
        </div>
      </section>

      {/* Notes Section */}
      <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-300">
          Notes
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Quick observations..."
          rows={3}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </section>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 py-3 text-base font-semibold text-white active:bg-blue-700 disabled:opacity-50"
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

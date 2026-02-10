"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function SyncEventForm() {
  const [eventKey, setEventKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSync() {
    if (!eventKey.trim()) return;

    setLoading(true);
    setError(null);
    setStatus("Syncing event data from TBA...");

    try {
      // Step 1: Sync event, teams, and matches
      const eventRes = await fetch("/api/events/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventKey: eventKey.trim() }),
      });

      const eventData = await eventRes.json();
      if (!eventRes.ok) {
        throw new Error(eventData.error);
      }

      setStatus(
        `Synced ${eventData.event}: ${eventData.teams} teams, ${eventData.matches} matches. Now syncing EPA stats...`
      );

      // Step 2: Sync stats from Statbotics
      const statsRes = await fetch("/api/stats/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventKey: eventKey.trim() }),
      });

      const statsData = await statsRes.json();
      if (!statsRes.ok) {
        throw new Error(statsData.error);
      }

      setStatus(
        `Done! Synced EPA for ${statsData.synced}/${statsData.total} teams.`
      );

      // Redirect to event page after short delay
      setTimeout(() => {
        router.push(`/dashboard/events/${eventKey.trim()}`);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={eventKey}
          onChange={(e) => setEventKey(e.target.value)}
          placeholder="TBA event key (e.g. 2025hiho)"
          className="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white shadow-sm placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          onClick={handleSync}
          disabled={loading || !eventKey.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "Syncing..." : "Sync Event"}
        </button>
      </div>

      {status && (
        <p className="rounded-md bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {status}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

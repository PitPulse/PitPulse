"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  getPendingEntries,
  removePendingEntry,
  getPendingCount,
} from "@/lib/offline-queue";

export function OnlineStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncErrors, setSyncErrors] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [offlineHidden, setOfflineHidden] = useState(false);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {
      // IndexedDB may not be available
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setOfflineHidden(false);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const initialTimer = setTimeout(() => {
      void refreshCount();
    }, 0);
    const interval = setInterval(() => {
      void refreshCount();
    }, 5000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [refreshCount]);

  const syncPendingEntries = useCallback(async () => {
    setSyncing(true);
    setSyncErrors(0);
    const supabase = createClient();
    const entries = await getPendingEntries();
    const total = entries.length;
    setSyncProgress({ current: 0, total });

    let errors = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const { id: _id, ...data } = entry;
      void _id;
      const { error } = await supabase
        .from("scouting_entries")
        .upsert(data, { onConflict: "match_id,team_number,scouted_by" });
      if (!error) {
        await removePendingEntry(entry.id);
      } else {
        errors++;
      }
      setSyncProgress({ current: i + 1, total });
    }

    setSyncErrors(errors);
    if (errors === 0 && total > 0) {
      setLastSyncTime(new Date());
    }
    await refreshCount();
    setSyncing(false);
  }, [refreshCount]);

  // Auto-sync when coming back online or when new pending entries appear
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !syncing) {
      const timer = setTimeout(() => {
        void syncPendingEntries();
      }, 0);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOnline, pendingCount, syncing, syncPendingEntries]);

  // Hidden when online with nothing pending and no errors
  if (isOnline && pendingCount === 0 && syncErrors === 0) return null;

  // Hidden when user dismissed offline banner
  if (!isOnline && offlineHidden) return null;

  return (
    <div
      className={`fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-colors duration-300 ${
        !isOnline
          ? "bg-yellow-500 text-yellow-900"
          : syncErrors > 0
          ? "bg-red-600 text-white"
          : "bg-green-600 text-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              !isOnline
                ? "bg-yellow-800"
                : syncErrors > 0
                ? "bg-red-300"
                : "animate-pulse bg-green-300"
            }`}
          />
          <span>
            {!isOnline
              ? "Offline"
              : syncing
              ? `Syncing ${syncProgress.current}/${syncProgress.total}...`
              : syncErrors > 0
              ? `${syncErrors} failed to sync`
              : "Online"}
            {pendingCount > 0 && !syncing && ` — ${pendingCount} queued`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOnline && (pendingCount > 0 || syncErrors > 0) && (
            <button
              onClick={syncPendingEntries}
              disabled={syncing}
              className="rounded bg-white/20 px-2 py-0.5 text-xs hover:bg-white/30 disabled:opacity-50"
            >
              {syncing ? "..." : syncErrors > 0 ? "Retry" : "Sync Now"}
            </button>
          )}
          {syncErrors > 0 && !syncing && (
            <button
              onClick={() => setSyncErrors(0)}
              className="text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          )}
          {!isOnline && (
            <button
              onClick={() => setOfflineHidden(true)}
              className="text-xs opacity-70 hover:opacity-100"
              aria-label="Hide offline banner"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!isOnline && (
        <p className="mt-2 text-xs text-yellow-900/80">
          If you&apos;ve already loaded match pages, you can still scout without reloading.
          Your entries will sync automatically when you&apos;re back online.
        </p>
      )}

      {/* Sync progress bar */}
      {syncing && syncProgress.total > 0 && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white/60 transition-all duration-300"
            style={{
              width: `${(syncProgress.current / syncProgress.total) * 100}%`,
            }}
          />
        </div>
      )}

      {/* Last sync time */}
      {lastSyncTime && !syncing && pendingCount === 0 && syncErrors === 0 && (
        <p className="mt-1 text-xs opacity-70">
          Last synced {lastSyncTime.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
}

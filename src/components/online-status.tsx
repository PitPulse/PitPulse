"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/toast";
import {
  getPendingEntries,
  removePendingEntry,
  getPendingCount,
  updateEntryStatus,
} from "@/lib/offline-queue";
import { removeDraft, buildDraftKey } from "@/lib/offline-drafts";
import {
  autoCleanup,
  checkStorageQuota,
  downloadQueuedEntries,
} from "@/lib/offline-cleanup";

const OFFLINE_BANNER_DISMISS_KEY = "pitpilot:offline-banner-dismissed";
const ONLINE_BANNER_DISMISS_KEY = "pitpilot:online-sync-banner-dismissed";
const CONNECTIVITY_POLL_MS = 10000;

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

function readDismissed(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function setDismissed(key: string, dismissed: boolean) {
  if (typeof window === "undefined") return;
  try {
    if (dismissed) {
      window.sessionStorage.setItem(key, "1");
    } else {
      window.sessionStorage.removeItem(key);
    }
  } catch {
    // Ignore storage failures (private mode / blocked storage)
  }
}

export function OnlineStatus() {
  const { toast } = useToast();
  const probeVersion = useRef(0);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [syncErrors, setSyncErrors] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [offlineHidden, setOfflineHidden] = useState(() =>
    readDismissed(OFFLINE_BANNER_DISMISS_KEY)
  );
  const [onlineHidden, setOnlineHidden] = useState(() =>
    readDismissed(ONLINE_BANNER_DISMISS_KEY)
  );

  const probeConnectivity = useCallback(async () => {
    if (typeof window === "undefined") return;

    const version = ++probeVersion.current;
    const browserOnline = navigator.onLine;
    if (browserOnline) {
      if (version === probeVersion.current) {
        setIsOnline(true);
      }
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(`/api/health?_t=${Date.now()}`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      // If app health endpoint responds, treat as online even if navigator state is stale.
      if (res.ok) {
        if (version === probeVersion.current) {
          setIsOnline(true);
        }
        return;
      }
    } catch {
      // Ignore and fall back to browser connectivity signal.
    } finally {
      window.clearTimeout(timer);
    }

    if (version === probeVersion.current) {
      setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    }
  }, []);

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
      setOnlineHidden(false);
      setDismissed(OFFLINE_BANNER_DISMISS_KEY, false);
      setDismissed(ONLINE_BANNER_DISMISS_KEY, false);
      void probeConnectivity();
    };
    const handleOffline = () => {
      void probeConnectivity();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const initialTimer = window.setTimeout(() => {
      setIsOnline(navigator.onLine);
      void refreshCount();
      void probeConnectivity();
    }, 0);
    const interval = window.setInterval(() => {
      void refreshCount();
      void probeConnectivity();
    }, CONNECTIVITY_POLL_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [probeConnectivity, refreshCount]);

  // Run auto-cleanup on mount (prune old cached data + check storage quota)
  useEffect(() => {
    void autoCleanup().catch(() => {});
    void checkStorageQuota().then((estimate) => {
      if (estimate?.isNearFull) {
        toast(
          `Storage is ${Math.round(estimate.percentUsed)}% full — consider clearing old event data`,
          "info"
        );
      }
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const syncPendingEntries = useCallback(async () => {
    setSyncing(true);
    setSyncErrors(0);
    const supabase = createClient();
    const entries = await getPendingEntries();
    const total = entries.length;
    setSyncProgress({ current: 0, total });

    let errors = 0;
    let synced = 0;
    let deferred = 0;
    const now = new Date().toISOString();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const failedAttempts = entry._failedAttempts ?? 0;

      // Exponential backoff: skip entries that failed recently
      // Backoff: 30s, 60s, 120s, 240s, 480s (caps at 5 failures → 8 min)
      if (failedAttempts > 0 && entry._lastAttemptAt) {
        const backoffMs =
          Math.min(30000 * Math.pow(2, failedAttempts - 1), 480000);
        const lastAttempt = new Date(entry._lastAttemptAt).getTime();
        if (Date.now() - lastAttempt < backoffMs) {
          // Skip this entry — not ready for retry yet
          setSyncProgress({ current: i + 1, total });
          deferred++;
          continue;
        }
      }

      // Mark as syncing
      await updateEntryStatus(entry.id, { _syncStatus: "syncing" });

      const {
        id: _id,
        _syncStatus: _s,
        _failedAttempts: _f,
        _lastAttemptAt: _l,
        _schema: _sch,
        ...data
      } = entry;
      void _id;
      void _s;
      void _f;
      void _l;
      void _sch;

      let payload = { ...data };
      let error: { message: string } | null = null;
      let attempts = 0;

      while (attempts < 5) {
        const result = await supabase
          .from("scouting_entries")
          .upsert(payload, { onConflict: "match_id,team_number,scouted_by" });

        if (!result.error) {
          error = null;
          break;
        }

        const nextPayload = stripUnsupportedScoutingColumns(
          payload,
          result.error.message
        );
        const changed =
          Object.keys(nextPayload).length < Object.keys(payload).length;

        if (!changed) {
          error = { message: result.error.message };
          break;
        }

        payload = nextPayload;
        attempts += 1;
        error = { message: result.error.message };
      }

      if (!error) {
        await removePendingEntry(entry.id);
        synced++;

        // Clear draft for this entry (confirmed server sync)
        try {
          const draftId = buildDraftKey(
            null, // We don't have eventKey here; try common pattern
            entry.match_id,
            entry.team_number,
            entry.scouted_by
          );
          void removeDraft(draftId);
        } catch {
          // Best effort — draft key may not match exactly
        }
      } else {
        // Mark as failed with incremented attempt counter
        await updateEntryStatus(entry.id, {
          _syncStatus: "failed",
          _failedAttempts: failedAttempts + 1,
          _lastAttemptAt: now,
        });
        errors++;
      }
      setSyncProgress({ current: i + 1, total });
    }

    setSyncErrors(errors + deferred);
    if (errors === 0 && deferred === 0 && total > 0) {
      setLastSyncTime(new Date());
    }
    const remaining = await getPendingCount().catch(() => null);
    if (typeof remaining === "number") {
      setPendingCount(remaining);
      if (errors === 0 && deferred === 0 && remaining === 0) {
        setOnlineHidden(false);
        setDismissed(ONLINE_BANNER_DISMISS_KEY, false);
      }
    } else {
      await refreshCount();
    }
    setSyncing(false);

    // Aggregated toast notifications (only for entries we actually attempted)
    const attempted = synced + errors;
    if (attempted > 0) {
      if (synced > 0 && errors === 0) {
        toast(
          `${synced} ${synced === 1 ? "entry" : "entries"} synced successfully`,
          "success"
        );
      } else if (synced > 0 && errors > 0) {
        toast(
          `${synced} synced, ${errors} failed — will retry automatically`,
          "info"
        );
      } else if (errors > 0 && synced === 0) {
        toast(
          `${errors} ${errors === 1 ? "entry" : "entries"} failed to sync`,
          "error"
        );
      }
    }
  }, [refreshCount, toast]);

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
  if (isOnline && onlineHidden) return null;

  // Hide offline banner when nothing is pending/errored, unless user has
  // previously synced this session (then they'll want the stale-data hint).
  if (!isOnline && pendingCount === 0 && syncErrors === 0 && !lastSyncTime)
    return null;

  // Hidden when user dismissed offline banner
  if (!isOnline && offlineHidden) return null;

  return (
    <div
      className={`pointer-events-auto fixed bottom-4 left-4 right-4 z-[40] mx-auto max-w-sm rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-colors duration-300 ${
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
          {isOnline && (
            <button
              onClick={() => {
                setOnlineHidden(true);
                setDismissed(ONLINE_BANNER_DISMISS_KEY, true);
              }}
              className="rounded bg-white/20 px-1.5 py-0.5 text-xs opacity-80 transition hover:opacity-100"
              aria-label="Hide sync banner"
            >
              ✕
            </button>
          )}
          {!isOnline && (
            <button
              onClick={() => {
                setOfflineHidden(true);
                setDismissed(OFFLINE_BANNER_DISMISS_KEY, true);
              }}
              className="rounded bg-white/20 px-1.5 py-0.5 text-xs opacity-80 transition hover:opacity-100"
              aria-label="Hide offline banner"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {!isOnline && (
        <p className="mt-2 text-xs text-yellow-900/80">
          You&apos;re offline — cached data may be stale.
          Your entries will sync automatically when you&apos;re back online.
        </p>
      )}

      {lastSyncTime && !isOnline && (
        <p className="mt-1 text-xs text-yellow-900/60">
          Last synced {lastSyncTime.toLocaleTimeString()}
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

      {/* Export queued entries for manual backup */}
      {pendingCount > 0 && !syncing && (
        <button
          onClick={() => void downloadQueuedEntries()}
          className={`mt-2 w-full rounded px-2 py-1 text-xs transition ${
            !isOnline
              ? "bg-yellow-800/20 hover:bg-yellow-800/30 text-yellow-900"
              : "bg-white/10 hover:bg-white/20"
          }`}
        >
          Export {pendingCount} queued {pendingCount === 1 ? "entry" : "entries"} as JSON
        </button>
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

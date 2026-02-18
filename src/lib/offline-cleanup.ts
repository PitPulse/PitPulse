/**
 * Offline Storage Cleanup & Hygiene
 *
 * - Auto-prune old cached events/drafts
 * - Storage quota warnings
 * - Clear all offline data (for logout / privacy)
 * - Export queued entries as JSON for manual backup
 */

import { clearAllCachedData, pruneOldCachedData } from "./offline-cache";
import { clearAllDrafts, pruneOldDrafts } from "./offline-drafts";
import { clearAllPendingEntries, getPendingEntries } from "./offline-queue";

// ── Clear everything (used on logout for privacy) ──────────────────

export async function clearAllOfflineData(): Promise<void> {
  await Promise.all([
    clearAllCachedData(),
    clearAllDrafts(),
    clearAllPendingEntries(),
  ]);
}

// ── Auto-prune stale data ──────────────────────────────────────────

export async function autoCleanup(): Promise<{
  prunedEvents: number;
  prunedDrafts: number;
}> {
  const [prunedEvents, prunedDrafts] = await Promise.all([
    pruneOldCachedData(30), // Remove cached events older than 30 days
    pruneOldDrafts(14), // Remove drafts older than 14 days
  ]);
  return { prunedEvents, prunedDrafts };
}

// ── Storage quota check ────────────────────────────────────────────

export interface StorageEstimate {
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  isNearFull: boolean;
}

export async function checkStorageQuota(): Promise<StorageEstimate | null> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage?.estimate
  ) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usageBytes = estimate.usage ?? 0;
    const quotaBytes = estimate.quota ?? 0;

    if (quotaBytes === 0) return null;

    const percentUsed = (usageBytes / quotaBytes) * 100;
    return {
      usageBytes,
      quotaBytes,
      percentUsed,
      isNearFull: percentUsed > 80,
    };
  } catch {
    return null;
  }
}

// ── Export queued entries as JSON (manual safety tool) ──────────────

export async function exportQueuedEntries(): Promise<string> {
  const entries = await getPendingEntries();
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      entry_count: entries.length,
      entries: entries.map(
        ({ _syncStatus, _failedAttempts, _lastAttemptAt, _schema, ...data }) => {
          void _syncStatus;
          void _failedAttempts;
          void _lastAttemptAt;
          void _schema;
          return data;
        }
      ),
    },
    null,
    2
  );
}

/**
 * Trigger a browser download of the queued entries JSON.
 * Call from a click handler (user gesture required).
 */
export async function downloadQueuedEntries(): Promise<void> {
  const json = await exportQueuedEntries();
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pitpilot-queued-entries-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

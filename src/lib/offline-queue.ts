import { openDB } from "./offline-db";

const STORE_NAME = "pending-entries";

export interface PendingEntry {
  id: string;
  match_id: string;
  team_number: number;
  org_id: string;
  scouted_by: string;
  auto_score: number;
  auto_start_position?: string | null;
  auto_notes?: string | null;
  shooting_range?: string | null;
  shooting_ranges?: string[] | null;
  shooting_reliability?: number | null;
  teleop_score: number;
  endgame_score: number;
  defense_rating: number;
  cycle_time_rating?: number | null;
  reliability_rating: number;
  ability_answers?: Record<string, boolean>;
  intake_methods?: string[] | null;
  climb_levels?: string[] | null;
  endgame_state?: string | null;
  notes: string;
  created_at: string;
  /** Sync status for retry/backoff tracking */
  _syncStatus?: "queued" | "syncing" | "failed";
  _failedAttempts?: number;
  _lastAttemptAt?: string;
  _schema?: number;
}

export async function saveOffline(entry: PendingEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({
      ...entry,
      _syncStatus: entry._syncStatus ?? "queued",
      _failedAttempts: entry._failedAttempts ?? 0,
      _schema: entry._schema ?? 1,
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingEntries(): Promise<PendingEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removePendingEntry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingCount(): Promise<number> {
  const entries = await getPendingEntries();
  return entries.length;
}

/** Update sync status fields on an existing entry (for retry/backoff) */
export async function updateEntryStatus(
  id: string,
  updates: Partial<
    Pick<PendingEntry, "_syncStatus" | "_failedAttempts" | "_lastAttemptAt">
  >
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const existing = getReq.result;
      if (existing) {
        store.put({ ...existing, ...updates });
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Clear all pending entries (used by logout) */
export async function clearAllPendingEntries(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

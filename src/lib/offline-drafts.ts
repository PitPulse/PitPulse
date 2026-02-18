/**
 * Offline Draft Persistence
 *
 * Auto-saves scouting form state to IndexedDB so that in-progress
 * work survives page reloads, accidental navigation, and browser crashes.
 *
 * Draft key composite: `${eventKey}-${matchId}-${teamNumber}-${userId}`
 * (GPT 5.3 recommendation: restore by event+match+team+scout)
 *
 * Drafts are cleared ONLY after a confirmed server sync — NOT after
 * an offline save to the pending queue.
 */

import { openDB } from "./offline-db";

const STORE_NAME = "draft-entries";

// Schema version for future migration support
export const DRAFT_SCHEMA_VERSION = 1;

export interface DraftEntry {
  /** Composite key: eventKey-matchId-teamNumber-userId */
  id: string;
  event_key: string;
  match_id: string;
  team_number: number;
  user_id: string;
  /** The full form state snapshot */
  form_data: DraftFormData;
  /** Housekeeping */
  _schema: number;
  _savedAt: string; // ISO timestamp
}

export interface DraftFormData {
  auto_score: number;
  auto_start_position: string | null;
  auto_notes: string;
  shooting_ranges: string[];
  shooting_reliability: number;
  teleop_score: number;
  intake_methods: string[];
  endgame_score: number;
  climb_levels: string[];
  defense_rating: number;
  cycle_time_rating: number;
  reliability_rating: number;
  ability_answers: Record<string, boolean | null>;
  notes: string;
}

// ── Key builder ────────────────────────────────────────────────────

export function buildDraftKey(
  eventKey: string | null | undefined,
  matchId: string,
  teamNumber: number,
  userId: string
): string {
  return `${eventKey ?? "none"}-${matchId}-${teamNumber}-${userId}`;
}

// ── CRUD ───────────────────────────────────────────────────────────

export async function saveDraft(draft: DraftEntry): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(draft);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDraft(
  id: string
): Promise<DraftEntry | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result ?? undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function removeDraft(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllDrafts(): Promise<DraftEntry[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllDrafts(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Prune drafts older than maxAgeDays */
export async function pruneOldDrafts(
  maxAgeDays: number = 14
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffISO = cutoff.toISOString();

  const drafts = await getAllDrafts();
  let pruned = 0;

  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    for (const draft of drafts) {
      if (draft._savedAt < cutoffISO) {
        store.delete(draft.id);
        pruned++;
      }
    }
    tx.oncomplete = () => resolve(pruned);
    tx.onerror = () => reject(tx.error);
  });
}

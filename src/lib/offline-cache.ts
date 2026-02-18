/**
 * Offline Data Cache
 *
 * Caches match, event, and scouting metadata in IndexedDB so that
 * scouting-form pages can load even when the network is unavailable.
 *
 * Stores (managed by offline-db.ts):
 *   - "cached-matches"   keyed by match id
 *   - "cached-events"    keyed by event tba_key
 *   - "cache-meta"       timestamps & versions (key: string label)
 *
 * Schema version is stored on every record so future migrations can
 * skip or transform stale rows.
 */

import { openDB } from "./offline-db";

// Schema version stamped on every cached record
export const CACHE_SCHEMA_VERSION = 1;

// ── Types ──────────────────────────────────────────────────────────

export interface CachedMatch {
  /** matches.id (UUID) */
  id: string;
  event_id: string;
  comp_level: string;
  match_number: number;
  set_number: number | null;
  red_alliance: string[] | null;
  blue_alliance: string[] | null;
  red_score: number | null;
  blue_score: number | null;
  scheduled_time?: string | null;
  /** Denormalized event fields */
  event_name: string | null;
  event_tba_key: string | null;
  event_year: number | null;
  /** Housekeeping */
  _schema: number;
  _cachedAt: string; // ISO
}

export interface CachedEvent {
  tba_key: string;
  id: string;
  name: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  year: number;
  _schema: number;
  _cachedAt: string;
}

export interface CacheMeta {
  key: string;
  value: string;
  updatedAt: string;
}

// ── Match Cache ────────────────────────────────────────────────────

export async function cacheMatches(matches: CachedMatch[]): Promise<void> {
  if (matches.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-matches", "readwrite");
    const store = tx.objectStore("cached-matches");
    for (const match of matches) {
      store.put(match);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedMatchesByEvent(
  eventTbaKey: string
): Promise<CachedMatch[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-matches", "readonly");
    const index = tx.objectStore("cached-matches").index("by_tba_key");
    const request = index.getAll(eventTbaKey);
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

export async function getCachedMatch(
  matchId: string
): Promise<CachedMatch | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-matches", "readonly");
    const request = tx.objectStore("cached-matches").get(matchId);
    request.onsuccess = () => resolve(request.result ?? undefined);
    request.onerror = () => reject(request.error);
  });
}

// ── Event Cache ────────────────────────────────────────────────────

export async function cacheEvents(events: CachedEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-events", "readwrite");
    const store = tx.objectStore("cached-events");
    for (const event of events) {
      store.put(event);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedEvent(
  tbaKey: string
): Promise<CachedEvent | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-events", "readonly");
    const request = tx.objectStore("cached-events").get(tbaKey);
    request.onsuccess = () => resolve(request.result ?? undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCachedEvents(): Promise<CachedEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cached-events", "readonly");
    const request = tx.objectStore("cached-events").getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
}

// ── Cache Meta (timestamps, versions) ──────────────────────────────

export async function setCacheMeta(
  key: string,
  value: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cache-meta", "readwrite");
    tx.objectStore("cache-meta").put({
      key,
      value,
      updatedAt: new Date().toISOString(),
    } satisfies CacheMeta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCacheMeta(
  key: string
): Promise<CacheMeta | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("cache-meta", "readonly");
    const request = tx.objectStore("cache-meta").get(key);
    request.onsuccess = () => resolve(request.result ?? undefined);
    request.onerror = () => reject(request.error);
  });
}

// ── Convenience: "Last synced" per event ───────────────────────────

export async function getLastCachedAt(
  eventTbaKey: string
): Promise<Date | null> {
  const meta = await getCacheMeta(`event-cached:${eventTbaKey}`);
  return meta ? new Date(meta.updatedAt) : null;
}

export async function setLastCachedAt(eventTbaKey: string): Promise<void> {
  await setCacheMeta(`event-cached:${eventTbaKey}`, "1");
}

// ── Bulk clear (used by logout / storage hygiene) ──────────────────

export async function clearAllCachedData(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const storeNames = ["cached-matches", "cached-events", "cache-meta"];
    const tx = db.transaction(storeNames, "readwrite");
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearCachedEventData(
  eventTbaKey: string
): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      ["cached-matches", "cached-events", "cache-meta"],
      "readwrite"
    );

    // Delete event record
    tx.objectStore("cached-events").delete(eventTbaKey);

    // Delete meta
    tx.objectStore("cache-meta").delete(`event-cached:${eventTbaKey}`);

    // Delete matches by index
    const matchIndex = tx
      .objectStore("cached-matches")
      .index("by_tba_key");
    const cursorReq = matchIndex.openKeyCursor(eventTbaKey);
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (cursor) {
        tx.objectStore("cached-matches").delete(cursor.primaryKey);
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Prune old cached events (> N days) ─────────────────────────────

export async function pruneOldCachedData(
  maxAgeDays: number = 30
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);
  const cutoffISO = cutoff.toISOString();

  const events = await getAllCachedEvents();
  let pruned = 0;

  for (const event of events) {
    if (event._cachedAt < cutoffISO) {
      await clearCachedEventData(event.tba_key);
      pruned++;
    }
  }

  return pruned;
}

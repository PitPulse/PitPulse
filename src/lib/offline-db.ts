/**
 * Shared IndexedDB opener for all offline stores.
 *
 * Single source of truth for DB_NAME and DB_VERSION so that
 * offline-queue.ts, offline-cache.ts, and offline-drafts.ts
 * all open the same database with consistent schema upgrades.
 */

export const DB_NAME = "scoutai-offline";
export const DB_VERSION = 2;

export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // ── v0 → v1: original pending-entries store ──
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains("pending-entries")) {
          db.createObjectStore("pending-entries", { keyPath: "id" });
        }
      }

      // ── v1 → v2: cache stores + drafts ──
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains("cached-matches")) {
          const matchStore = db.createObjectStore("cached-matches", {
            keyPath: "id",
          });
          matchStore.createIndex("by_event", "event_id", { unique: false });
          matchStore.createIndex("by_tba_key", "event_tba_key", {
            unique: false,
          });
        }

        if (!db.objectStoreNames.contains("cached-events")) {
          db.createObjectStore("cached-events", { keyPath: "tba_key" });
        }

        if (!db.objectStoreNames.contains("cache-meta")) {
          db.createObjectStore("cache-meta", { keyPath: "key" });
        }

        if (!db.objectStoreNames.contains("draft-entries")) {
          db.createObjectStore("draft-entries", { keyPath: "id" });
        }
      }
    };
  });
}

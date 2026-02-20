"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/supabase";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type ScoutingEntry = Database["public"]["Tables"]["scouting_entries"]["Row"];

/**
 * Subscribe to real-time INSERT / DELETE changes on scouting_entries,
 * filtered by org_id.  The hook merges incoming changes into the
 * initial server-provided data so the UI stays fresh without polling.
 */
export function useRealtimeScoutingEntries<T extends ScoutingEntry>(
  initialEntries: T[],
  orgId: string,
  /** Optional extra filter — only react to entries whose match_id is in this set */
  matchIds?: string[]
) {
  const [entries, setEntries] = useState<T[]>(initialEntries);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const matchIdSet = useRef<Set<string> | null>(
    matchIds ? new Set(matchIds) : null
  );

  // Keep matchId filter in sync without re-subscribing
  useEffect(() => {
    matchIdSet.current = matchIds ? new Set(matchIds) : null;
  }, [matchIds]);

  // Reset local state when server data changes (e.g. navigation)
  useEffect(() => {
    setEntries(initialEntries);
    setNewIds(new Set());
  }, [initialEntries]);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`scouting_entries:${orgId}`)
      .on<ScoutingEntry>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "scouting_entries",
          filter: `org_id=eq.${orgId}`,
        },
        (payload: RealtimePostgresChangesPayload<ScoutingEntry>) => {
          if (payload.eventType === "INSERT") {
            const newEntry = payload.new as T;

            // If we have a match filter, only include entries for those matches
            if (
              matchIdSet.current &&
              !matchIdSet.current.has(newEntry.match_id)
            ) {
              return;
            }

            setEntries((prev) => {
              // Avoid duplicates
              if (prev.some((e) => e.id === newEntry.id)) return prev;
              return [newEntry, ...prev];
            });
            setNewIds((prev) => new Set(prev).add(newEntry.id));
          } else if (payload.eventType === "DELETE") {
            const oldId = (payload.old as Partial<ScoutingEntry>).id;
            if (!oldId) return;
            setEntries((prev) => prev.filter((e) => e.id !== oldId));
            setNewIds((prev) => {
              const next = new Set(prev);
              next.delete(oldId);
              return next;
            });
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as T;
            setEntries((prev) =>
              prev.map((e) => (e.id === updated.id ? updated : e))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId]);

  /** Clear the "new" highlight for a specific entry */
  const clearNew = useCallback((id: string) => {
    setNewIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { entries, newIds, clearNew };
}

"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeScoutingEntries } from "@/lib/use-realtime-scouting";
import type { Database } from "@/types/supabase";

type ScoutingEntry = Database["public"]["Tables"]["scouting_entries"]["Row"];

/**
 * Wraps the team detail page and listens for new scouting entries.
 * When a new entry arrives for this team at this event, we trigger
 * a router.refresh() so the server component re-renders with fresh
 * aggregated data (summaries, charts, entry list).
 *
 * This is simpler than duplicating all the aggregation logic client-side.
 */
export function RealtimeScoutingSection({
  orgId,
  matchIds,
  initialEntryIds,
  children,
}: {
  orgId: string;
  matchIds: string[];
  initialEntryIds: string[];
  children: React.ReactNode;
}) {
  const router = useRouter();

  // We only need a lightweight placeholder list — just ids — to detect changes
  const placeholder = useMemo(
    () =>
      initialEntryIds.map(
        (id) =>
          ({
            id,
            match_id: "",
            org_id: orgId,
          } as ScoutingEntry)
      ),
    [initialEntryIds, orgId]
  );

  const { entries } = useRealtimeScoutingEntries(placeholder, orgId, matchIds);

  // When the entry count changes (insert or delete), refresh the server page
  useEffect(() => {
    if (entries.length !== initialEntryIds.length) {
      router.refresh();
    }
  }, [entries.length, initialEntryIds.length, router]);

  return <>{children}</>;
}

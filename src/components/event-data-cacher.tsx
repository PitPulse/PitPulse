"use client";

import { useEffect } from "react";
import {
  cacheMatches,
  cacheEvents,
  setLastCachedAt,
  type CachedMatch,
  type CachedEvent,
  CACHE_SCHEMA_VERSION,
} from "@/lib/offline-cache";

/**
 * Invisible client component that caches match + event data to IndexedDB
 * whenever the match list page renders online. This ensures scouting forms
 * can load match context even when offline.
 *
 * Rendered by the server-side match list page; receives serialized data
 * as props so no additional Supabase calls are needed on the client.
 */

interface MatchForCache {
  id: string;
  event_id: string;
  comp_level: string;
  match_number: number;
  set_number: number | null;
  red_teams: number[];
  blue_teams: number[];
  red_score: number | null;
  blue_score: number | null;
  scheduled_time?: string | null;
}

interface EventForCache {
  id: string;
  tba_key: string;
  name: string;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  year: number;
}

interface EventDataCacherProps {
  eventKey: string;
  event: EventForCache;
  matches: MatchForCache[];
}

export function EventDataCacher({
  eventKey,
  event,
  matches,
}: EventDataCacherProps) {
  useEffect(() => {
    // Only cache when online (we're reading fresh data from the server)
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    if (!matches.length) return;

    const now = new Date().toISOString();

    const cachedEvent: CachedEvent = {
      tba_key: event.tba_key,
      id: event.id,
      name: event.name,
      location: event.location ?? null,
      start_date: event.start_date ?? null,
      end_date: event.end_date ?? null,
      year: event.year,
      _schema: CACHE_SCHEMA_VERSION,
      _cachedAt: now,
    };

    const cachedMatches: CachedMatch[] = matches.map((m) => ({
      id: m.id,
      event_id: m.event_id,
      comp_level: m.comp_level,
      match_number: m.match_number,
      set_number: m.set_number,
      red_alliance: m.red_teams.map(String),
      blue_alliance: m.blue_teams.map(String),
      red_score: m.red_score,
      blue_score: m.blue_score,
      scheduled_time: m.scheduled_time,
      event_name: event.name,
      event_tba_key: eventKey,
      event_year: event.year,
      _schema: CACHE_SCHEMA_VERSION,
      _cachedAt: now,
    }));

    void Promise.all([
      cacheEvents([cachedEvent]),
      cacheMatches(cachedMatches),
      setLastCachedAt(eventKey),
    ]).catch(() => {
      // Silent fail — caching is best-effort
    });
  }, [eventKey, event, matches]);

  // Renders nothing — pure side-effect component
  return null;
}

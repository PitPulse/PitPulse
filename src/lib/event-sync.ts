import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { getEventSyncMinYear } from "@/lib/platform-settings";
import {
  fetchEvent,
  fetchEventMatches,
  fetchEventTeams,
  parseMatchAlliance,
} from "@/lib/tba";

export const EVENT_KEY_PATTERN = /^\d{4}[a-z0-9]+$/;
const STATBOTICS_BASE = "https://api.statbotics.io/v3";
const STATBOTICS_CONCURRENCY = 6;
const STATBOTICS_TIMEOUT_MS = 12000;

interface StatboticsTeamEvent {
  epa: {
    breakdown: {
      total_points: number | { mean: number };
      auto_points?: number | { mean: number };
      teleop_points?: number | { mean: number };
      endgame_points?: number | { mean: number };
    };
  };
  record: {
    season: {
      wins: number;
      losses: number;
      ties: number;
    };
  };
}

export type EventSyncDataResult = {
  eventId: string;
  eventName: string;
  teamCount: number;
  matchCount: number;
  warning: string | null;
};

export type EventStatsSyncResult = {
  synced: number;
  errors: number;
  total: number;
  failedTeams: number[];
};

function buildLocation(
  city: string | null | undefined,
  state: string | null | undefined,
  country: string | null | undefined
): string {
  return [city, state, country]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(", ");
}

function extractMean(
  value?: number | { mean: number } | null
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && typeof value.mean === "number") {
    return value.mean;
  }
  return null;
}

export async function syncEventData(params: {
  supabase: SupabaseClient<Database>;
  eventKey: string;
  orgId: string;
  orgTeamNumber: number | null;
}): Promise<EventSyncDataResult> {
  const { supabase, eventKey, orgId, orgTeamNumber } = params;

  const minSyncYear = await getEventSyncMinYear(supabase);
  const minAllowedDate = `${minSyncYear}-01-01`;
  const today = new Date().toISOString().slice(0, 10);

  const tbaEvent = await fetchEvent(eventKey);
  const eventDate = tbaEvent.start_date ?? tbaEvent.end_date;

  if (tbaEvent.year < minSyncYear) {
    throw new Error(
      `This event is outside the available sync window. Allowed range: ${minAllowedDate} to ${today}.`
    );
  }

  if (eventDate) {
    if (eventDate < minAllowedDate || eventDate > today) {
      throw new Error(
        `This event is outside the available sync window. Allowed range: ${minAllowedDate} to ${today}.`
      );
    }
  } else if (tbaEvent.year > new Date().getFullYear()) {
    throw new Error(
      `This event is outside the available sync window. Allowed range: ${minAllowedDate} to ${today}.`
    );
  }

  const { error: eventError } = await supabase.from("events").upsert(
    {
      tba_key: tbaEvent.key,
      name: tbaEvent.name,
      year: tbaEvent.year,
      location: buildLocation(tbaEvent.city, tbaEvent.state_prov, tbaEvent.country),
      start_date: tbaEvent.start_date,
      end_date: tbaEvent.end_date,
    },
    { onConflict: "tba_key" }
  );

  if (eventError) {
    throw new Error(`Failed to upsert event: ${eventError.message}`);
  }

  const tbaTeams = await fetchEventTeams(eventKey);
  const teamRows = tbaTeams.map((team) => ({
    team_number: team.team_number,
    name: team.nickname,
    city: team.city,
    state: team.state_prov,
  }));

  for (let i = 0; i < teamRows.length; i += 50) {
    const batch = teamRows.slice(i, i + 50);
    const { error: teamError } = await supabase
      .from("teams")
      .upsert(batch, { onConflict: "team_number" });
    if (teamError) {
      throw new Error(`Failed to upsert teams: ${teamError.message}`);
    }
  }

  const { data: dbEvent } = await supabase
    .from("events")
    .select("id")
    .eq("tba_key", eventKey)
    .single();

  if (!dbEvent) {
    throw new Error("Event not found after upsert");
  }

  const eventTeamRows = tbaTeams.map((team) => ({
    event_id: dbEvent.id,
    team_number: team.team_number,
  }));

  for (let i = 0; i < eventTeamRows.length; i += 200) {
    const batch = eventTeamRows.slice(i, i + 200);
    const { error: eventTeamError } = await supabase
      .from("event_teams")
      .upsert(batch, {
        onConflict: "event_id,team_number",
        ignoreDuplicates: true,
      });

    if (eventTeamError) {
      throw new Error(`Failed to link event teams: ${eventTeamError.message}`);
    }
  }

  const isAttending = orgTeamNumber
    ? tbaTeams.some((team) => team.team_number === orgTeamNumber)
    : false;

  const { error: orgEventError } = await supabase.from("org_events").upsert(
    {
      org_id: orgId,
      event_id: dbEvent.id,
      is_attending: isAttending,
    },
    { onConflict: "org_id,event_id" }
  );

  if (orgEventError) {
    throw new Error(`Failed to link event: ${orgEventError.message}`);
  }

  const tbaMatches = await fetchEventMatches(eventKey);
  const matchRows = tbaMatches.map((match) => ({
    event_id: dbEvent.id,
    comp_level: match.comp_level,
    set_number: match.comp_level === "qm" ? 1 : match.set_number ?? 1,
    match_number: match.match_number,
    red_teams: parseMatchAlliance(match.alliances.red.team_keys),
    blue_teams: parseMatchAlliance(match.alliances.blue.team_keys),
    red_score: match.alliances.red.score >= 0 ? match.alliances.red.score : null,
    blue_score: match.alliances.blue.score >= 0 ? match.alliances.blue.score : null,
  }));

  for (let i = 0; i < matchRows.length; i += 50) {
    const batch = matchRows.slice(i, i + 50);
    const { error: matchError } = await supabase.from("matches").upsert(batch, {
      onConflict: "event_id,comp_level,set_number,match_number",
    });
    if (matchError) {
      throw new Error(`Failed to upsert matches: ${matchError.message}`);
    }
  }

  return {
    eventId: dbEvent.id,
    eventName: tbaEvent.name,
    teamCount: tbaTeams.length,
    matchCount: tbaMatches.length,
    warning: isAttending
      ? null
      : "Your team isn’t listed for this event. You can still scout it, but it won’t be on your schedule.",
  };
}

export async function syncEventStats(params: {
  supabase: SupabaseClient<Database>;
  eventKey: string;
  eventId: string;
}): Promise<EventStatsSyncResult> {
  const { supabase, eventKey, eventId } = params;

  const { data: eventTeams } = await supabase
    .from("event_teams")
    .select("team_number")
    .eq("event_id", eventId);

  const teamNumbers = new Set<number>((eventTeams ?? []).map((team) => team.team_number));

  if (teamNumbers.size === 0) {
    const { data: matches } = await supabase
      .from("matches")
      .select("red_teams, blue_teams")
      .eq("event_id", eventId);

    if (matches && matches.length > 0) {
      for (const match of matches) {
        match.red_teams.forEach((team: number) => teamNumbers.add(team));
        match.blue_teams.forEach((team: number) => teamNumbers.add(team));
      }
    }
  }

  if (teamNumbers.size === 0) {
    throw new Error("No teams found to sync stats. Sync the event first.");
  }

  const statsRows: Array<{
    team_number: number;
    event_id: string;
    epa: number | null;
    auto_epa: number | null;
    teleop_epa: number | null;
    endgame_epa: number | null;
    win_rate: number | null;
    last_synced_at: string;
  }> = [];

  let successCount = 0;
  let errorCount = 0;
  const failedTeams: number[] = [];

  const teamList = Array.from(teamNumbers);
  for (let i = 0; i < teamList.length; i += STATBOTICS_CONCURRENCY) {
    const batch = teamList.slice(i, i + STATBOTICS_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (teamNum) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), STATBOTICS_TIMEOUT_MS);
          let res: Response;
          try {
            res = await fetch(
              `${STATBOTICS_BASE}/team_event/${teamNum}/${eventKey}`,
              { cache: "no-store", signal: controller.signal }
            );
          } finally {
            clearTimeout(timeout);
          }

          if (!res.ok) {
            if (res.status !== 404) {
              console.warn(
                `Statbotics fetch failed for team ${teamNum} at event ${eventKey}: HTTP ${res.status}`
              );
            }
            return { teamNum, row: null as null };
          }

          const data = (await res.json()) as StatboticsTeamEvent;
          const breakdown = data.epa?.breakdown;
          const record = data.record?.season;

          const totalGames =
            (record?.wins ?? 0) + (record?.losses ?? 0) + (record?.ties ?? 0);

          return {
            teamNum,
            row: {
              team_number: teamNum,
              event_id: eventId,
              epa: extractMean(breakdown?.total_points),
              auto_epa: extractMean(breakdown?.auto_points),
              teleop_epa: extractMean(breakdown?.teleop_points),
              endgame_epa: extractMean(breakdown?.endgame_points),
              win_rate: totalGames > 0 ? (record?.wins ?? 0) / totalGames : null,
              last_synced_at: new Date().toISOString(),
            },
          };
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            console.warn(
              `Statbotics timeout for team ${teamNum} at event ${eventKey} after ${STATBOTICS_TIMEOUT_MS}ms`
            );
          }
          console.warn(
            `Statbotics fetch error for team ${teamNum} at event ${eventKey}:`,
            error instanceof Error ? error.message : "Unknown error"
          );
          return { teamNum, row: null as null };
        }
      })
    );

    for (const result of results) {
      if (!result.row) {
        errorCount += 1;
        if (failedTeams.length < 20) failedTeams.push(result.teamNum);
        continue;
      }
      statsRows.push(result.row);
      successCount += 1;
    }
  }

  if (statsRows.length > 0) {
    for (let i = 0; i < statsRows.length; i += 50) {
      const batch = statsRows.slice(i, i + 50);
      const { error: upsertError } = await supabase
        .from("team_event_stats")
        .upsert(batch, { onConflict: "team_number,event_id" });

      if (upsertError) {
        throw new Error(`Failed to upsert stats: ${upsertError.message}`);
      }
    }
  }

  return {
    synced: successCount,
    errors: errorCount,
    total: teamNumbers.size,
    failedTeams,
  };
}

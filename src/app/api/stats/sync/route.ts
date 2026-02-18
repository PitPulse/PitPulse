import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  retryAfterSeconds,
} from "@/lib/rate-limit";

const STATBOTICS_BASE = "https://api.statbotics.io/v3";
const STATBOTICS_CONCURRENCY = 6;

export const runtime = "nodejs";
export const maxDuration = 60;
const STATS_SYNC_RATE_LIMIT_MAX = 1;
const EVENT_KEY_PATTERN = /^\d{4}[a-z0-9]+$/;

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

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => null)) as
      | { eventKey?: string }
      | null;
    const eventKeyRaw =
      typeof payload?.eventKey === "string" ? payload.eventKey.trim() : "";
    const eventKey = eventKeyRaw.toLowerCase();

    if (!eventKey) {
      return NextResponse.json(
        { error: "eventKey is required" },
        { status: 400 }
      );
    }

    if (!EVENT_KEY_PATTERN.test(eventKey)) {
      return NextResponse.json(
        { error: "Invalid event key format (expected e.g. 2025hiho)." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id, role")
      .eq("id", user.id)
      .single();

    if (!profile?.org_id) {
      return NextResponse.json(
        { error: "No organization found" },
        { status: 400 }
      );
    }

    if (profile.role !== "captain") {
      return NextResponse.json(
        { error: "Only captains can sync stats" },
        { status: 403 }
      );
    }

    const limit = await checkRateLimit(
      `stats-sync:${profile.org_id}`,
      5 * 60_000,
      STATS_SYNC_RATE_LIMIT_MAX
    );
    const limitHeaders = buildRateLimitHeaders(
      limit,
      STATS_SYNC_RATE_LIMIT_MAX
    );
    if (!limit.allowed) {
      const retryAfter = retryAfterSeconds(limit.resetAt);
      return NextResponse.json(
        { error: "Your team has exceeded the rate limit. Please try again soon." },
        {
          status: 429,
          headers: { ...limitHeaders, "Retry-After": retryAfter.toString() },
        }
      );
    }

    // Get event from our DB
    const { data: dbEvent } = await supabase
      .from("events")
      .select("id")
      .eq("tba_key", eventKey)
      .single();

    if (!dbEvent) {
      return NextResponse.json(
        { error: "Event not found. Sync the event first." },
        { status: 404 }
      );
    }

    // Get all teams at this event from our DB
    const { data: eventTeams } = await supabase
      .from("event_teams")
      .select("team_number")
      .eq("event_id", dbEvent.id);

    const teamNumbers = new Set<number>((eventTeams ?? []).map((t) => t.team_number));

    if (teamNumbers.size === 0) {
      const { data: matches } = await supabase
        .from("matches")
        .select("red_teams, blue_teams")
        .eq("event_id", dbEvent.id);

      if (matches && matches.length > 0) {
        for (const match of matches) {
          match.red_teams.forEach((t: number) => teamNumbers.add(t));
          match.blue_teams.forEach((t: number) => teamNumbers.add(t));
        }
      }
    }

    if (teamNumbers.size === 0) {
      return NextResponse.json(
        { error: "No teams found to sync stats. Sync the event first." },
        { status: 404 }
      );
    }

    // Fetch EPA from Statbotics for each team
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

    const extractMean = (
      value?: number | { mean?: number } | null
    ): number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "number") return value;
      if (typeof value === "object" && typeof value.mean === "number") {
        return value.mean;
      }
      return null;
    };

    const teamList = Array.from(teamNumbers);
    for (let i = 0; i < teamList.length; i += STATBOTICS_CONCURRENCY) {
      const batch = teamList.slice(i, i + STATBOTICS_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (teamNum) => {
          try {
            const res = await fetch(
              `${STATBOTICS_BASE}/team_event/${teamNum}/${eventKey}`,
              { next: { revalidate: 600 } } // Cache 10 min
            );

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
                event_id: dbEvent.id,
                epa: extractMean(breakdown?.total_points),
                auto_epa: extractMean(breakdown?.auto_points),
                teleop_epa: extractMean(breakdown?.teleop_points),
                endgame_epa: extractMean(breakdown?.endgame_points),
                win_rate: totalGames > 0 ? (record?.wins ?? 0) / totalGames : null,
                last_synced_at: new Date().toISOString(),
              },
            };
          } catch (error) {
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
          errorCount++;
          if (failedTeams.length < 20) failedTeams.push(result.teamNum);
          continue;
        }
        statsRows.push(result.row);
        successCount++;
      }
    }

    // Upsert stats
    if (statsRows.length > 0) {
      for (let i = 0; i < statsRows.length; i += 50) {
        const batch = statsRows.slice(i, i + 50);
        const { error: upsertError } = await supabase
          .from("team_event_stats")
          .upsert(batch, { onConflict: "team_number,event_id" });

        if (upsertError) {
          return NextResponse.json(
            { error: `Failed to upsert stats: ${upsertError.message}` },
            { status: 500 }
          );
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        synced: successCount,
        errors: errorCount,
        total: teamNumbers.size,
        failedTeams,
      },
      { headers: limitHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Stats sync failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

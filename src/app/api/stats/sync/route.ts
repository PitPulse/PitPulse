import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, retryAfterSeconds } from "@/lib/rate-limit";

const STATBOTICS_BASE = "https://api.statbotics.io/v3";

interface StatboticsTeamEvent {
  epa: {
    breakdown: {
      total_points: {
        mean: number;
      };
      auto_points?: {
        mean: number;
      };
      teleop_points?: {
        mean: number;
      };
      endgame_points?: {
        mean: number;
      };
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
    const { eventKey } = await request.json();

    if (!eventKey || typeof eventKey !== "string") {
      return NextResponse.json(
        { error: "eventKey is required" },
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

    const limit = checkRateLimit(
      `stats-sync:${profile.org_id}`,
      5 * 60_000,
      1
    );
    if (!limit.allowed) {
      const retryAfter = retryAfterSeconds(limit.resetAt);
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again soon." },
        { status: 429, headers: { "Retry-After": retryAfter.toString() } }
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
    const { data: matches } = await supabase
      .from("matches")
      .select("red_teams, blue_teams")
      .eq("event_id", dbEvent.id);

    if (!matches || matches.length === 0) {
      return NextResponse.json(
        { error: "No matches found. Sync the event first." },
        { status: 404 }
      );
    }

    // Collect unique team numbers
    const teamNumbers = new Set<number>();
    for (const match of matches) {
      match.red_teams.forEach((t: number) => teamNumbers.add(t));
      match.blue_teams.forEach((t: number) => teamNumbers.add(t));
    }

    // Fetch EPA from Statbotics for each team
    const statsRows = [];
    let successCount = 0;
    let errorCount = 0;
    const failedTeams: number[] = [];

    for (const teamNum of teamNumbers) {
      try {
        const res = await fetch(
          `${STATBOTICS_BASE}/team_event/${teamNum}/${eventKey}`,
          { next: { revalidate: 600 } } // Cache 10 min
        );

        if (!res.ok) {
          errorCount++;
          if (failedTeams.length < 20) failedTeams.push(teamNum);
          continue;
        }

        const data = (await res.json()) as StatboticsTeamEvent;
        const breakdown = data.epa?.breakdown;
        const record = data.record?.season;

        const totalGames =
          (record?.wins ?? 0) + (record?.losses ?? 0) + (record?.ties ?? 0);

        statsRows.push({
          team_number: teamNum,
          event_id: dbEvent.id,
          epa: breakdown?.total_points?.mean ?? null,
          auto_epa: breakdown?.auto_points?.mean ?? null,
          teleop_epa: breakdown?.teleop_points?.mean ?? null,
          endgame_epa: breakdown?.endgame_points?.mean ?? null,
          win_rate: totalGames > 0 ? (record?.wins ?? 0) / totalGames : null,
          last_synced_at: new Date().toISOString(),
        });
        successCount++;
      } catch {
        errorCount++;
        if (failedTeams.length < 20) failedTeams.push(teamNum);
      }

      // Rate limit: ~60 req/min for Statbotics
      await new Promise((resolve) => setTimeout(resolve, 1100));
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

    return NextResponse.json({
      success: true,
      synced: successCount,
      errors: errorCount,
      total: teamNumbers.size,
      failedTeams,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

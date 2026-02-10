import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, retryAfterSeconds } from "@/lib/rate-limit";
import {
  fetchEvent,
  fetchEventTeams,
  fetchEventMatches,
  parseMatchAlliance,
} from "@/lib/tba";

export async function POST(request: Request) {
  try {
    const { eventKey } = await request.json();

    if (!eventKey || typeof eventKey !== "string") {
      return NextResponse.json(
        { error: "eventKey is required (e.g. '2025hiho')" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user is authenticated
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
        { error: "Only captains can sync events" },
        { status: 403 }
      );
    }

    const limit = checkRateLimit(
      `events-sync:${profile.org_id}`,
      5 * 60_000,
      2
    );
    if (!limit.allowed) {
      const retryAfter = retryAfterSeconds(limit.resetAt);
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again soon." },
        { status: 429, headers: { "Retry-After": retryAfter.toString() } }
      );
    }

    // 1. Fetch and upsert event
    const tbaEvent = await fetchEvent(eventKey);
    const { error: eventError } = await supabase.from("events").upsert(
      {
        tba_key: tbaEvent.key,
        name: tbaEvent.name,
        year: tbaEvent.year,
        location: `${tbaEvent.city}, ${tbaEvent.state_prov}, ${tbaEvent.country}`,
        start_date: tbaEvent.start_date,
        end_date: tbaEvent.end_date,
      },
      { onConflict: "tba_key" }
    );

    if (eventError) {
      return NextResponse.json(
        { error: `Failed to upsert event: ${eventError.message}` },
        { status: 500 }
      );
    }

    // 2. Fetch and upsert teams
    const tbaTeams = await fetchEventTeams(eventKey);
    const teamRows = tbaTeams.map((t) => ({
      team_number: t.team_number,
      name: t.nickname,
      city: t.city,
      state: t.state_prov,
    }));

    // Upsert in batches of 50
    for (let i = 0; i < teamRows.length; i += 50) {
      const batch = teamRows.slice(i, i + 50);
      const { error: teamError } = await supabase
        .from("teams")
        .upsert(batch, { onConflict: "team_number" });

      if (teamError) {
        return NextResponse.json(
          { error: `Failed to upsert teams: ${teamError.message}` },
          { status: 500 }
        );
      }
    }

    // 3. Get the event ID from our DB
    const { data: dbEvent } = await supabase
      .from("events")
      .select("id")
      .eq("tba_key", eventKey)
      .single();

    if (!dbEvent) {
      return NextResponse.json(
        { error: "Event not found after upsert" },
        { status: 500 }
      );
    }

    // 4. Fetch and upsert matches
    const tbaMatches = await fetchEventMatches(eventKey);
    const matchRows = tbaMatches.map((m) => ({
      event_id: dbEvent.id,
      comp_level: m.comp_level,
      set_number: m.comp_level === "qm" ? 1 : m.set_number ?? 1,
      match_number: m.match_number,
      red_teams: parseMatchAlliance(m.alliances.red.team_keys),
      blue_teams: parseMatchAlliance(m.alliances.blue.team_keys),
      red_score: m.alliances.red.score >= 0 ? m.alliances.red.score : null,
      blue_score: m.alliances.blue.score >= 0 ? m.alliances.blue.score : null,
    }));

    // Upsert matches in batches
    for (let i = 0; i < matchRows.length; i += 50) {
      const batch = matchRows.slice(i, i + 50);
      const { error: matchError } = await supabase
        .from("matches")
        .upsert(batch, {
          onConflict: "event_id,comp_level,set_number,match_number",
        });

      if (matchError) {
        return NextResponse.json(
          { error: `Failed to upsert matches: ${matchError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      event: tbaEvent.name,
      teams: tbaTeams.length,
      matches: tbaMatches.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

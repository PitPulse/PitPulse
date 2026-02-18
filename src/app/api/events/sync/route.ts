import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  retryAfterSeconds,
} from "@/lib/rate-limit";
import { getEventSyncMinYear } from "@/lib/platform-settings";
import {
  fetchEvent,
  fetchEventTeams,
  fetchEventMatches,
  parseMatchAlliance,
} from "@/lib/tba";

export const runtime = "nodejs";
export const maxDuration = 60;
const EVENT_SYNC_RATE_LIMIT_MAX = 2;
const EVENT_KEY_PATTERN = /^\d{4}[a-z0-9]+$/;

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
        { error: "eventKey is required (e.g. '2025hiho')" },
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

    const { data: org } = await supabase
      .from("organizations")
      .select("team_number")
      .eq("id", profile.org_id)
      .single();

    const limit = await checkRateLimit(
      `events-sync:${profile.org_id}`,
      5 * 60_000,
      EVENT_SYNC_RATE_LIMIT_MAX
    );
    const limitHeaders = buildRateLimitHeaders(
      limit,
      EVENT_SYNC_RATE_LIMIT_MAX
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

    const minSyncYear = await getEventSyncMinYear(supabase);
    const minAllowedDate = `${minSyncYear}-01-01`;
    const today = new Date().toISOString().slice(0, 10);

    // 1. Fetch and validate event window
    const tbaEvent = await fetchEvent(eventKey);
    const eventDate = tbaEvent.start_date ?? tbaEvent.end_date;

    if (tbaEvent.year < minSyncYear) {
      return NextResponse.json(
        {
          error: `This event is outside the available sync window. Allowed range: ${minAllowedDate} to ${today}.`,
        },
        { status: 400 }
      );
    }

    if (eventDate) {
      if (eventDate < minAllowedDate || eventDate > today) {
        return NextResponse.json(
          {
            error: `This event is outside the available sync window. Allowed range: ${minAllowedDate} to ${today}.`,
          },
          { status: 400 }
        );
      }
    } else if (tbaEvent.year > new Date().getFullYear()) {
      return NextResponse.json(
        {
          error: `This event is outside the available sync window. Allowed range: ${minAllowedDate} to ${today}.`,
        },
        { status: 400 }
      );
    }

    // 2. Upsert event
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

    // 3. Fetch and upsert teams
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

    // 4. Get the event ID from our DB
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

    const eventTeamRows = tbaTeams.map((t) => ({
      event_id: dbEvent.id,
      team_number: t.team_number,
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
        return NextResponse.json(
          { error: `Failed to link event teams: ${eventTeamError.message}` },
          { status: 500 }
        );
      }
    }

    const isAttending = org?.team_number
      ? tbaTeams.some((t) => t.team_number === org.team_number)
      : false;

    const { error: orgEventError } = await supabase.from("org_events").upsert(
      {
        org_id: profile.org_id,
        event_id: dbEvent.id,
        is_attending: isAttending,
      },
      { onConflict: "org_id,event_id" }
    );

    if (orgEventError) {
      return NextResponse.json(
        { error: `Failed to link event: ${orgEventError.message}` },
        { status: 500 }
      );
    }

    // 5. Fetch and upsert matches
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

    return NextResponse.json(
      {
        success: true,
        event: tbaEvent.name,
        teams: tbaTeams.length,
        matches: tbaMatches.length,
        warning: isAttending
          ? null
          : "Your team isn’t listed for this event. You can still scout it, but it won’t be on your schedule.",
      },
      { headers: limitHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Event sync failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

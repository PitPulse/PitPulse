import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { summarizeScouting } from "@/lib/scouting-summary";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  retryAfterSeconds,
  TEAM_AI_WINDOW_MS,
} from "@/lib/rate-limit";
import { buildFrcGamePrompt } from "@/lib/frc-game-prompt";
import {
  getTeamAiLimitFromSettings,
  getTeamAiPromptLimits,
} from "@/lib/platform-settings";

export const runtime = "nodejs";
export const maxDuration = 60;

const STATBOTICS_BASE = "https://api.statbotics.io/v3";

type JsonObject = Record<string, unknown>;

interface TeamRecord {
  wins: number | null;
  losses: number | null;
  ties: number | null;
  played: number | null;
  winRate: number | null;
}

function asObject(value: unknown): JsonObject | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const obj = asObject(value);
  if (!obj) return null;

  const mean = obj.mean;
  if (typeof mean === "number" && Number.isFinite(mean)) return mean;

  return null;
}

function toStringSafe(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getNested(source: unknown, path: string[]): unknown {
  let cursor: unknown = source;
  for (const segment of path) {
    const obj = asObject(cursor);
    if (!obj) return null;
    cursor = obj[segment];
  }
  return cursor;
}

function extractRecord(source: unknown): TeamRecord | null {
  const record = asObject(source);
  if (!record) return null;

  const wins = toNumber(record.wins);
  const losses = toNumber(record.losses);
  const ties = toNumber(record.ties);

  const hasWlt = wins !== null || losses !== null || ties !== null;
  const played = hasWlt ? (wins ?? 0) + (losses ?? 0) + (ties ?? 0) : null;
  const winRateFromApi = toNumber(record.winrate);
  const computedWinRate =
    played !== null && played > 0 && wins !== null ? wins / played : null;

  if (!hasWlt && winRateFromApi === null) return null;

  return {
    wins,
    losses,
    ties,
    played,
    winRate: winRateFromApi ?? computedWinRate,
  };
}

function fetchBreakdownNumber(
  source: unknown,
  key: "total_points" | "auto_points" | "teleop_points" | "endgame_points"
): number | null {
  const breakdown = asObject(source);
  if (!breakdown) return null;
  return toNumber(breakdown[key]);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

async function fetchStatbotics(path: string): Promise<JsonObject | null> {
  try {
    const res = await fetch(`${STATBOTICS_BASE}${path}`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const parsed = (await res.json()) as unknown;
    return asObject(parsed);
  } catch {
    return null;
  }
}

function seasonSummary(year: number, data: JsonObject | null) {
  return {
    year,
    record: extractRecord(getNested(data, ["record", "season"]) ?? getNested(data, ["record"])),
    normEpa: {
      mean: toNumber(getNested(data, ["norm_epa", "mean"])),
      max: toNumber(getNested(data, ["norm_epa", "max"])),
    },
    epa: {
      mean: toNumber(getNested(data, ["epa", "mean"])),
      end: toNumber(getNested(data, ["epa", "end"])),
    },
    eventsPlayed:
      toNumber(getNested(data, ["events_played"])) ??
      toNumber(getNested(data, ["event_count"])) ??
      toNumber(getNested(data, ["record", "count"])),
  };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const payload = (await request.json().catch(() => null)) as
    | JsonObject
    | null;
  const eventKey = typeof payload?.eventKey === "string" ? payload.eventKey : null;
  const teamRaw = payload?.teamNumber;
  const teamNumber =
    typeof teamRaw === "number"
      ? teamRaw
      : typeof teamRaw === "string"
      ? Number.parseInt(teamRaw, 10)
      : Number.NaN;

  if (!eventKey) {
    return NextResponse.json({ error: "eventKey is required" }, { status: 400 });
  }
  if (!Number.isInteger(teamNumber) || teamNumber <= 0) {
    return NextResponse.json(
      { error: "teamNumber must be a positive integer" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("team_number, plan_tier")
    .eq("id", profile.org_id)
    .maybeSingle();

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const teamAiPromptLimits = await getTeamAiPromptLimits(supabase);
  const aiLimit = getTeamAiLimitFromSettings(teamAiPromptLimits, org.plan_tier);
  const limit = await checkRateLimit(
    `ai-interactions:${profile.org_id}`,
    TEAM_AI_WINDOW_MS,
    aiLimit
  );
  const limitHeaders = buildRateLimitHeaders(limit, aiLimit);
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

  const { data: event } = await supabase
    .from("events")
    .select("id, name, year, location")
    .eq("tba_key", eventKey)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const [{ data: localTeam }, { data: localStats }, { data: matches }] =
    await Promise.all([
      supabase
        .from("teams")
        .select("team_number, name, city, state")
        .eq("team_number", teamNumber)
        .maybeSingle(),
      supabase
        .from("team_event_stats")
        .select("epa, auto_epa, teleop_epa, endgame_epa, win_rate, last_synced_at")
        .eq("event_id", event.id)
        .eq("team_number", teamNumber)
        .maybeSingle(),
      supabase
        .from("matches")
        .select("id, red_teams, blue_teams, red_score, blue_score")
        .eq("event_id", event.id),
    ]);

  const teamMatches = (matches ?? []).filter(
    (match) =>
      match.red_teams.includes(teamNumber) || match.blue_teams.includes(teamNumber)
  );
  const matchIds = teamMatches.map((match) => match.id);

  const { data: scoutingRows } =
    matchIds.length > 0
      ? await supabase
          .from("scouting_entries")
          .select(
            "auto_score, teleop_score, endgame_score, defense_rating, reliability_rating, notes"
          )
          .eq("org_id", profile.org_id)
          .eq("team_number", teamNumber)
          .in("match_id", matchIds)
      : { data: [] as Array<Record<string, unknown>> };

  const scoutingSummary = summarizeScouting(
    (scoutingRows ?? []).map((entry) => ({
      auto_score: Number(entry.auto_score ?? 0),
      teleop_score: Number(entry.teleop_score ?? 0),
      endgame_score: Number(entry.endgame_score ?? 0),
      defense_rating: Number(entry.defense_rating ?? 0),
      reliability_rating: Number(entry.reliability_rating ?? 0),
      notes: typeof entry.notes === "string" ? entry.notes : null,
    }))
  );

  const localEventRecord = teamMatches.reduce(
    (acc, match) => {
      if (match.red_score === null || match.blue_score === null) return acc;

      const onRed = match.red_teams.includes(teamNumber);
      const redScore = match.red_score ?? 0;
      const blueScore = match.blue_score ?? 0;

      if (redScore === blueScore) acc.ties += 1;
      else if ((onRed && redScore > blueScore) || (!onRed && blueScore > redScore)) {
        acc.wins += 1;
      } else {
        acc.losses += 1;
      }
      return acc;
    },
    { wins: 0, losses: 0, ties: 0 }
  );

  const localPlayed =
    localEventRecord.wins + localEventRecord.losses + localEventRecord.ties;
  const localWinRate = localPlayed > 0 ? localEventRecord.wins / localPlayed : null;

  const [sbTeam, sbCurrentYear, sbThisEvent] = await Promise.all([
    fetchStatbotics(`/team/${teamNumber}`),
    fetchStatbotics(`/team_year/${teamNumber}/${event.year}`),
    fetchStatbotics(`/team_event/${teamNumber}/${encodeURIComponent(eventKey)}`),
  ]);

  const rookieYearRaw = toNumber(getNested(sbTeam, ["rookie_year"]));
  const rookieYear =
    rookieYearRaw !== null ? Math.trunc(rookieYearRaw) : null;
  const yearsActive =
    rookieYear !== null && event.year >= rookieYear
      ? event.year - rookieYear + 1
      : null;

  const pastYears: number[] = [];
  const earliestYear = rookieYear !== null ? Math.max(rookieYear, event.year - 3) : event.year - 3;
  for (let year = event.year - 1; year >= earliestYear; year -= 1) {
    pastYears.push(year);
  }

  const pastSeasonData = await Promise.all(
    pastYears.map(async (year) => ({
      year,
      data: await fetchStatbotics(`/team_year/${teamNumber}/${year}`),
    }))
  );

  const locationFromStatbotics = [
    toStringSafe(getNested(sbTeam, ["city"])),
    toStringSafe(getNested(sbTeam, ["state_prov"])) ??
      toStringSafe(getNested(sbTeam, ["state"])),
    toStringSafe(getNested(sbTeam, ["country"])),
  ]
    .filter((part): part is string => Boolean(part))
    .join(", ");

  const locationFromLocal = [localTeam?.city, localTeam?.state]
    .filter((part): part is string => Boolean(part))
    .join(", ");

  const responsePayload = {
    event: {
      key: eventKey,
      name: event.name,
      year: event.year,
      location: event.location,
    },
    ourTeamNumber: org.team_number ?? null,
    team: {
      teamNumber,
      teamName:
        toStringSafe(getNested(sbTeam, ["name"])) ??
        localTeam?.name ??
        null,
      rookieYear,
      yearsActive,
      location:
        locationFromStatbotics ||
        locationFromLocal ||
        event.location ||
        null,
    },
    localContext: {
      eventStats: {
        epa: localStats?.epa ?? null,
        autoEpa: localStats?.auto_epa ?? null,
        teleopEpa: localStats?.teleop_epa ?? null,
        endgameEpa: localStats?.endgame_epa ?? null,
        winRate: localStats?.win_rate ?? localWinRate,
        lastSyncedAt: localStats?.last_synced_at ?? null,
      },
      eventRecord: {
        wins: localEventRecord.wins,
        losses: localEventRecord.losses,
        ties: localEventRecord.ties,
        played: localPlayed,
        winRate: localWinRate !== null ? roundOne(localWinRate * 100) : null,
      },
      scoutingSummary,
      recentScoutingNotes: scoutingSummary?.notes ?? [],
    },
    statbotics: {
      profile: {
        nickname: toStringSafe(getNested(sbTeam, ["nickname"])),
        website: toStringSafe(getNested(sbTeam, ["website"])),
        country: toStringSafe(getNested(sbTeam, ["country"])),
        city: toStringSafe(getNested(sbTeam, ["city"])),
        state:
          toStringSafe(getNested(sbTeam, ["state_prov"])) ??
          toStringSafe(getNested(sbTeam, ["state"])),
        overallRecord: extractRecord(getNested(sbTeam, ["record"])),
        normEpa: {
          mean: toNumber(getNested(sbTeam, ["norm_epa", "mean"])),
          max: toNumber(getNested(sbTeam, ["norm_epa", "max"])),
        },
      },
      currentSeason: seasonSummary(event.year, sbCurrentYear),
      recentSeasons: pastSeasonData.map((season) =>
        seasonSummary(season.year, season.data)
      ),
      currentEvent: {
        record:
          extractRecord(getNested(sbThisEvent, ["record", "season"])) ??
          extractRecord(getNested(sbThisEvent, ["record"])),
        epaBreakdown: {
          total: fetchBreakdownNumber(
            getNested(sbThisEvent, ["epa", "breakdown"]),
            "total_points"
          ),
          auto: fetchBreakdownNumber(
            getNested(sbThisEvent, ["epa", "breakdown"]),
            "auto_points"
          ),
          teleop: fetchBreakdownNumber(
            getNested(sbThisEvent, ["epa", "breakdown"]),
            "teleop_points"
          ),
          endgame: fetchBreakdownNumber(
            getNested(sbThisEvent, ["epa", "breakdown"]),
            "endgame_points"
          ),
        },
      },
    },
  };

  const systemPrompt = `You are PitPilot Team Briefing for FRC.

${buildFrcGamePrompt(event.year)}

Generate a concise markdown briefing for a single team using ONLY the provided JSON data.

Required output format:
## Team Introduction
- Years active
- Location
- Overall performance in past events/seasons
- Performance at this event

## Alliance Fit
- 2 to 4 bullets on strengths, role fit, and where this team helps most.

## Risks And Unknowns
- 1 to 3 bullets covering reliability concerns or missing data.

Rules:
- Start with a 2-3 sentence narrative introduction before the bullet lists.
- Prefer concrete numbers when available.
- Use professional, respectful language throughout.
- Do not use demeaning, insulting, sarcastic, or mocking phrasing.
- Be candid and honest about performance limitations when data supports it.
- If the team appears to be a weaker alliance option, state it professionally (e.g., "currently not among the most desirable picks").
- Avoid comparative labels like "lower", "low-tier", "below average", or similar phrasing.
- Prefer neutral alternatives such as "currently limited scoring output" or "not a top-priority pick for this role."
- If data is missing, explicitly say "Data unavailable".
- Do not frame limited scouting data as a team weakness or risk.
- If scouting data is limited, use a professional note such as: "Additional scouting entries would enable a more complete report."
- Do not invent stats or history.
- Do not use location-based claims as strengths (for example: "local knowledge", "familiar with this venue", "home crowd advantage").
- For Alliance Fit bullets, only use performance evidence from the provided JSON (EPA, record, scouting), not geography.
- Keep total output under 260 words.
- End with exactly one closing sentence after all sections.
- No emojis.`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 700,
      temperature: 0.2,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify(responsePayload),
        },
      ],
    });

    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!reply) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, reply },
      { headers: limitHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

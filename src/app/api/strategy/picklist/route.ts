import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { PickListContentSchema, type PickListContent } from "@/types/strategy";
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

function parseAiJson(text: string): unknown {
  // Try raw first.
  try {
    return JSON.parse(text);
  } catch {
    // Continue to fallback parsing.
  }

  // Handle fenced blocks like ```json ... ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  // Pull the outer-most JSON object.
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in AI response");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

type TeamProfile = {
  autoStartPositions: Array<"left" | "center" | "right">;
  shootingRanges: Array<"close" | "mid" | "long">;
  intakeAbilities: Array<"floor" | "station" | "chute" | "shelf">;
  cycleTimeRating: number | null;
  reliabilityRating: number | null;
  preferredRole: "scorer" | "defender" | "support" | "versatile" | null;
  notes: string | null;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeTeamProfile(value: unknown): TeamProfile | null {
  const source = asObject(value);
  if (!source) return null;

  const autoStartPositions = Array.isArray(source.autoStartPositions)
    ? source.autoStartPositions.filter(
        (item): item is "left" | "center" | "right" =>
          item === "left" || item === "center" || item === "right"
      )
    : [];

  const legacyShootingRange =
    source.shootingRange === "close" ||
    source.shootingRange === "mid" ||
    source.shootingRange === "long"
      ? source.shootingRange
      : null;

  const shootingRanges = Array.isArray(source.shootingRanges)
    ? source.shootingRanges.filter(
        (item): item is "close" | "mid" | "long" =>
          item === "close" || item === "mid" || item === "long"
      )
    : legacyShootingRange
    ? [legacyShootingRange]
    : [];

  const intakeAbilities = Array.isArray(source.intakeAbilities)
    ? source.intakeAbilities.filter(
        (item): item is "floor" | "station" | "chute" | "shelf" =>
          item === "floor" ||
          item === "station" ||
          item === "chute" ||
          item === "shelf"
      )
    : [];

  const cycleTimeRaw = Number(source.cycleTimeRating);
  const reliabilityRaw = Number(source.reliabilityRating);
  const cycleTimeRating =
    Number.isFinite(cycleTimeRaw) && cycleTimeRaw >= 1 && cycleTimeRaw <= 5
      ? Math.round(cycleTimeRaw)
      : null;
  const reliabilityRating =
    Number.isFinite(reliabilityRaw) &&
    reliabilityRaw >= 1 &&
    reliabilityRaw <= 5
      ? Math.round(reliabilityRaw)
      : null;

  const preferredRole =
    source.preferredRole === "scorer" ||
    source.preferredRole === "defender" ||
    source.preferredRole === "support" ||
    source.preferredRole === "versatile"
      ? source.preferredRole
      : null;

  const notes =
    typeof source.notes === "string" && source.notes.trim().length > 0
      ? source.notes.trim().slice(0, 400)
      : null;

  const hasSignal =
    autoStartPositions.length > 0 ||
    shootingRanges.length > 0 ||
    intakeAbilities.length > 0 ||
    cycleTimeRating !== null ||
    reliabilityRating !== null ||
    preferredRole !== null ||
    notes !== null;
  if (!hasSignal) return null;

  return {
    autoStartPositions,
    shootingRanges,
    intakeAbilities,
    cycleTimeRating,
    reliabilityRating,
    preferredRole,
    notes,
  };
}

function quantile(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const index = (sortedValues.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
}

function normalizePickListRoles(content: PickListContent): PickListContent {
  const sortedEpa = content.rankings
    .map((team) => team.epa.total)
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (sortedEpa.length < 4) return content;

  // Slightly more permissive than strict median so "support" is not overused.
  const scorerFloor = quantile(sortedEpa, 0.45);

  const normalizedRankings = content.rankings.map((team) => {
    if (
      team.role === "support" &&
      (team.epa.total >= scorerFloor || team.rank <= 8)
    ) {
      return { ...team, role: "scorer" as const };
    }
    return team;
  });

  return { ...content, rankings: normalizedRankings };
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get user's org and team number
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, organizations(team_number, plan_tier)")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }

  const orgMeta = Array.isArray(profile.organizations)
    ? profile.organizations[0]
    : profile.organizations;

  const teamAiPromptLimits = await getTeamAiPromptLimits(supabase);
  const aiLimit = getTeamAiLimitFromSettings(
    teamAiPromptLimits,
    orgMeta?.plan_tier
  );
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

  const requestBody = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  const eventId =
    typeof requestBody?.eventId === "string" ? requestBody.eventId : null;
  const teamProfile = normalizeTeamProfile(requestBody?.teamProfile);
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  // Get event
  const { data: event } = await supabase
    .from("events")
    .select("id, name, year")
    .eq("id", eventId)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Get all team stats for this event
  const { data: stats } = await supabase
    .from("team_event_stats")
    .select("*")
    .eq("event_id", eventId)
    .order("epa", { ascending: false, nullsFirst: false });

  if (!stats || stats.length === 0) {
    return NextResponse.json(
      { error: "No team stats available. Sync stats first." },
      { status: 400 }
    );
  }

  // Get team names
  const teamNumbers = stats.map((s) => s.team_number);
  const { data: teams } = await supabase
    .from("teams")
    .select("team_number, name")
    .in("team_number", teamNumbers);

  const teamNames: Record<number, string> = {};
  for (const t of teams ?? []) {
    teamNames[t.team_number] = t.name ?? `Team ${t.team_number}`;
  }

  // Get all scouting entries for these teams in this event (org-scoped via RLS)
  const { data: matchesInEvent } = await supabase
    .from("matches")
    .select("id")
    .eq("event_id", eventId);

  const matchIds = matchesInEvent?.map((m) => m.id) ?? [];

  const scoutingEntries =
    matchIds.length > 0
      ? (
          await supabase
            .from("scouting_entries")
            .select(
              "team_number, auto_score, teleop_score, endgame_score, defense_rating, reliability_rating, notes"
            )
            .eq("org_id", profile.org_id)
            .in("match_id", matchIds)
        ).data ?? []
      : [];

  // Build scouting map: team_number -> array of entries
  const scoutingMap: Record<
    number,
    Array<{
      auto_score: number;
      teleop_score: number;
      endgame_score: number;
      defense_rating: number;
      reliability_rating: number;
      notes: string | null;
    }>
  > = {};
  for (const e of scoutingEntries ?? []) {
    if (!scoutingMap[e.team_number]) scoutingMap[e.team_number] = [];
    scoutingMap[e.team_number].push({
      auto_score: e.auto_score,
      teleop_score: e.teleop_score,
      endgame_score: e.endgame_score,
      defense_rating: e.defense_rating,
      reliability_rating: e.reliability_rating,
      notes: e.notes,
    });
  }

  const scoutingSummaryMap: Record<
    number,
    ReturnType<typeof summarizeScouting>
  > = {};
  for (const teamNumber of teamNumbers) {
    scoutingSummaryMap[teamNumber] = summarizeScouting(
      scoutingMap[teamNumber] ?? []
    );
  }

  // Build stats map
  const statsData = stats.map((s) => ({
    teamNumber: s.team_number,
    teamName: teamNames[s.team_number] ?? `Team ${s.team_number}`,
    epa: s.epa,
    auto_epa: s.auto_epa,
    teleop_epa: s.teleop_epa,
    endgame_epa: s.endgame_epa,
    win_rate: s.win_rate,
    scoutingSummary: scoutingSummaryMap[s.team_number] ?? null,
  }));

  const orgTeamNumber = orgMeta?.team_number ?? null;

  const sortedEventEpas = statsData
    .map((team) => team.epa)
    .filter((value): value is number => typeof value === "number")
    .sort((a, b) => a - b);
  const roleGuidance = {
    scorerEpaFloor: Number(quantile(sortedEventEpas, 0.45).toFixed(2)),
    supportEpaCeiling: Number(quantile(sortedEventEpas, 0.25).toFixed(2)),
  };

  const promptData = {
    yourTeamNumber: orgTeamNumber,
    eventName: event.name,
    eventYear: event.year,
    yourTeamProfile: teamProfile,
    teams: statsData,
    roleGuidance,
  };

  const systemPrompt = `You are an expert FRC (FIRST Robotics Competition) alliance selection strategist. Generate a ranked pick list for alliance selection.

${buildFrcGamePrompt(event.year)}

Context: In FRC, the top 8 seeded teams each pick 2 alliance partners in a serpentine draft. Teams want partners whose strengths complement their own.

You will receive:
- The user's team number (they want picks that complement THEIR robot)
- Optional profile data for the user's robot (starting positions, shooting ranges, intake abilities, cycle speed, reliability, preferred role, notes)
- EPA (Expected Points Added) statistics from Statbotics for every team at the event
- Scouting summaries per team: { count, avg_auto, avg_teleop, avg_endgame, avg_defense, avg_reliability, notes[] } or null if no data

Rank ALL teams at the event (excluding the user's team) from most desirable to least desirable alliance partner.

Consider:
1. Raw performance (EPA, win rate)
2. Complementarity with the user's robot (if their team data is available)
3. Reliability and consistency from scouting data
4. Role fit (scorer vs defender vs support)
5. Auto-teleop-endgame balance to build a well-rounded alliance

Respond with ONLY valid JSON matching this exact structure:
{
  "yourTeamNumber": number,
  "summary": "2-3 sentence overview of your alliance strategy recommendation",
  "rankings": [
    {
      "rank": 1,
      "teamNumber": number,
      "overallScore": number (0-100, your composite ranking score),
      "epa": { "total": number, "auto": number, "teleop": number, "endgame": number },
      "winRate": number or null,
      "synergy": "high", "medium", or "low",
      "synergyReason": "Brief explanation of why they complement or don't complement your team",
      "strengths": ["strength1", "strength2"],
      "weaknesses": ["weakness1"],
      "role": "scorer", "defender", "support", or "versatile",
      "scoutingSummary": "Brief summary of scouting observations or 'No scouting data'",
      "pickReason": "1-sentence reason this team is ranked here"
    }
  ]
}

IMPORTANT:
- Rank EVERY team (exclude only the user's own team)
- overallScore should be 0-100, with top pick around 90-100 and worst around 10-20
- Use professional, respectful language for every team.
- Do not use demeaning, insulting, sarcastic, or mocking phrasing.
- Frame negatives as strategic tradeoffs or constraints, not personal criticism.
- Be candid and honest about performance gaps.
- If a team is a weaker option, state that clearly in professional terms (e.g., "currently not among the most desirable picks").
- Avoid comparative labels like "lower", "low-tier", "below average", or similar phrasing.
- Prefer neutral alternatives such as "currently limited scoring output" or "not a top-priority pick for this role."
- If no scouting data exists for a team, base analysis on EPA stats only
- If yourTeamProfile is provided, use it to improve synergy judgments and pick reasoning.
- If yourTeamProfile includes multiple shooting ranges or intake abilities, treat that as flexibility when evaluating fit.
- If yourTeamProfile is missing/incomplete, proceed with available data and do not fabricate missing profile fields.
- Role balance guidance:
  - Use "scorer" for teams with mid/high offensive output; do NOT reserve it only for elite teams.
  - If total EPA is at/above roleGuidance.scorerEpaFloor, default to "scorer" unless there is strong contrary evidence.
  - Reserve "support" for clearly lower-output teams (typically near/below roleGuidance.supportEpaCeiling) or specialized non-scoring roles.
  - If uncertain between "scorer" and "support", choose "scorer".
- Do not list limited/missing scouting data as a team weakness.
- Do not treat limited/missing scouting data as a risk factor.
- When scouting is limited, use professional wording in scoutingSummary like: "Additional scouting entries would enable a more complete report."
- Be specific in synergy reasons — reference actual stats
- Do not use location-based claims as strengths/pros/synergy (for example: "local knowledge", "familiar with this venue", "home crowd advantage").
- For strengths, pickReason, and synergyReason, use only provided performance data (EPA, record, scouting notes/profile).
- The user's team number may be null if not set; in that case, rank purely on individual team strength`;

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify(promptData),
        },
      ],
    });

    const textOutput = message.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    if (!textOutput) {
      return NextResponse.json(
        { error: "No text response from AI" },
        { status: 500 }
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = parseAiJson(textOutput);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON" },
        { status: 500 }
      );
    }
    const parsed = PickListContentSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.warn("Invalid AI pick list schema:", parsed.error.flatten());
      return NextResponse.json(
        { error: "AI response did not match expected schema" },
        { status: 500 }
      );
    }
    const pickListContent = normalizePickListRoles(parsed.data);

    // Upsert the pick list
    const { data: pickList, error: pickListError } = await supabase
      .from("pick_lists")
      .upsert(
        {
          event_id: eventId,
          org_id: profile.org_id,
          content: JSON.parse(JSON.stringify(pickListContent)),
        },
        { onConflict: "event_id,org_id" }
      )
      .select("id")
      .single();

    if (pickListError) {
      return NextResponse.json(
        { error: pickListError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        pickList: pickListContent,
        pickListId: pickList.id,
      },
      { headers: limitHeaders }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

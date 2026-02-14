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

  const { eventKey, message } = await request.json();
  if (!eventKey || typeof eventKey !== "string") {
    return NextResponse.json({ error: "eventKey is required" }, { status: 400 });
  }
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("id, name, year, location")
    .eq("tba_key", eventKey)
    .single();

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const orgTeamNumber = org.team_number ?? null;

  const { data: eventTeams } = await supabase
    .from("event_teams")
    .select("team_number")
    .eq("event_id", event.id);

  const teamNumbers = new Set<number>(
    (eventTeams ?? []).map((t) => t.team_number)
  );

  if (teamNumbers.size === 0) {
    const { data: matches } = await supabase
      .from("matches")
      .select("red_teams, blue_teams")
      .eq("event_id", event.id);

    if (matches) {
      for (const match of matches) {
        match.red_teams.forEach((t: number) => teamNumbers.add(t));
        match.blue_teams.forEach((t: number) => teamNumbers.add(t));
      }
    }
  }

  const teamList = Array.from(teamNumbers);

  const { data: stats } = await supabase
    .from("team_event_stats")
    .select(
      "team_number, epa, auto_epa, teleop_epa, endgame_epa, win_rate, last_synced_at"
    )
    .eq("event_id", event.id)
    .in("team_number", teamList.length > 0 ? teamList : [0]);

  const statsMap = new Map(
    (stats ?? []).map((s) => [
      s.team_number,
      {
        epa: s.epa,
        auto_epa: s.auto_epa,
        teleop_epa: s.teleop_epa,
        endgame_epa: s.endgame_epa,
        win_rate: s.win_rate,
        last_synced_at: s.last_synced_at,
      },
    ])
  );

  const { data: scoutingEntries } = await supabase
    .from("scouting_entries")
    .select(
      "team_number, auto_score, teleop_score, endgame_score, defense_rating, reliability_rating, notes"
    )
    .eq("org_id", profile.org_id)
    .in("team_number", teamList.length > 0 ? teamList : [0]);

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
  for (const entry of scoutingEntries ?? []) {
    if (!scoutingMap[entry.team_number]) scoutingMap[entry.team_number] = [];
    scoutingMap[entry.team_number].push({
      auto_score: entry.auto_score,
      teleop_score: entry.teleop_score,
      endgame_score: entry.endgame_score,
      defense_rating: entry.defense_rating,
      reliability_rating: entry.reliability_rating,
      notes: entry.notes,
    });
  }

  const scoutingSummary = teamList.map((team) => ({
    teamNumber: team,
    summary: summarizeScouting(scoutingMap[team] ?? []),
  }));

  const teamContext = teamList.map((team) => ({
    teamNumber: team,
    stats: statsMap.get(team) ?? null,
    scouting: scoutingSummary.find((s) => s.teamNumber === team)?.summary ?? null,
  }));

  const systemPrompt = `You are PitPilot Strategy Chat for FRC/FTC.

${buildFrcGamePrompt(event.year)}

Rules:
- Answer ONLY robotics scouting and match strategy questions for this event.
- If asked about non-robotics topics (math, homework, general trivia), politely redirect to robotics strategy.
- Ground answers in the provided EPA stats and scouting summaries. If data is missing, say so.
- Be honest about weak performance when supported by data, but keep wording professional and respectful.
- Avoid comparative labels like "lower", "low-tier", "below average", or similar phrasing.
- Prefer neutral alternatives such as "currently limited scoring output" or "not a top-priority pick for this role."
- Do not cite location-based advantages (for example: "local knowledge", "familiar with this venue", "home crowd advantage") unless explicit supporting data is provided.
- Remind the user that more scouting entries improve response quality when relevant.
- Do not use emojis or markdown. Use short, plain-text responses.
- If asked what model you are, say: "This assistant runs on a Sonnet 4-based model that is being fine-tuned on FRC game data; full fine-tuning is planned soon."`;

  const userPayload = {
    event: {
      key: eventKey,
      name: event.name,
      year: event.year,
      location: event.location,
    },
    ourTeamNumber: orgTeamNumber,
    teams: teamContext,
    question: message,
  };

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 700,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify(userPayload),
        },
      ],
    });

    const textOutput = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    if (!textOutput) {
      return NextResponse.json({ error: "No response from AI" }, { status: 500 });
    }

    return NextResponse.json(
      { success: true, reply: textOutput.trim() },
      { headers: limitHeaders }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { BriefContentSchema } from "@/types/strategy";
import { summarizeScouting } from "@/lib/scouting-summary";
import { checkRateLimit, retryAfterSeconds } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get user's org + role
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "No organization found" }, { status: 400 });
  }
  if (profile.role === "scout") {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  const limit = checkRateLimit(
    `strategy-brief:${profile.org_id}`,
    60_000,
    5
  );
  if (!limit.allowed) {
    const retryAfter = retryAfterSeconds(limit.resetAt);
    return NextResponse.json(
      { error: "Rate limit exceeded. Please try again soon." },
      { status: 429, headers: { "Retry-After": retryAfter.toString() } }
    );
  }

  const { matchId } = await request.json();
  if (!matchId) {
    return NextResponse.json({ error: "matchId is required" }, { status: 400 });
  }

  // Get match data
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*, events(id, name, tba_key)")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  // Get all 6 teams
  const allTeams = [...match.red_teams, ...match.blue_teams];

  // Get EPA stats for all teams in this event
  const { data: stats } = await supabase
    .from("team_event_stats")
    .select("*")
    .eq("event_id", match.event_id)
    .in("team_number", allTeams);

  // Get scouting entries for these teams (org-scoped via RLS)
  const { data: scoutingEntries } = await supabase
    .from("scouting_entries")
    .select("team_number, auto_score, teleop_score, endgame_score, defense_rating, reliability_rating, notes")
    .eq("org_id", profile.org_id)
    .in("team_number", allTeams);

  // Build data maps
  const statsMap: Record<number, {
    epa: number | null;
    auto_epa: number | null;
    teleop_epa: number | null;
    endgame_epa: number | null;
    win_rate: number | null;
  }> = {};
  for (const s of stats ?? []) {
    statsMap[s.team_number] = {
      epa: s.epa,
      auto_epa: s.auto_epa,
      teleop_epa: s.teleop_epa,
      endgame_epa: s.endgame_epa,
      win_rate: s.win_rate,
    };
  }

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

  const scoutingSummary: Record<number, ReturnType<typeof summarizeScouting>> =
    {};
  for (const team of allTeams) {
    scoutingSummary[team] = summarizeScouting(scoutingMap[team] ?? []);
  }

  // Build prompt data
  const promptData = {
    match: {
      comp_level: match.comp_level,
      match_number: match.match_number,
      red_teams: match.red_teams,
      blue_teams: match.blue_teams,
      red_score: match.red_score,
      blue_score: match.blue_score,
    },
    stats: statsMap,
    scouting: scoutingSummary,
  };

  const systemPrompt = `You are an expert FRC (FIRST Robotics Competition) strategy analyst. Analyze the provided match data and generate a strategic brief.

You will receive:
- Match details (alliances, comp level)
- EPA (Expected Points Added) statistics from Statbotics for each team (higher is better)
- Scouting summaries per team: { count, avg_auto, avg_teleop, avg_endgame, avg_defense, avg_reliability, notes[] } or null if no data

Respond with ONLY valid JSON matching this exact structure:
{
  "prediction": {
    "winner": "red" or "blue",
    "confidence": "high", "medium", or "low",
    "redScore": estimated total score,
    "blueScore": estimated total score
  },
  "redAlliance": {
    "totalEPA": combined EPA,
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1"],
    "keyPlayers": [teamNumber1]
  },
  "blueAlliance": {
    "totalEPA": combined EPA,
    "strengths": ["strength1", "strength2"],
    "weaknesses": ["weakness1"],
    "keyPlayers": [teamNumber1]
  },
  "teamAnalysis": [
    {
      "teamNumber": number,
      "alliance": "red" or "blue",
      "epaBreakdown": { "total": number, "auto": number, "teleop": number, "endgame": number },
      "scoutingInsights": "Summary of scouting notes or 'No scouting data available'",
      "role": "scorer", "defender", or "support"
    }
  ],
  "strategy": {
    "redRecommendations": ["actionable recommendation 1", "recommendation 2"],
    "blueRecommendations": ["actionable recommendation 1", "recommendation 2"],
    "keyMatchups": ["Team X vs Team Y description"]
  }
}

Guidelines:
- If EPA data is missing for a team, note it and base analysis on scouting data
- If scouting data is missing, note it and base analysis on EPA stats
- Predictions should factor in both EPA and scouting observations
- Recommendations should be specific and actionable for drive teams
- Keep insights concise but informative`;

  try {
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: JSON.stringify(promptData),
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response from AI" }, { status: 500 });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(textBlock.text);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON" },
        { status: 500 }
      );
    }
    const parsed = BriefContentSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.warn("Invalid AI brief schema:", parsed.error.flatten());
      return NextResponse.json(
        { error: "AI response did not match expected schema" },
        { status: 500 }
      );
    }
    const briefContent = parsed.data;

    // Try to get ML model prediction (graceful fallback if server unavailable)
    try {
      const predictionUrl =
        process.env.PREDICTION_API_URL || "http://localhost:8000";
      const mlResp = await fetch(`${predictionUrl}/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          red_teams: match.red_teams,
          blue_teams: match.blue_teams,
          event_key: match.events?.tba_key ?? "",
          comp_level:
            match.comp_level === "qm"
              ? 0
              : match.comp_level === "sf"
              ? 2
              : match.comp_level === "f"
              ? 3
              : 1,
          event_week: 0,
        }),
        signal: AbortSignal.timeout(10000),
      });
      if (mlResp.ok) {
        const mlData = await mlResp.json();
        briefContent.mlPrediction = {
          winner: mlData.winner,
          winProbability: mlData.win_probability,
          redScore: mlData.red_score,
          blueScore: mlData.blue_score,
        };
      }
    } catch {
      // ML prediction server unavailable — continue without it
    }

    // Upsert the brief
    const { data: brief, error: briefError } = await supabase
      .from("strategy_briefs")
      .upsert(
        {
          match_id: matchId,
          org_id: profile.org_id,
          content: JSON.parse(JSON.stringify(briefContent)),
        },
        { onConflict: "match_id,org_id" }
      )
      .select("id")
      .single();

    if (briefError) {
      return NextResponse.json({ error: briefError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      brief: briefContent,
      briefId: brief.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

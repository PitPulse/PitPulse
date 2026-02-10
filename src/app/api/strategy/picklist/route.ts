import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { PickListContentSchema } from "@/types/strategy";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get user's org, role, and team number
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id, role, organizations(team_number)")
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
    `strategy-picklist:${profile.org_id}`,
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

  const { eventId } = await request.json();
  if (!eventId) {
    return NextResponse.json({ error: "eventId is required" }, { status: 400 });
  }

  // Get event
  const { data: event } = await supabase
    .from("events")
    .select("id, name")
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

  const orgTeamNumber = profile.organizations?.team_number ?? null;

  const promptData = {
    yourTeamNumber: orgTeamNumber,
    eventName: event.name,
    teams: statsData,
  };

  const systemPrompt = `You are an expert FRC (FIRST Robotics Competition) alliance selection strategist. Generate a ranked pick list for alliance selection.

Context: In FRC, the top 8 seeded teams each pick 2 alliance partners in a serpentine draft. Teams want partners whose strengths complement their own.

You will receive:
- The user's team number (they want picks that complement THEIR robot)
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
- If no scouting data exists for a team, base analysis on EPA stats only
- Be specific in synergy reasons — reference actual stats
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

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text response from AI" },
        { status: 500 }
      );
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
    const parsed = PickListContentSchema.safeParse(parsedJson);
    if (!parsed.success) {
      console.warn("Invalid AI pick list schema:", parsed.error.flatten());
      return NextResponse.json(
        { error: "AI response did not match expected schema" },
        { status: 500 }
      );
    }
    const pickListContent = parsed.data;

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

    return NextResponse.json({
      success: true,
      pickList: pickListContent,
      pickListId: pickList.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

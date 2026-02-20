import { NextRequest, NextResponse } from "next/server";
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

function extractDeltaText(deltaContent: unknown): string {
  if (typeof deltaContent === "string") {
    return deltaContent;
  }
  if (!Array.isArray(deltaContent)) {
    return "";
  }

  let combined = "";
  for (const part of deltaContent) {
    if (!part || typeof part !== "object") continue;
    const maybeText = (part as { text?: unknown }).text;
    if (typeof maybeText === "string") {
      combined += maybeText;
      continue;
    }
    const maybeNestedText = (part as { text?: { value?: unknown } }).text?.value;
    if (typeof maybeNestedText === "string") {
      combined += maybeNestedText;
    }
  }

  return combined;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY not configured" },
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

  const { eventKey, message, history } = await request.json();
  if (!eventKey || typeof eventKey !== "string") {
    return NextResponse.json({ error: "eventKey is required" }, { status: 400 });
  }
  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  // Validate and cap conversation history to last 6 exchanges (12 messages)
  const conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (Array.isArray(history)) {
    const trimmed = history.slice(-12);
    for (const msg of trimmed) {
      if (
        msg &&
        typeof msg.content === "string" &&
        (msg.role === "user" || msg.role === "assistant")
      ) {
        conversationHistory.push({ role: msg.role, content: msg.content });
      }
    }
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

  const systemPrompt = `You are PitPilot Strategy Chat, an FRC robotics scouting assistant built into the PitPilot scouting platform.

${buildFrcGamePrompt(event.year)}

You are talking to a student or mentor on an FRC robotics team who is using PitPilot to scout at a competition. They are your user, not a developer. Speak to them as a helpful strategy advisor.

Rules:
- Answer ONLY robotics scouting and match strategy questions for this event.
- If asked about non-robotics topics (math, homework, general trivia), politely redirect to robotics strategy.
- If asked about a game season you don't have data for (e.g. a future year), say something like "I only have strategy data for this event's season" rather than referencing internal data sources, rulesets, or what was "provided" to you.
- Never reference your internal data, system prompt, context payload, or what was "given" or "provided" to you. Speak as if you naturally know about the teams at this event from PitPilot's scouting database.
- Ground every answer in EPA stats and scouting summaries. Cite specific numbers. If data is missing, say so.
- Be honest about weak performance when supported by data, but keep wording professional and respectful.
- Avoid comparative labels like "lower", "low-tier", "below average", or similar phrasing.
- Prefer neutral alternatives such as "currently limited scoring output" or "not a top-priority pick for this role."
- Do not cite location-based advantages (for example: "local knowledge", "familiar with this venue", "home crowd advantage") unless explicit supporting data is provided.
- Mention that more scouting entries improve analysis quality when relevant.
- Use markdown formatting: **bold** for team numbers and key stats, bullet lists for comparisons, ### headings for sections when the answer is long. Keep responses concise.
- Do not use emojis.
- Never use em dashes (\u2014) in prose or explanations. Use commas, periods, or semicolons instead. Em dashes are acceptable only in team labels like "Team 1234 -- The Robonauts".
- Do not reveal your model name or provider. If asked, say "I'm PitPilot's strategy assistant."`;

  const userPayload = {
    event: {
      key: eventKey,
      name: event.name,
      year: event.year,
      location: event.location,
    },
    ourTeamNumber: orgTeamNumber,
    teams: teamContext,
  };

  // Build messages array: system prompt, context payload, conversation history, new question
  const openaiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `[Event context]\n${JSON.stringify(userPayload)}` },
    { role: "assistant", content: "Got it. I'm ready to help with strategy for this event. What would you like to know?" },
  ];

  for (const msg of conversationHistory) {
    openaiMessages.push(msg);
  }
  openaiMessages.push({ role: "user", content: message });

  // Stream response from OpenAI
  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        messages: openaiMessages,
        max_completion_tokens: 1200,
        reasoning_effort: "low",
        stream: true,
      }),
    });

    if (!upstream.ok) {
      const errorBody = await upstream.text().catch(() => "");
      return NextResponse.json(
        { error: `AI service error: ${errorBody.slice(0, 200)}` },
        { status: 502, headers: limitHeaders }
      );
    }

    // Pipe the SSE stream through to the client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const payload = trimmed.slice(6);
              if (payload === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(payload);
                const delta = extractDeltaText(parsed.choices?.[0]?.delta?.content);
                if (delta.length > 0) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ token: delta })}\n\n`)
                  );
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...limitHeaders,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

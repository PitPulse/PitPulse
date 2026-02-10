import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit, retryAfterSeconds } from "@/lib/rate-limit";

const PREDICTION_API_URL =
  process.env.PREDICTION_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = checkRateLimit(`predict:${user.id}`, 60_000, 30);
    if (!limit.allowed) {
      const retryAfter = retryAfterSeconds(limit.resetAt);
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again soon." },
        { status: 429, headers: { "Retry-After": retryAfter.toString() } }
      );
    }

    const body = await request.json();

    const { red_teams, blue_teams, event_key, comp_level, event_week } = body;

    if (
      !Array.isArray(red_teams) ||
      !Array.isArray(blue_teams) ||
      red_teams.length !== 3 ||
      blue_teams.length !== 3
    ) {
      return NextResponse.json(
        { error: "Each alliance must have exactly 3 teams" },
        { status: 400 }
      );
    }

    const resp = await fetch(`${PREDICTION_API_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        red_teams,
        blue_teams,
        event_key: event_key ?? "",
        comp_level: comp_level ?? 0,
        event_week: event_week ?? 0,
      }),
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json(
        { error: `Prediction server error: ${err}` },
        { status: resp.status }
      );
    }

    const prediction = await resp.json();
    return NextResponse.json(prediction);
  } catch (error) {
    // Graceful fallback — prediction server may not be running
    console.warn("Prediction server unavailable:", error);
    return NextResponse.json(
      { error: "Prediction server unavailable", prediction: null },
      { status: 503 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildRateLimitHeaders,
  checkRateLimit,
  retryAfterSeconds,
} from "@/lib/rate-limit";

const LOOKUP_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const LOOKUP_RATE_LIMIT_MAX = 15; // 15 lookups per minute per IP

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  const number = request.nextUrl.searchParams.get("number");

  if (!number || !/^\d{1,5}$/.test(number)) {
    return NextResponse.json(
      { error: "Invalid team number" },
      { status: 400 }
    );
  }

  const clientIp = getClientIp(request);
  const limit = await checkRateLimit(
    `team-lookup:${clientIp}`,
    LOOKUP_RATE_WINDOW_MS,
    LOOKUP_RATE_LIMIT_MAX
  );
  const limitHeaders = buildRateLimitHeaders(limit, LOOKUP_RATE_LIMIT_MAX);

  if (!limit.allowed) {
    const retryAfter = retryAfterSeconds(limit.resetAt);
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: { ...limitHeaders, "Retry-After": retryAfter.toString() },
      }
    );
  }

  const teamNumber = parseInt(number);

  // Check if already claimed by an org
  const supabase = await createClient();
  const { data: existingOrg } = await supabase
    .from("organizations")
    .select("id")
    .eq("team_number", teamNumber)
    .maybeSingle();

  // Fetch from TBA
  const tbaKey = process.env.TBA_API_KEY;
  let tbaName: string | null = null;

  if (tbaKey) {
    try {
      const res = await fetch(
        `https://www.thebluealliance.com/api/v3/team/frc${teamNumber}`,
        {
          headers: { "X-TBA-Auth-Key": tbaKey },
          next: { revalidate: 3600 }, // Cache for 1 hour
        }
      );

      if (res.ok) {
        const data = await res.json();
        tbaName = data.nickname ?? data.name ?? null;
      }
    } catch (error) {
      console.warn(
        `TBA lookup failed for team ${teamNumber}:`,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  return NextResponse.json(
    {
      team_number: teamNumber,
      name: tbaName,
      exists: tbaName !== null,
      taken: existingOrg !== null,
    },
    { headers: limitHeaders }
  );
}

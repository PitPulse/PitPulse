import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const number = request.nextUrl.searchParams.get("number");

  if (!number || !/^\d{1,5}$/.test(number)) {
    return NextResponse.json(
      { error: "Invalid team number" },
      { status: 400 }
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
    } catch {
      // TBA lookup failed — non-critical
    }
  }

  return NextResponse.json({
    team_number: teamNumber,
    name: tbaName,
    exists: tbaName !== null,
    taken: existingOrg !== null,
  });
}

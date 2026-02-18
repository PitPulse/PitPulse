import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { BriefContentSchema, type BriefContent } from "@/types/strategy";
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

type JsonObject = Record<string, unknown>;
type AllianceColor = "red" | "blue";
type PriorityLevel = "high" | "medium" | "low";

interface MatchBriefNormalizationContext {
  allTeams: number[];
  redTeams: number[];
  blueTeams: number[];
  statsMap: Record<
    number,
    {
      epa: number | null;
      auto_epa: number | null;
      teleop_epa: number | null;
      endgame_epa: number | null;
      win_rate: number | null;
    }
  >;
  scoutingSummary: Record<number, ReturnType<typeof summarizeScouting>>;
  scoutingCoverage: Record<
    number,
    {
      alliance: AllianceColor;
      entries: number;
      coverage: "none" | "limited" | "moderate" | "strong";
    }
  >;
}

function parseAiJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Continue to fallback parsing.
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in AI response");
  }

  return JSON.parse(candidate.slice(start, end + 1));
}

function asObject(value: unknown): JsonObject | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as JsonObject;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replaceAll(",", "").trim();
    if (normalized.length === 0) return null;
    const parsed = Number.parseFloat(normalized);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toNonEmptyString(item))
    .filter((item): item is string => item !== null);
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(value);
  }
  return output;
}

function toTeamNumber(value: unknown): number | null {
  const numeric = toFiniteNumber(value);
  if (numeric !== null) {
    const team = Math.trunc(numeric);
    return Number.isFinite(team) ? team : null;
  }
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (!match) return null;
    const parsed = Number.parseInt(match[0], 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toTeamNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => toTeamNumber(item))
    .filter((item): item is number => item !== null);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeAlliance(
  value: unknown,
  fallback: AllianceColor
): AllianceColor {
  const text = toNonEmptyString(value)?.toLowerCase() ?? "";
  if (text.includes("red")) return "red";
  if (text.includes("blue")) return "blue";
  return fallback;
}

function normalizePriority(
  value: unknown,
  fallback: PriorityLevel
): PriorityLevel {
  const text = toNonEmptyString(value)?.toLowerCase() ?? "";
  if (text.includes("high")) return "high";
  if (text.includes("med")) return "medium";
  if (text.includes("low")) return "low";
  return fallback;
}

function normalizeConfidence(
  value: unknown,
  scoreDiff: number,
  fallback: "high" | "medium" | "low"
): "high" | "medium" | "low" {
  const text = toNonEmptyString(value)?.toLowerCase() ?? "";
  if (text.includes("high")) return "high";
  if (text.includes("med")) return "medium";
  if (text.includes("low")) return "low";

  if (scoreDiff >= 18) return "high";
  if (scoreDiff >= 8) return "medium";
  return fallback;
}

function normalizeRole(
  value: unknown,
  fallback: "scorer" | "defender" | "support"
): "scorer" | "defender" | "support" {
  const text = toNonEmptyString(value)?.toLowerCase() ?? "";
  if (text.includes("score")) return "scorer";
  if (text.includes("def")) return "defender";
  if (text.includes("support")) return "support";
  return fallback;
}

function scoutingInsightsFromSummary(
  summary: ReturnType<typeof summarizeScouting>
): string {
  if (!summary || summary.count === 0) {
    return "No scouting data available";
  }

  const note = summary.notes.length > 0 ? ` Top notes: ${summary.notes.join(" | ")}.` : "";
  return `Scouting sample of ${summary.count}: auto ${summary.avg_auto}, teleop ${summary.avg_teleop}, endgame ${summary.avg_endgame}, reliability ${summary.avg_reliability}/5.${note}`;
}

function buildFallbackBrief(
  context: MatchBriefNormalizationContext
): BriefContent {
  const teamAnalysis = context.allTeams.map((teamNumber) => {
    const stats = context.statsMap[teamNumber];
    const scouting = context.scoutingSummary[teamNumber];
    const alliance: AllianceColor = context.redTeams.includes(teamNumber)
      ? "red"
      : "blue";
    const epaBreakdown = {
      total: roundOne(stats?.epa ?? 0),
      auto: roundOne(stats?.auto_epa ?? 0),
      teleop: roundOne(stats?.teleop_epa ?? 0),
      endgame: roundOne(stats?.endgame_epa ?? 0),
    };

    const role: "scorer" | "defender" | "support" =
      (scouting?.avg_defense ?? 0) >= 4 && epaBreakdown.total < 18
        ? "defender"
        : epaBreakdown.total >= 15 ||
          (scouting?.avg_auto ?? 0) + (scouting?.avg_teleop ?? 0) >= 18
        ? "scorer"
        : "support";

    return {
      teamNumber,
      alliance,
      epaBreakdown,
      scoutingInsights: scoutingInsightsFromSummary(scouting),
      role,
    };
  });

  const redTotalEPA = roundOne(
    context.redTeams.reduce(
      (sum, teamNumber) => sum + (context.statsMap[teamNumber]?.epa ?? 0),
      0
    )
  );
  const blueTotalEPA = roundOne(
    context.blueTeams.reduce(
      (sum, teamNumber) => sum + (context.statsMap[teamNumber]?.epa ?? 0),
      0
    )
  );

  const redReliabilityBoost = context.redTeams.reduce(
    (sum, teamNumber) =>
      sum + ((context.scoutingSummary[teamNumber]?.avg_reliability ?? 3) - 3) * 1.8,
    0
  );
  const blueReliabilityBoost = context.blueTeams.reduce(
    (sum, teamNumber) =>
      sum + ((context.scoutingSummary[teamNumber]?.avg_reliability ?? 3) - 3) * 1.8,
    0
  );

  const redScore = Math.max(0, Math.round(redTotalEPA + redReliabilityBoost));
  const blueScore = Math.max(0, Math.round(blueTotalEPA + blueReliabilityBoost));
  const scoreDiff = Math.abs(redScore - blueScore);
  const winner: AllianceColor = redScore >= blueScore ? "red" : "blue";
  const confidence: "high" | "medium" | "low" =
    scoreDiff >= 18 ? "high" : scoreDiff >= 8 ? "medium" : "low";

  const keyPlayersForAlliance = (teams: number[]) =>
    teams
      .slice()
      .sort(
        (a, b) =>
          (context.statsMap[b]?.epa ?? Number.NEGATIVE_INFINITY) -
          (context.statsMap[a]?.epa ?? Number.NEGATIVE_INFINITY)
      )
      .slice(0, 2);

  const fallbackAlliance = (
    teams: number[],
    totalEPA: number
  ): BriefContent["redAlliance"] => {
    const missingEpa = teams.filter(
      (teamNumber) => context.statsMap[teamNumber]?.epa == null
    ).length;
    const noCoverage = teams.filter(
      (teamNumber) => context.scoutingCoverage[teamNumber]?.coverage === "none"
    ).length;

    const strengths = dedupeStrings([
      `Projected around ${totalEPA.toFixed(1)} combined EPA entering this match.`,
      `Primary scoring pressure likely from Team ${keyPlayersForAlliance(teams)[0] ?? teams[0]}.`,
      noCoverage === 0
        ? "Scouting data exists across this alliance, improving role clarity."
        : "Available scouting notes provide partial role signal for this alliance.",
    ]).slice(0, 3);

    const weaknesses = dedupeStrings([
      noCoverage > 0
        ? `${noCoverage} team(s) on this alliance still need direct scouting coverage.`
        : "Lane traffic and cycle timing are likely to decide ceiling performance.",
      missingEpa > 0
        ? `EPA signal is missing for ${missingEpa} team(s), which increases uncertainty.`
        : "Endgame coordination remains a key swing factor.",
    ]).slice(0, 3);

    return {
      totalEPA,
      strengths,
      weaknesses,
      keyPlayers: keyPlayersForAlliance(teams),
    };
  };

  const teamsNeedingCoverage = context.allTeams
    .map((teamNumber) => {
      const coverage = context.scoutingCoverage[teamNumber];
      if (!coverage) return null;
      if (coverage.coverage === "none") {
        return {
          teamNumber,
          alliance: coverage.alliance,
          priority: "high" as const,
          reason: "No scouting entries logged yet for this team at this event.",
          focus:
            "Capture auto start behavior, cycle pace, defense impact, and endgame attempt/success.",
        };
      }
      if (coverage.coverage === "limited") {
        return {
          teamNumber,
          alliance: coverage.alliance,
          priority: "medium" as const,
          reason: "Only one scouting entry is available so the sample is still thin.",
          focus: "Confirm role consistency and note where points are most reliably scored.",
        };
      }
      return null;
    })
    .filter(
      (
        item
      ): item is {
        teamNumber: number;
        alliance: AllianceColor;
        priority: "high" | "medium";
        reason: string;
        focus: string;
      } => item !== null
    );

  return {
    prediction: {
      winner,
      confidence,
      redScore,
      blueScore,
    },
    redAlliance: fallbackAlliance(context.redTeams, redTotalEPA),
    blueAlliance: fallbackAlliance(context.blueTeams, blueTotalEPA),
    teamAnalysis,
    strategy: {
      redRecommendations: [
        "Prioritize clean cycle lanes for your strongest scorer and avoid traffic overlap.",
        "Assign one robot to protect endgame timing and prevent late climb congestion.",
      ],
      blueRecommendations: [
        "Use your highest-output scorer as the pace setter and feed them clear possession chains.",
        "If trailing late, force defensive pressure on the opposing primary scorer.",
      ],
      keyMatchups: [
        `Team ${
          keyPlayersForAlliance(context.redTeams)[0] ?? context.redTeams[0]
        } vs Team ${keyPlayersForAlliance(context.blueTeams)[0] ?? context.blueTeams[0]} in scoring tempo.`,
      ],
    },
    scoutingPriorities: {
      teamsNeedingCoverage,
      scoutActions: [
        "Prioritize one full-cycle observation for every high-priority team before mid-match.",
        "Log endgame attempt type, success/failure, and the exact failure mode when it misses.",
      ],
    },
  };
}

function normalizeBriefContent(
  raw: unknown,
  fallback: BriefContent,
  context: MatchBriefNormalizationContext
): BriefContent {
  const source = asObject(raw);
  if (!source) return fallback;

  const predictionSource = asObject(source.prediction);
  const redScore = Math.max(
    0,
    Math.round(
      toFiniteNumber(predictionSource?.redScore) ?? fallback.prediction.redScore
    )
  );
  const blueScore = Math.max(
    0,
    Math.round(
      toFiniteNumber(predictionSource?.blueScore) ?? fallback.prediction.blueScore
    )
  );
  const inferredWinner: AllianceColor = redScore >= blueScore ? "red" : "blue";
  const winner = normalizeAlliance(
    predictionSource?.winner,
    inferredWinner
  );
  const confidence = normalizeConfidence(
    predictionSource?.confidence,
    Math.abs(redScore - blueScore),
    fallback.prediction.confidence
  );

  const normalizeAllianceSection = (
    rawAlliance: unknown,
    fallbackAlliance: BriefContent["redAlliance"]
  ): BriefContent["redAlliance"] => {
    const allianceSource = asObject(rawAlliance);
    const strengths = dedupeStrings(
      toStringArray(allianceSource?.strengths)
    ).slice(0, 5);
    const weaknesses = dedupeStrings(
      toStringArray(allianceSource?.weaknesses)
    ).slice(0, 5);
    const keyPlayers = toTeamNumberArray(allianceSource?.keyPlayers);

    return {
      totalEPA:
        roundOne(
          toFiniteNumber(allianceSource?.totalEPA) ?? fallbackAlliance.totalEPA
        ),
      strengths:
        strengths.length > 0 ? strengths : fallbackAlliance.strengths,
      weaknesses:
        weaknesses.length > 0 ? weaknesses : fallbackAlliance.weaknesses,
      keyPlayers: keyPlayers.length > 0 ? keyPlayers : fallbackAlliance.keyPlayers,
    };
  };

  const fallbackTeamAnalysisByTeam = new Map(
    fallback.teamAnalysis.map((item) => [item.teamNumber, item])
  );
  const rawTeamAnalysis = Array.isArray(source.teamAnalysis)
    ? source.teamAnalysis
    : [];
  const normalizedTeams = new Map<number, BriefContent["teamAnalysis"][number]>();
  for (const item of rawTeamAnalysis) {
    const teamSource = asObject(item);
    if (!teamSource) continue;
    const teamNumber = toTeamNumber(teamSource.teamNumber);
    if (teamNumber === null || !fallbackTeamAnalysisByTeam.has(teamNumber)) continue;

    const fallbackTeam = fallbackTeamAnalysisByTeam.get(teamNumber)!;
    const epaSource = asObject(teamSource.epaBreakdown);

    normalizedTeams.set(teamNumber, {
      teamNumber,
      alliance: normalizeAlliance(teamSource.alliance, fallbackTeam.alliance),
      epaBreakdown: {
        total: roundOne(
          toFiniteNumber(epaSource?.total) ?? fallbackTeam.epaBreakdown.total
        ),
        auto: roundOne(
          toFiniteNumber(epaSource?.auto) ?? fallbackTeam.epaBreakdown.auto
        ),
        teleop: roundOne(
          toFiniteNumber(epaSource?.teleop) ?? fallbackTeam.epaBreakdown.teleop
        ),
        endgame: roundOne(
          toFiniteNumber(epaSource?.endgame) ?? fallbackTeam.epaBreakdown.endgame
        ),
      },
      scoutingInsights:
        toNonEmptyString(teamSource.scoutingInsights) ??
        fallbackTeam.scoutingInsights,
      role: normalizeRole(teamSource.role, fallbackTeam.role),
    });
  }

  const teamAnalysis = context.allTeams.map(
    (teamNumber) =>
      normalizedTeams.get(teamNumber) ?? fallbackTeamAnalysisByTeam.get(teamNumber)!
  );

  const strategySource = asObject(source.strategy);
  const redRecommendations = dedupeStrings(
    toStringArray(strategySource?.redRecommendations)
  );
  const blueRecommendations = dedupeStrings(
    toStringArray(strategySource?.blueRecommendations)
  );
  const keyMatchups = dedupeStrings(toStringArray(strategySource?.keyMatchups));

  const scoutingSource = asObject(source.scoutingPriorities);
  const coverageSource = Array.isArray(scoutingSource?.teamsNeedingCoverage)
    ? scoutingSource.teamsNeedingCoverage
    : [];
  const normalizedCoverageMap = new Map<
    number,
    BriefContent["scoutingPriorities"]["teamsNeedingCoverage"][number]
  >();
  for (const item of coverageSource) {
    const teamSource = asObject(item);
    if (!teamSource) continue;
    const teamNumber = toTeamNumber(teamSource.teamNumber);
    if (teamNumber === null || !context.allTeams.includes(teamNumber)) continue;

    const fallbackCoverage = context.scoutingCoverage[teamNumber];
    const fallbackAlliance: AllianceColor = fallbackCoverage?.alliance ?? "red";
    const fallbackPriority: PriorityLevel =
      fallbackCoverage?.coverage === "none"
        ? "high"
        : fallbackCoverage?.coverage === "limited"
        ? "medium"
        : "low";

    normalizedCoverageMap.set(teamNumber, {
      teamNumber,
      alliance: normalizeAlliance(teamSource.alliance, fallbackAlliance),
      priority: normalizePriority(teamSource.priority, fallbackPriority),
      reason:
        toNonEmptyString(teamSource.reason) ??
        (fallbackCoverage?.coverage === "none"
          ? "No scouting entries logged yet for this team at this event."
          : "Coverage is limited for this team."),
      focus:
        toNonEmptyString(teamSource.focus) ??
        "Capture auto behavior, cycle pace, defense interaction, and endgame attempt/success.",
    });
  }

  for (const teamNumber of context.allTeams) {
    const coverage = context.scoutingCoverage[teamNumber];
    if (!coverage || coverage.coverage !== "none") continue;
    const existing = normalizedCoverageMap.get(teamNumber);
    if (existing) {
      existing.priority = "high";
      continue;
    }
    normalizedCoverageMap.set(teamNumber, {
      teamNumber,
      alliance: coverage.alliance,
      priority: "high",
      reason: "No scouting entries logged yet for this team at this event.",
      focus:
        "Capture auto behavior, cycle pace, defense interaction, and endgame attempt/success.",
    });
  }

  const normalizedCoverage = Array.from(normalizedCoverageMap.values()).sort(
    (a, b) => {
      const weight: Record<PriorityLevel, number> = {
        high: 0,
        medium: 1,
        low: 2,
      };
      return weight[a.priority] - weight[b.priority];
    }
  );

  const scoutActions = dedupeStrings(
    toStringArray(scoutingSource?.scoutActions)
  ).slice(0, 6);

  return {
    prediction: {
      winner,
      confidence,
      redScore,
      blueScore,
    },
    redAlliance: normalizeAllianceSection(source.redAlliance, fallback.redAlliance),
    blueAlliance: normalizeAllianceSection(source.blueAlliance, fallback.blueAlliance),
    teamAnalysis,
    strategy: {
      redRecommendations:
        redRecommendations.length > 0
          ? redRecommendations
          : fallback.strategy.redRecommendations,
      blueRecommendations:
        blueRecommendations.length > 0
          ? blueRecommendations
          : fallback.strategy.blueRecommendations,
      keyMatchups:
        keyMatchups.length > 0 ? keyMatchups : fallback.strategy.keyMatchups,
    },
    scoutingPriorities: {
      teamsNeedingCoverage:
        normalizedCoverage.length > 0
          ? normalizedCoverage
          : fallback.scoutingPriorities.teamsNeedingCoverage,
      scoutActions:
        scoutActions.length > 0
          ? scoutActions
          : fallback.scoutingPriorities.scoutActions,
    },
  };
}

export async function GET(request: NextRequest) {
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

  const matchId = request.nextUrl.searchParams.get("matchId");
  if (!matchId) {
    return NextResponse.json({ error: "matchId is required" }, { status: 400 });
  }

  const { data: brief, error } = await supabase
    .from("strategy_briefs")
    .select("content, created_at")
    .eq("match_id", matchId)
    .eq("org_id", profile.org_id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!brief) {
    return NextResponse.json({ error: "Brief not found" }, { status: 404 });
  }

  const parsed = BriefContentSchema.safeParse(brief.content);

  return NextResponse.json({
    success: true,
    brief: parsed.success ? parsed.data : brief.content,
    createdAt: brief.created_at,
  });
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

  const { matchId } = await request.json();
  if (!matchId) {
    return NextResponse.json({ error: "matchId is required" }, { status: 400 });
  }

  // Get match data
  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("*, events(id, name, year, tba_key)")
    .eq("id", matchId)
    .single();

  if (matchError || !match) {
    return NextResponse.json({ error: "Match not found" }, { status: 404 });
  }

  if (
    org.team_number &&
    !match.red_teams.includes(org.team_number) &&
    !match.blue_teams.includes(org.team_number)
  ) {
    return NextResponse.json(
      { error: "Pre-match briefs are only available for your own matches." },
      { status: 403 }
    );
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

  const scoutingCoverage: Record<
    number,
    {
      alliance: "red" | "blue";
      entries: number;
      coverage: "none" | "limited" | "moderate" | "strong";
    }
  > = {};
  for (const team of allTeams) {
    const summary = scoutingSummary[team];
    const entries = summary?.count ?? 0;
    scoutingCoverage[team] = {
      alliance: match.red_teams.includes(team) ? "red" : "blue",
      entries,
      coverage:
        entries === 0
          ? "none"
          : entries === 1
          ? "limited"
          : entries <= 3
          ? "moderate"
          : "strong",
    };
  }

  // Build prompt data
  const promptData = {
    event: {
      name: match.events?.name ?? null,
      key: match.events?.tba_key ?? null,
      year: match.events?.year ?? null,
    },
    match: {
      comp_level: match.comp_level,
      match_number: match.match_number,
      red_teams: match.red_teams,
      blue_teams: match.blue_teams,
      // Keep brief generation pre-match oriented, even for completed matches.
      red_score: null,
      blue_score: null,
    },
    stats: statsMap,
    scouting: scoutingSummary,
    scoutingCoverage,
  };

  const normalizationContext: MatchBriefNormalizationContext = {
    allTeams,
    redTeams: match.red_teams,
    blueTeams: match.blue_teams,
    statsMap,
    scoutingSummary,
    scoutingCoverage,
  };

  const systemPrompt = `You are an expert FRC (FIRST Robotics Competition) strategy analyst. Analyze the provided match data and generate a strategic brief.

${buildFrcGamePrompt(match.events?.year ?? null)}

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
  },
  "scoutingPriorities": {
    "teamsNeedingCoverage": [
      {
        "teamNumber": number,
        "alliance": "red" or "blue",
        "priority": "high", "medium", or "low",
        "reason": "Why this team still needs scouting data",
        "focus": "What scouts should specifically look for next"
      }
    ],
    "scoutActions": [
      "Action item for scouts before/early in this match",
      "Action item for note quality or role-specific observations"
    ]
  }
}

Guidelines:
- If EPA data is missing for a team, note it and base analysis on scouting data
- If scouting data is missing, note it and base analysis on EPA stats
- Predictions should factor in both EPA and scouting observations
- Recommendations should be specific and actionable for drive teams
- Be candid about weak teams or fragile matchups when data supports it, using professional wording.
- Avoid comparative labels like "lower", "low-tier", "below average", or similar phrasing.
- Prefer neutral alternatives such as "currently limited scoring output" or "not a top-priority pick for this role."
- Do not use location-based claims as strengths (for example: "local knowledge", "familiar with this venue", "home crowd advantage").
- Base alliance strengths/weaknesses only on provided performance data.
- Use "scoutingCoverage" to drive scouting priorities.
- Every team with "coverage": "none" must appear in scoutingPriorities.teamsNeedingCoverage with priority "high".
- Teams with limited data should usually be medium priority unless other data already gives high confidence.
- scoutActions should be concrete, short, and directly usable by scouts in the stands.
- Keep insights concise but informative
- Do not use emojis or markdown`;

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

    const textOutput = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (!textOutput) {
      return NextResponse.json({ error: "No text response from AI" }, { status: 500 });
    }

    let parsedJson: unknown;
    try {
      parsedJson = parseAiJson(textOutput);
    } catch (parseError) {
      console.error(
        "Failed to parse AI brief response as JSON:",
        parseError instanceof Error ? parseError.message : parseError,
        "\nRaw AI output (first 500 chars):",
        textOutput.slice(0, 500)
      );
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON" },
        { status: 500 }
      );
    }

    const initialParsed = BriefContentSchema.safeParse(parsedJson);
    const briefContent =
      initialParsed.success
        ? initialParsed.data
        : normalizeBriefContent(
            parsedJson,
            buildFallbackBrief(normalizationContext),
            normalizationContext
          );
    const parsed = BriefContentSchema.safeParse(briefContent);
    if (!parsed.success) {
      console.warn("Invalid AI brief schema after normalization:", parsed.error.flatten());
      return NextResponse.json(
        { error: "AI response did not match expected schema" },
        { status: 500 }
      );
    }
    if (!initialParsed.success) {
      console.warn("Invalid AI brief schema; normalized fallback applied:", initialParsed.error.flatten());
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

    return NextResponse.json(
      {
        success: true,
        brief: briefContent,
        briefId: brief.id,
      },
      { headers: limitHeaders }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

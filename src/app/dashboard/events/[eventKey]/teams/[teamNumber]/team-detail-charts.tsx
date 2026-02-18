"use client";

import { PerformanceTrend } from "@/components/charts/performance-trend";
import { EpaRadar } from "@/components/charts/epa-radar";

interface ChartEntry {
  matchLabel: string;
  autoScore: number;
  teleopScore: number;
  endgameScore: number;
  defenseRating: number;
  reliabilityRating: number;
}

interface TeamDetailChartsProps {
  teamNumber: number;
  scoutingEntries: ChartEntry[];
  epa: {
    auto: number | null;
    teleop: number | null;
    endgame: number | null;
    total: number | null;
  } | null;
  avgDefense: number | null;
  avgReliability: number | null;
}

export function TeamDetailCharts({
  teamNumber,
  scoutingEntries,
  epa,
  avgDefense,
  avgReliability,
}: TeamDetailChartsProps) {
  if (scoutingEntries.length === 0 && !epa) {
    return null;
  }

  // Reverse so oldest match is first (entries come in desc order)
  const trendData = [...scoutingEntries].reverse().map((e) => ({
    matchLabel: e.matchLabel,
    autoScore: e.autoScore,
    teleopScore: e.teleopScore,
    endgameScore: e.endgameScore,
    total: e.autoScore + e.teleopScore + e.endgameScore,
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <PerformanceTrend scoutingData={trendData} epa={epa} />
      <EpaRadar
        auto={epa?.auto ?? null}
        teleop={epa?.teleop ?? null}
        endgame={epa?.endgame ?? null}
        defense={avgDefense}
        reliability={avgReliability}
        teamNumber={teamNumber}
      />
    </div>
  );
}

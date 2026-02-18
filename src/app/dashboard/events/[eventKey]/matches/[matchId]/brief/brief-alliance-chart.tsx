"use client";

import { AllianceComparison } from "@/components/charts/alliance-comparison";

interface TeamChartData {
  teamNumber: number;
  alliance: "red" | "blue";
  scoutAvg: {
    auto: number;
    teleop: number;
    endgame: number;
  } | null;
  epa: {
    auto: number | null;
    teleop: number | null;
    endgame: number | null;
  } | null;
}

interface BriefAllianceChartProps {
  teams: TeamChartData[];
}

export function BriefAllianceChart({ teams }: BriefAllianceChartProps) {
  if (teams.length === 0) return null;
  return <AllianceComparison teams={teams} />;
}

"use client";

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

interface EpaRadarProps {
  auto: number | null;
  teleop: number | null;
  endgame: number | null;
  defense: number | null;
  reliability: number | null;
  teamNumber: number;
}

export function EpaRadar({
  auto,
  teleop,
  endgame,
  defense,
  reliability,
  teamNumber,
}: EpaRadarProps) {
  const hasEpa = auto !== null || teleop !== null || endgame !== null;
  const hasRatings = defense !== null || reliability !== null;

  if (!hasEpa && !hasRatings) {
    return null;
  }

  // Normalize all values to a 0-100 scale for the radar
  // EPA values: use a max of ~40 as a reasonable upper bound for FRC
  // Ratings: already 1-5, scale to 0-100
  const epaMax = Math.max(auto ?? 0, teleop ?? 0, endgame ?? 0, 20);

  const data = [
    {
      metric: "Auto",
      value: auto !== null ? (auto / epaMax) * 100 : 0,
      raw: auto !== null ? auto.toFixed(1) : "—",
    },
    {
      metric: "Teleop",
      value: teleop !== null ? (teleop / epaMax) * 100 : 0,
      raw: teleop !== null ? teleop.toFixed(1) : "—",
    },
    {
      metric: "Endgame",
      value: endgame !== null ? (endgame / epaMax) * 100 : 0,
      raw: endgame !== null ? endgame.toFixed(1) : "—",
    },
    {
      metric: "Defense",
      value: defense !== null ? (defense / 5) * 100 : 0,
      raw: defense !== null ? `${defense.toFixed(1)}/5` : "—",
    },
    {
      metric: "Reliability",
      value: reliability !== null ? (reliability / 5) * 100 : 0,
      raw: reliability !== null ? `${reliability.toFixed(1)}/5` : "—",
    },
  ];

  return (
    <div className="rounded-2xl dashboard-panel p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">
        Team {teamNumber} Profile
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
          <PolarGrid stroke="rgba(148, 163, 184, 0.15)" />
          <PolarAngleAxis
            dataKey="metric"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
          />
          <PolarRadiusAxis
            tick={false}
            axisLine={false}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#e2e8f0",
            }}
            formatter={(_value: number | undefined, _name: string | undefined, props: { payload?: { raw?: string } }) =>
              [props.payload?.raw ?? "—", "Value"]
            }
          />
          <Radar
            name={`Team ${teamNumber}`}
            dataKey="value"
            stroke="#22d3ee"
            fill="#22d3ee"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-xs text-gray-500">
        EPA values + scouting ratings normalized for comparison
      </p>
    </div>
  );
}

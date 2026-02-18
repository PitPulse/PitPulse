"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TeamStats {
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

interface AllianceComparisonProps {
  teams: TeamStats[];
}

export function AllianceComparison({ teams }: AllianceComparisonProps) {
  if (teams.length === 0) {
    return null;
  }

  const chartData = teams.map((t) => ({
    name: `${t.teamNumber}`,
    alliance: t.alliance,
    "Scout Auto": t.scoutAvg?.auto ?? 0,
    "Scout Teleop": t.scoutAvg?.teleop ?? 0,
    "Scout Endgame": t.scoutAvg?.endgame ?? 0,
    "EPA Auto": t.epa?.auto ?? 0,
    "EPA Teleop": t.epa?.teleop ?? 0,
    "EPA Endgame": t.epa?.endgame ?? 0,
  }));

  return (
    <div className="rounded-2xl dashboard-panel p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">
        Alliance Comparison
      </h2>
      <div className="mb-3 flex justify-center gap-4">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400/80" />
          Red Alliance
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-400/80" />
          Blue Alliance
        </span>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={chartData}
          margin={{ top: 5, right: 10, left: -10, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(148, 163, 184, 0.1)"
          />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "rgba(148, 163, 184, 0.2)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            axisLine={{ stroke: "rgba(148, 163, 184, 0.2)" }}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "rgba(15, 23, 42, 0.95)",
              border: "1px solid rgba(148, 163, 184, 0.2)",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#e2e8f0",
            }}
            formatter={(value: number | undefined) => (value ?? 0).toFixed(1)}
          />
          <Legend
            iconType="rect"
            wrapperStyle={{ fontSize: "10px", color: "#94a3b8" }}
          />
          {/* Scouting averages - solid */}
          <Bar dataKey="Scout Auto" fill="#38bdf8" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Scout Teleop" fill="#34d399" radius={[2, 2, 0, 0]} />
          <Bar dataKey="Scout Endgame" fill="#a78bfa" radius={[2, 2, 0, 0]} />
          {/* EPA values - semi-transparent */}
          <Bar
            dataKey="EPA Auto"
            fill="rgba(56, 189, 248, 0.35)"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey="EPA Teleop"
            fill="rgba(52, 211, 153, 0.35)"
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey="EPA Endgame"
            fill="rgba(167, 139, 250, 0.35)"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-xs text-gray-500">
        Solid bars = scouting averages &middot; Faded bars = EPA stats
      </p>
    </div>
  );
}

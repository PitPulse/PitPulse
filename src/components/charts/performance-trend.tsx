"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface MatchDataPoint {
  matchLabel: string;
  autoScore: number;
  teleopScore: number;
  endgameScore: number;
  total: number;
}

interface PerformanceTrendProps {
  scoutingData: MatchDataPoint[];
  epa: {
    auto: number | null;
    teleop: number | null;
    endgame: number | null;
    total: number | null;
  } | null;
}

export function PerformanceTrend({ scoutingData, epa }: PerformanceTrendProps) {
  const [showEpa, setShowEpa] = useState(false);
  const hasEpa = epa && epa.total !== null;

  const chartData = scoutingData.map((d) => ({
    ...d,
    ...(showEpa && epa
      ? {
          epaTotal: epa.total,
        }
      : {}),
  }));

  if (scoutingData.length === 0) {
    return (
      <div className="rounded-2xl dashboard-panel p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Performance Trend
        </h2>
        <p className="text-sm text-gray-400">
          No scouting data yet. Scout this team from the matches page.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl dashboard-panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Performance Trend</h2>
        {hasEpa && (
          <button
            type="button"
            onClick={() => setShowEpa(!showEpa)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              showEpa
                ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/10"
            }`}
          >
            {showEpa ? "Hide EPA" : "Show EPA"}
          </button>
        )}
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.1)" />
          <XAxis
            dataKey="matchLabel"
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
          />
          <Legend
            iconType="circle"
            wrapperStyle={{ fontSize: "11px", color: "#94a3b8" }}
          />
          <Line
            type="monotone"
            dataKey="autoScore"
            name="Auto"
            stroke="#38bdf8"
            strokeWidth={2}
            dot={{ r: 3, fill: "#38bdf8" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="teleopScore"
            name="Teleop"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ r: 3, fill: "#34d399" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="endgameScore"
            name="Endgame"
            stroke="#a78bfa"
            strokeWidth={2}
            dot={{ r: 3, fill: "#a78bfa" }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="total"
            name="Total"
            stroke="#ffffff"
            strokeWidth={2}
            dot={{ r: 3, fill: "#ffffff" }}
            activeDot={{ r: 5 }}
          />
          {showEpa && (
            <Line
              type="monotone"
              dataKey="epaTotal"
              name="EPA (ref)"
              stroke="#facc15"
              strokeWidth={1.5}
              strokeDasharray="6 3"
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

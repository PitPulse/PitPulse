"use client";

import { useState, useMemo } from "react";
import { PerformanceTrend } from "@/components/charts/performance-trend";
import { EpaRadar } from "@/components/charts/epa-radar";
import { ExportCsvButton } from "@/components/export-csv-button";
import { PrintScoutingButton } from "@/components/print-scouting-button";

interface ScoutingRow {
  matchLabel: string;
  teamNumber: number;
  teamName: string;
  scoutedBy: string;
  autoScore: number;
  teleopScore: number;
  endgameScore: number;
  defenseRating: number;
  reliabilityRating: number;
  notes: string;
}

interface TeamStatData {
  teamNumber: number;
  teamName: string;
  entryCount: number;
  scoutAvg: {
    auto: number;
    teleop: number;
    endgame: number;
  } | null;
  epa: {
    auto: number | null;
    teleop: number | null;
    endgame: number | null;
    total: number | null;
  } | null;
  avgDefense: number | null;
  avgReliability: number | null;
}

interface AnalyticsDashboardProps {
  eventTitle: string;
  eventKey: string;
  scoutingRows: ScoutingRow[];
  teamStats: TeamStatData[];
}

export function AnalyticsDashboard({
  eventTitle,
  eventKey,
  scoutingRows,
  teamStats,
}: AnalyticsDashboardProps) {
  const sortedTeams = useMemo(
    () =>
      [...teamStats].sort(
        (a, b) => (b.epa?.total ?? 0) - (a.epa?.total ?? 0)
      ),
    [teamStats]
  );

  const [selectedTeam, setSelectedTeam] = useState<number | null>(
    sortedTeams[0]?.teamNumber ?? null
  );

  const selectedTeamData = useMemo(
    () => teamStats.find((t) => t.teamNumber === selectedTeam) ?? null,
    [teamStats, selectedTeam]
  );

  const selectedEntries = useMemo(
    () =>
      scoutingRows
        .filter((r) => r.teamNumber === selectedTeam)
        .map((e) => ({
          matchLabel: e.matchLabel,
          autoScore: e.autoScore,
          teleopScore: e.teleopScore,
          endgameScore: e.endgameScore,
          total: e.autoScore + e.teleopScore + e.endgameScore,
        })),
    [scoutingRows, selectedTeam]
  );

  const csvHeaders = [
    "Match",
    "Team",
    "Team Name",
    "Scout",
    "Auto",
    "Teleop",
    "Endgame",
    "Total",
    "Defense",
    "Reliability",
    "Notes",
  ];

  const csvRows = scoutingRows.map((r) => [
    r.matchLabel,
    r.teamNumber,
    r.teamName,
    r.scoutedBy,
    r.autoScore,
    r.teleopScore,
    r.endgameScore,
    r.autoScore + r.teleopScore + r.endgameScore,
    r.defenseRating,
    r.reliabilityRating,
    r.notes,
  ]);

  return (
    <div className="space-y-6">
      {/* Export bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl dashboard-panel px-4 py-3">
        <span className="text-sm font-medium text-gray-300">Export:</span>
        <ExportCsvButton
          filename={`${eventKey}-scouting-data.csv`}
          headers={csvHeaders}
          rows={csvRows}
          label="All Scouting Data (CSV)"
        />
        <PrintScoutingButton
          eventTitle={eventTitle}
          rows={scoutingRows}
          label="Print Scouting Data"
        />
      </div>

      {/* Team selector */}
      <div className="rounded-2xl dashboard-panel p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Team Analysis
        </h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {sortedTeams.map((team) => (
            <button
              key={team.teamNumber}
              type="button"
              onClick={() => setSelectedTeam(team.teamNumber)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                selectedTeam === team.teamNumber
                  ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-200"
                  : "border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200"
              }`}
            >
              {team.teamNumber}
              {team.entryCount > 0 && (
                <span className="ml-1 text-gray-500">({team.entryCount})</span>
              )}
            </button>
          ))}
        </div>

        {selectedTeam && selectedTeamData && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-white">
                Team {selectedTeam}
              </h3>
              <span className="text-sm text-gray-400">
                {selectedTeamData.teamName}
              </span>
              <a
                href={`/dashboard/events/${eventKey}/teams/${selectedTeam}`}
                className="text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
              >
                Full profile
              </a>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <PerformanceTrend
                scoutingData={selectedEntries}
                epa={selectedTeamData.epa}
              />
              <EpaRadar
                auto={selectedTeamData.epa?.auto ?? null}
                teleop={selectedTeamData.epa?.teleop ?? null}
                endgame={selectedTeamData.epa?.endgame ?? null}
                defense={selectedTeamData.avgDefense}
                reliability={selectedTeamData.avgReliability}
                teamNumber={selectedTeam}
              />
            </div>
          </div>
        )}

        {!selectedTeam && (
          <p className="text-sm text-gray-400">
            Select a team above to view their analytics.
          </p>
        )}
      </div>

      {/* Quick stats overview */}
      <div className="rounded-2xl dashboard-panel p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">
          Scouting Overview
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  Team
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                  Name
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                  Entries
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                  Avg Auto
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                  Avg Teleop
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                  Avg Endgame
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                  EPA
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-400">
                  Defense
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {sortedTeams.map((team) => (
                <tr
                  key={team.teamNumber}
                  className={`hover:bg-white/5 cursor-pointer ${
                    selectedTeam === team.teamNumber ? "bg-white/10" : ""
                  }`}
                  onClick={() => setSelectedTeam(team.teamNumber)}
                >
                  <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-blue-300">
                    {team.teamNumber}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-300">
                    {team.teamName}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-300">
                    {team.entryCount}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-300">
                    {team.scoutAvg?.auto.toFixed(1) ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-300">
                    {team.scoutAvg?.teleop.toFixed(1) ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-300">
                    {team.scoutAvg?.endgame.toFixed(1) ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm font-medium text-white">
                    {team.epa?.total?.toFixed(1) ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-sm text-gray-300">
                    {team.avgDefense?.toFixed(1) ?? "—"}/5
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

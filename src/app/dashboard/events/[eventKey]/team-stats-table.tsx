"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface TeamStat {
  team_number: number;
  name: string;
  city: string;
  state: string;
  epa: number | null;
  auto_epa: number | null;
  teleop_epa: number | null;
  endgame_epa: number | null;
  win_rate: number | null;
}

type SortKey = keyof TeamStat;

function SortHeader({
  label,
  field,
  sortKey,
  sortAsc,
  onSort,
}: {
  label: string;
  field: SortKey;
  sortKey: SortKey;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}) {
  const isActive = sortKey === field;
  return (
    <th
      onClick={() => onSort(field)}
      className="cursor-pointer px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-400 hover:text-white select-none"
    >
      {label}
      {isActive && <span className="ml-1">{sortAsc ? "▲" : "▼"}</span>}
    </th>
  );
}

export function TeamStatsTable({
  data,
  eventKey,
  highlightTeam = null,
}: {
  data: TeamStat[];
  eventKey: string;
  highlightTeam?: number | null;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("epa");
  const [sortAsc, setSortAsc] = useState(false);
  const [search, setSearch] = useState("");
  const missingEpaCount = useMemo(
    () => data.filter((team) => team.epa === null).length,
    [data]
  );
  const showEpaNotice = missingEpaCount > 0;

  const sorted = useMemo(() => {
    const filtered = data.filter(
      (t) =>
        t.team_number.toString().includes(search) ||
        t.name.toLowerCase().includes(search.toLowerCase())
    );

    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === null && bVal === null) {
        return a.team_number - b.team_number;
      }
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [data, sortKey, sortAsc, search]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  function formatNum(val: number | null, decimals = 1): string {
    if (val === null) return "—";
    return val.toFixed(decimals);
  }

  return (
    <div className="space-y-4">
      {showEpaNotice && (
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs text-teal-700 dark:text-yellow-300">
          {missingEpaCount === data.length
            ? "EPA stats update once matches start or as the event gets closer."
            : `EPA stats are still missing for ${missingEpaCount} team${missingEpaCount === 1 ? "" : "s"}.`}
        </div>
      )}
      <input
        type="text"
        placeholder="Search by team number or name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg px-3 py-2 text-sm text-white shadow-sm dashboard-input"
      />

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="min-w-[640px] w-full divide-y divide-white/10 dashboard-table">
          <thead className="bg-white/5">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-400">
                #
              </th>
              <SortHeader label="Team" field="team_number" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
              <SortHeader label="Name" field="name" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
              <SortHeader label="EPA" field="epa" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
              <SortHeader label="Auto" field="auto_epa" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
              <SortHeader label="Teleop" field="teleop_epa" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
              <SortHeader label="Endgame" field="endgame_epa" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
              <SortHeader label="Win Rate" field="win_rate" sortKey={sortKey} sortAsc={sortAsc} onSort={handleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {sorted.map((team, i) => {
              const isHighlighted = highlightTeam !== null && team.team_number === highlightTeam;
              return (
              <tr key={team.team_number} className={isHighlighted ? "bg-white/10 hover:bg-white/15" : "hover:bg-white/5"}>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-400">
                  {i + 1}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm font-medium">
                  <Link
                    href={`/dashboard/events/${eventKey}/teams/${team.team_number}`}
                    className="text-blue-300 hover:text-blue-200 hover:underline"
                  >
                    {team.team_number}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-300">
                  {team.name}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm font-medium text-white">
                  {formatNum(team.epa)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-300">
                  {formatNum(team.auto_epa)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-300">
                  {formatNum(team.teleop_epa)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-300">
                  {formatNum(team.endgame_epa)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-300">
                  {team.win_rate !== null
                    ? `${(team.win_rate * 100).toFixed(0)}%`
                    : "—"}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        {sorted.length} team{sorted.length !== 1 ? "s" : ""} shown
      </p>
    </div>
  );
}

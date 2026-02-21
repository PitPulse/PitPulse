"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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
const ROWS_PER_PAGE = 24;

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
  const [page, setPage] = useState(1);
  const [pageDirection, setPageDirection] = useState<1 | -1>(1);
  const prefersReducedMotion = useReducedMotion();
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

  const totalPages = Math.max(1, Math.ceil(sorted.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * ROWS_PER_PAGE;
  const pageRows = useMemo(
    () => sorted.slice(pageStart, pageStart + ROWS_PER_PAGE),
    [sorted, pageStart]
  );

  function handleSort(key: SortKey) {
    setPageDirection(-1);
    setPage(1);
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
        onChange={(e) => {
          setSearch(e.target.value);
          setPageDirection(-1);
          setPage(1);
        }}
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
          <AnimatePresence mode="wait" initial={false}>
            <motion.tbody
              key={`team-stats-page-${safePage}`}
              className="divide-y divide-white/10"
              custom={pageDirection}
              initial={
                prefersReducedMotion
                  ? false
                  : {
                      opacity: 0,
                      x: pageDirection > 0 ? 18 : -18,
                    }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                prefersReducedMotion
                  ? {}
                  : {
                      opacity: 0,
                      x: pageDirection > 0 ? -18 : 18,
                    }
              }
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            >
              {pageRows.map((team, i) => {
                const isHighlighted = highlightTeam !== null && team.team_number === highlightTeam;
                return (
                <tr key={team.team_number} className={isHighlighted ? "bg-white/10 hover:bg-white/15" : "hover:bg-white/5"}>
                  <td className="whitespace-nowrap px-3 py-2 text-sm text-gray-400">
                    {pageStart + i + 1}
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
            </motion.tbody>
          </AnimatePresence>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
        <p>
          {sorted.length} team{sorted.length !== 1 ? "s" : ""} shown
          {sorted.length > 0 && (
            <> &middot; Showing {pageStart + 1}-{Math.min(pageStart + ROWS_PER_PAGE, sorted.length)}</>
          )}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPageDirection(-1);
                setPage((prev) => Math.max(1, Math.min(prev, totalPages) - 1));
              }}
              disabled={safePage === 1}
              className="rounded-md border border-white/15 px-2 py-1 text-xs text-gray-300 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              Prev
            </button>
            <span>
              Page {safePage} / {totalPages}
              </span>
            <button
              type="button"
              onClick={() => {
                setPageDirection(1);
                setPage((prev) => Math.min(totalPages, Math.min(prev, totalPages) + 1));
              }}
              disabled={safePage === totalPages}
              className="rounded-md border border-white/15 px-2 py-1 text-xs text-gray-300 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

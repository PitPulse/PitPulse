"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { Tables } from "@/types/supabase";

type Match = Tables<"matches">;
type Assignment = Tables<"scout_assignments">;

interface EnrichedAssignment extends Assignment {
  match: Match;
  matchLabel: string;
  positionLabel: string;
  isCompleted: boolean;
  sortKey: number;
  matchNumber: number;
}

interface MyAssignmentsProps {
  matches: Match[];
  assignments: Assignment[];
}

export function MyAssignments({
  matches,
  assignments,
}: MyAssignmentsProps) {
  const [showCompleted, setShowCompleted] = useState(false);

  const matchMap = useMemo(() => {
    const map = new Map<string, Match>();
    for (const m of matches) map.set(m.id, m);
    return map;
  }, [matches]);

  const enrichedAssignments = useMemo(() => {
    return assignments
      .map((a) => {
        const match = matchMap.get(a.match_id);
        if (!match) return null;

        const hasScore =
          match.red_score !== null && match.blue_score !== null;

        const hasLegacy =
          match.comp_level !== "qm" &&
          !match.set_number &&
          match.match_number >= 100;
        const normalizedSet = hasLegacy
          ? Math.floor(match.match_number / 100)
          : match.set_number ?? null;
        const normalizedMatch = hasLegacy
          ? match.match_number % 100
          : match.match_number;
        const sortNumber = normalizedSet
          ? normalizedSet * 100 + normalizedMatch
          : normalizedMatch;

        let label: string;
        if (match.comp_level === "qm") label = `Qual ${normalizedMatch}`;
        else if (match.comp_level === "sf")
          label = normalizedSet
            ? `SF ${normalizedSet}-${normalizedMatch}`
            : `SF ${normalizedMatch}`;
        else if (match.comp_level === "f")
          label = normalizedSet
            ? `F ${normalizedSet}-${normalizedMatch}`
            : `F ${normalizedMatch}`;
        else
          label = normalizedSet
            ? `${match.comp_level.toUpperCase()} ${normalizedSet}-${normalizedMatch}`
            : `${match.comp_level.toUpperCase()} ${normalizedMatch}`;

        const posLabel = a.position
          .replace("red", "Red ")
          .replace("blue", "Blue ");

        return {
          ...a,
          match,
          matchLabel: label,
          positionLabel: posLabel,
          isCompleted: hasScore,
          sortKey: match.comp_level === "qm" ? 0 : 1,
          matchNumber: sortNumber,
        };
      })
      .filter((a): a is EnrichedAssignment => a !== null)
      .sort((a, b) => {
        if (a.sortKey !== b.sortKey) return a.sortKey - b.sortKey;
        return a.matchNumber - b.matchNumber;
      });
  }, [assignments, matchMap]);

  const upcoming = enrichedAssignments.filter((a) => !a.isCompleted);
  const completed = enrichedAssignments.filter((a) => a.isCompleted);

  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl dashboard-panel p-8 text-center">
        <h2 className="text-lg font-semibold text-white mb-2">
          No Assignments Yet
        </h2>
        <p className="text-gray-400">
          Your team captain hasn&apos;t assigned you to any matches yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Your Assignments ({upcoming.length} upcoming)
        </h2>
      </div>

      {/* Upcoming */}
      <div data-tour="my-assignments-list" className="space-y-2">
        {upcoming.map((a) => (
          <Link
            key={a.id}
            href={`/scout/${a.match_id}/${a.team_number}`}
            className="flex items-center justify-between rounded-2xl dashboard-panel p-4 hover:bg-white/5 transition"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
                  a.position.startsWith("red")
                    ? "bg-red-500"
                    : "bg-blue-500"
                }`}
              >
                {a.position.slice(-1)}
              </span>
              <div>
                <p className="font-semibold text-white">{a.matchLabel}</p>
                <p className="text-sm text-gray-400">
                  Team {a.team_number} &middot; {a.positionLabel}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-xs font-medium text-blue-200">
              Scout →
            </span>
          </Link>
        ))}
      </div>

      {/* Completed toggle */}
      {completed.length > 0 && (
        <div>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            {showCompleted ? "Hide" : "Show"} completed ({completed.length})
          </button>

          {showCompleted && (
            <div className="mt-2 space-y-2">
              {completed.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-2xl dashboard-panel p-4 opacity-60"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${
                        a.position.startsWith("red")
                          ? "bg-red-400"
                          : "bg-blue-400"
                      }`}
                    >
                      {a.position.slice(-1)}
                    </span>
                    <div>
                      <p className="font-medium text-gray-300">
                        {a.matchLabel}
                      </p>
                      <p className="text-sm text-gray-400">
                        Team {a.team_number} &middot; {a.positionLabel}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full bg-green-500/20 px-2.5 py-0.5 text-xs font-medium text-green-200">
                    Done
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

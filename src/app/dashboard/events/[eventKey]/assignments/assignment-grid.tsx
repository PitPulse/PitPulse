"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/supabase";

type Match = Tables<"matches">;
type Assignment = Tables<"scout_assignments">;

interface Member {
  id: string;
  display_name: string;
  role: string;
}

const POSITIONS = ["red1", "red2", "red3", "blue1", "blue2", "blue3"] as const;

interface AssignmentGridProps {
  matches: Match[];
  members: Member[];
  assignments: Assignment[];
  orgId: string;
  eventKey: string;
}

export function AssignmentGrid({
  matches,
  members,
  assignments: initialAssignments,
  orgId,
}: AssignmentGridProps) {
  const router = useRouter();
  const supabase = createClient();

  const [filter, setFilter] = useState<"all" | "qm" | "playoff">("qm");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Build assignment map: matchId-position -> scoutId
  const [assignmentMap, setAssignmentMap] = useState<
    Record<string, string>
  >(() => {
    const map: Record<string, string> = {};
    for (const a of initialAssignments) {
      map[`${a.match_id}-${a.position}`] = a.assigned_to;
    }
    return map;
  });

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (filter === "qm") return m.comp_level === "qm";
      if (filter === "playoff") return m.comp_level !== "qm";
      return true;
    });
  }, [matches, filter]);

  function compLabel(m: Match) {
    const hasLegacy =
      m.comp_level !== "qm" && !m.set_number && m.match_number >= 100;
    const normalizedSet = hasLegacy
      ? Math.floor(m.match_number / 100)
      : m.set_number ?? null;
    const normalizedMatch = hasLegacy ? m.match_number % 100 : m.match_number;

    if (m.comp_level === "qm") return `Q${normalizedMatch}`;

    const prefix =
      m.comp_level === "sf"
        ? "SF"
        : m.comp_level === "f"
        ? "F"
        : m.comp_level.toUpperCase();

    return normalizedSet
      ? `${prefix} ${normalizedSet}-${normalizedMatch}`
      : `${prefix} ${normalizedMatch}`;
  }

  function getTeamForPosition(match: Match, position: string): number {
    const idx = parseInt(position.slice(-1)) - 1;
    if (position.startsWith("red")) return match.red_teams[idx] ?? 0;
    return match.blue_teams[idx] ?? 0;
  }

  function setAssignment(matchId: string, position: string, scoutId: string) {
    setAssignmentMap((prev) => {
      const key = `${matchId}-${position}`;
      if (scoutId === "") {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: scoutId };
    });
    setSuccess(false);
  }

  function autoRotate() {
    if (members.length === 0) return;

    const newMap: Record<string, string> = {};
    let scoutIndex = 0;
    const scoutIds = members.map((m) => m.id);
    const numScouts = scoutIds.length;

    // Track consecutive assignments per scout
    const consecutiveCount: Record<string, number> = {};
    for (const id of scoutIds) consecutiveCount[id] = 0;

    for (const match of filteredMatches) {
      const assignedThisMatch = new Set<string>();

      for (const pos of POSITIONS) {
        // Find next available scout
        let attempts = 0;
        while (attempts < numScouts) {
          const candidateId = scoutIds[scoutIndex % numScouts];
          scoutIndex++;
          attempts++;

          // Skip if already assigned to this match
          if (assignedThisMatch.has(candidateId)) continue;

          // Skip if >2 consecutive matches (give them a break)
          if (consecutiveCount[candidateId] >= 3 && numScouts > 6) continue;

          newMap[`${match.id}-${pos}`] = candidateId;
          assignedThisMatch.add(candidateId);
          break;
        }
      }

      // Update consecutive counts
      for (const id of scoutIds) {
        if (assignedThisMatch.has(id)) {
          consecutiveCount[id]++;
        } else {
          consecutiveCount[id] = 0;
        }
      }
    }

    setAssignmentMap(newMap);
    setSuccess(false);
  }

  function clearAll() {
    setAssignmentMap({});
    setSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);

    // Delete existing assignments for these matches
    const matchIds = filteredMatches.map((m) => m.id);
    if (matchIds.length === 0) {
      setSuccess(true);
      setSaving(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("scout_assignments")
      .delete()
      .eq("org_id", orgId)
      .in("match_id", matchIds);

    if (deleteError) {
      setError(deleteError.message);
      setSaving(false);
      return;
    }

    // Build insert rows
    const rows: Array<{
      match_id: string;
      position: string;
      team_number: number;
      assigned_to: string;
      org_id: string;
    }> = [];

    for (const match of filteredMatches) {
      for (const pos of POSITIONS) {
        const key = `${match.id}-${pos}`;
        const scoutId = assignmentMap[key];
        if (scoutId) {
          rows.push({
            match_id: match.id,
            position: pos,
            team_number: getTeamForPosition(match, pos),
            assigned_to: scoutId,
            org_id: orgId,
          });
        }
      }
    }

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("scout_assignments")
        .insert(rows);

      if (insertError) {
        setError(insertError.message);
        setSaving(false);
        return;
      }
    }

    setSuccess(true);
    setSaving(false);
    router.refresh();
  }

  // Stats
  const totalSlots = filteredMatches.length * 6;
  const filledSlots = Object.keys(assignmentMap).filter((key) =>
    filteredMatches.some((m) => key.startsWith(m.id))
  ).length;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-md border border-white/10 bg-white/5">
          {(
            [
              ["qm", "Quals"],
              ["playoff", "Playoffs"],
              ["all", "All"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`px-3 py-1.5 text-sm font-medium ${
                filter === value
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={autoRotate}
          className="rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-500"
        >
          Auto-Rotate
        </button>
        <button
          onClick={clearAll}
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-gray-200 hover:bg-white/5"
        >
          Clear All
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Assignments"}
        </button>

        <span className="ml-auto text-xs text-gray-400">
          {filledSlots}/{totalSlots} slots filled &middot;{" "}
          {members.length} scouts
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-200">
          Assignments saved!
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gray-900/60 shadow-sm">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-white/5">
            <tr>
              <th className="sticky left-0 z-10 bg-white/5 px-3 py-2 text-left text-xs font-medium uppercase text-gray-400">
                Match
              </th>
              {POSITIONS.map((pos) => (
                <th
                  key={pos}
                  className={`px-2 py-2 text-center text-xs font-medium uppercase ${
                    pos.startsWith("red")
                      ? "bg-red-500/10 text-red-200"
                      : "bg-blue-500/10 text-blue-200"
                  }`}
                >
                  {pos.replace("red", "R").replace("blue", "B")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredMatches.map((match) => (
              <tr key={match.id} className="hover:bg-white/5">
                <td className="sticky left-0 z-10 bg-gray-900/80 whitespace-nowrap px-3 py-1.5 font-medium text-white">
                  {compLabel(match)}
                </td>
                {POSITIONS.map((pos) => {
                  const teamNum = getTeamForPosition(match, pos);
                  const key = `${match.id}-${pos}`;
                  const selectedScout = assignmentMap[key] ?? "";

                  return (
                    <td
                      key={pos}
                      className={`px-1 py-1 ${
                        pos.startsWith("red")
                          ? "bg-red-500/5"
                          : "bg-blue-500/5"
                      }`}
                    >
                      <div className="text-center">
                        <p className="text-[10px] text-gray-500 mb-0.5">
                          {teamNum}
                        </p>
                        <select
                          value={selectedScout}
                          onChange={(e) =>
                            setAssignment(match.id, pos, e.target.value)
                          }
                          className="w-full min-w-[80px] rounded border border-white/10 bg-white/5 px-1 py-0.5 text-xs text-gray-200 focus:border-blue-400 focus:outline-none"
                        >
                          <option value="">—</option>
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.display_name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredMatches.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-8 text-center">
          <p className="text-gray-400">
            No matches found. Sync the event first.
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { updateOrganizationTeamNumber, clearOrganizationTeamNumber } from "@/lib/staff-actions";

interface OrgRow {
  id: string;
  name: string;
  team_number: number | null;
  join_code: string;
  created_at: string;
}

interface StaffPanelProps {
  organizations: OrgRow[];
}

export function StaffPanel({ organizations }: StaffPanelProps) {
  const [status, setStatus] = useState<string | null>(null);

  async function handleUpdate(formData: FormData) {
    setStatus(null);
    const result = await updateOrganizationTeamNumber(formData);
    if (result?.error) {
      setStatus(result.error);
      return;
    }
    setStatus("Team number updated.");
  }

  async function handleClear(formData: FormData) {
    setStatus(null);
    const result = await clearOrganizationTeamNumber(formData);
    if (result?.error) {
      setStatus(result.error);
      return;
    }
    setStatus("Team number cleared.");
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Organizations</h2>
        <span className="text-xs text-gray-400">{organizations.length} total</span>
      </div>

      {status && (
        <p className="mt-3 rounded-md bg-white/5 px-3 py-2 text-sm text-gray-200">
          {status}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {organizations.map((org) => (
          <div
            key={org.id}
            className="rounded-xl border border-white/10 bg-gray-950/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">{org.name}</p>
                <p className="mt-1 text-xs text-gray-400">
                  Join code: <span className="font-mono text-gray-200">{org.join_code}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-gray-300">
                  Team #{org.team_number ?? "—"}
                </span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <form action={handleUpdate} className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="orgId" value={org.id} />
                <div>
                  <label className="block text-xs font-medium text-gray-400">Team Number</label>
                  <input
                    name="teamNumber"
                    type="number"
                    defaultValue={org.team_number ?? ""}
                    className="mt-1 w-36 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    min={1}
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
                >
                  Update
                </button>
              </form>
              <form action={handleClear}>
                <input type="hidden" name="orgId" value={org.id} />
                <button
                  type="submit"
                  className="rounded-md border border-red-500/40 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10"
                >
                  Clear Team #
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

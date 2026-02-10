"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { leaveOrganization } from "@/lib/auth-actions";

interface LeaveTeamButtonProps {
  label?: string;
}

export function LeaveTeamButton({ label = "Leave team" }: LeaveTeamButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleLeave() {
    const confirmed = window.confirm(
      "Are you sure you want to leave this team? You will lose access to team data."
    );
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const result = await leaveOrganization();
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.replace("/join");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleLeave}
        disabled={isPending}
        className="inline-flex items-center rounded-lg border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-300 transition hover:border-red-400/60 hover:bg-red-500/10 disabled:opacity-60"
      >
        {isPending ? "Leaving..." : label}
      </button>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}

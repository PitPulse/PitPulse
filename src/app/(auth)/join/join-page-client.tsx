"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { createOrganization, joinOrganization } from "@/lib/auth-actions";
import { ConfirmDialog } from "@/components/confirm-dialog";

export default function JoinPageClient({
  prefillCode = "",
}: {
  prefillCode?: string;
}) {
  const [mode, setMode] = useState<"choose" | "create" | "join">(
    prefillCode ? "join" : "choose"
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [teamLookup, setTeamLookup] = useState<{
    name: string | null;
    taken: boolean;
    loading: boolean;
  }>({ name: null, taken: false, loading: false });
  const [pendingCreate, setPendingCreate] = useState<{
    teamNumber: string;
    teamName: string | null;
  } | null>(null);

  const lookupTeam = useCallback(async (number: string) => {
    if (number.length < 1) {
      setTeamLookup({ name: null, taken: false, loading: false });
      return;
    }

    setTeamLookup((prev) => ({ ...prev, loading: true }));

    try {
      const res = await fetch(`/api/teams/lookup?number=${number}`);
      if (res.ok) {
        const data = await res.json();
        setTeamLookup({
          name: data.name,
          taken: data.taken,
          loading: false,
        });
      } else {
        setTeamLookup({ name: null, taken: false, loading: false });
      }
    } catch {
      setTeamLookup({ name: null, taken: false, loading: false });
    }
  }, []);

  async function handleCreate(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await createOrganization(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      // Full page navigation to ensure fresh server state
      // (router.push uses cached RSC payload and the dashboard
      // would still see org_id as null)
      window.location.href = "/dashboard";
    }
  }

  function handleCreateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    const formData = new FormData(e.currentTarget);
    const teamNumberRaw = (formData.get("teamNumber") as string | null) ?? "";
    const teamNumber = teamNumberRaw.replace(/[^0-9]/g, "").trim();

    if (!teamNumber) {
      setError("Please enter your FRC team number.");
      return;
    }

    setPendingCreate({
      teamNumber,
      teamName: teamLookup.name,
    });
  }

  async function confirmCreateTeam() {
    if (!pendingCreate) return;

    const formData = new FormData();
    formData.set("teamNumber", pendingCreate.teamNumber);
    setPendingCreate(null);
    await handleCreate(formData);
  }

  async function handleJoin(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await joinOrganization(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      window.location.href = "/onboarding";
    }
  }

  return (
    <div className="marketing-content flex min-h-[calc(100vh-65px)] items-center justify-center px-4">
      {/* Background gradient */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <motion.div
          className="absolute top-1/3 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-cyan-600/10 blur-3xl"
          animate={{ y: [0, -20, 0], x: [0, 15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-12 right-1/4 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl"
          animate={{ y: [0, 18, 0], x: [0, -12, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md space-y-6"
      >
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Set up your team
          </h1>
          <p className="mt-2 text-sm text-gray-400">
            Register your FRC team or join an existing one
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          {mode === "choose" && (
            <motion.div
              key="choose"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <motion.button
                onClick={() => setMode("create")}
                className="w-full rounded-xl border border-teal-500/30 bg-teal-500/10 p-5 text-left transition hover:border-teal-500/50 hover:bg-teal-400/20"
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <line x1="19" y1="8" x2="19" y2="14" />
                      <line x1="22" y1="11" x2="16" y2="11" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Register your team</p>
                    <p className="text-xs text-gray-400">First person from your FRC team to sign up</p>
                  </div>
                </div>
              </motion.button>
              <motion.button
                onClick={() => setMode("join")}
                className="w-full rounded-xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-white/20 hover:bg-white/10"
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" />
                      <line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Join existing team</p>
                  <p className="text-xs text-gray-400">Enter the 6-character code from your team captain</p>
                  </div>
                </div>
              </motion.button>
            </motion.div>
          )}

          {mode === "create" && (
            <motion.div
              key="create"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="marketing-card rounded-xl p-8"
            >
              <form onSubmit={handleCreateSubmit} className="space-y-5">
              <div>
                <label htmlFor="teamNumber" className="block text-sm font-medium text-gray-300">
                  FRC Team Number
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-400 whitespace-nowrap">Team</span>
                  <input
                    id="teamNumber"
                    name="teamNumber"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    maxLength={5}
                    onInput={(e) => {
                      const val = e.currentTarget.value.replace(/[^0-9]/g, "");
                      e.currentTarget.value = val;
                      if (val.length >= 1) {
                        lookupTeam(val);
                      } else {
                        setTeamLookup({ name: null, taken: false, loading: false });
                      }
                    }}
                    className="marketing-input block w-full rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 shadow-sm focus:outline-none"
                    placeholder="2443"
                  />
                </div>
                {/* TBA lookup result */}
                {teamLookup.loading && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Looking up team...
                  </p>
                )}
                {!teamLookup.loading && teamLookup.taken && (
                  <div className="mt-1.5 space-y-1">
                    <p className="text-xs text-red-400">
                      This team number is already registered by another organization.
                    </p>
                    <p className="text-xs text-gray-400">
                      If this is your team and you need help,{" "}
                      <Link href="/contact" className="font-medium text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
                        contact us
                      </Link>
                      .
                    </p>
                  </div>
                )}
                {!teamLookup.loading && !teamLookup.taken && teamLookup.name && (
                  <p className="mt-1.5 text-xs text-green-400">
                    ✓ {teamLookup.name}
                  </p>
                )}
                {!teamLookup.loading && !teamLookup.taken && !teamLookup.name && (
                  <p className="mt-1.5 text-xs text-gray-500">
                    Your team name will be auto-filled from The Blue Alliance.
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || teamLookup.taken}
                className="w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-teal-500/20 transition hover:bg-teal-400 disabled:opacity-50"
              >
                {loading ? "Setting up team..." : "Register team"}
              </button>
              <button
                type="button"
                onClick={() => { setMode("choose"); setError(null); }}
                className="back-button back-button-block"
              >
                Back
              </button>
              </form>
            </motion.div>
          )}

          {mode === "join" && (
            <motion.div
              key="join"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="marketing-card rounded-xl p-8"
            >
              <form action={handleJoin} className="space-y-5">
              <div>
                <label htmlFor="joinCode" className="block text-sm font-medium text-gray-300">
                  Join Code
                </label>
                <input
                  id="joinCode"
                  name="joinCode"
                  type="text"
                  required
                  maxLength={6}
                  defaultValue={prefillCode}
                  className="marketing-input mt-1 block w-full rounded-lg px-3 py-2.5 text-center text-lg font-mono tracking-[0.3em] text-white uppercase placeholder-gray-500 shadow-sm focus:outline-none"
                  placeholder="ABC123"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Ask your team captain for the 6-character join code
                </p>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-teal-500/20 transition hover:bg-teal-400 disabled:opacity-50"
              >
                {loading ? "Joining..." : "Join team"}
              </button>
              <button
                type="button"
                onClick={() => { setMode("choose"); setError(null); }}
                className="back-button back-button-block"
              >
                Back
              </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <ConfirmDialog
        open={!!pendingCreate}
        title="Confirm Team Registration"
        description={
          pendingCreate
            ? (
                <div className="space-y-3">
                  <div className="rounded-lg border border-cyan-300/30 bg-cyan-400/10 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200/90">
                      You are registering
                    </p>
                    <p className="mt-1 text-base font-semibold text-white">
                      Team {pendingCreate.teamNumber}
                    </p>
                    {pendingCreate.teamName && (
                      <p className="mt-0.5 text-xs text-cyan-100/90">{pendingCreate.teamName}</p>
                    )}
                  </div>
                  <p className="text-sm text-gray-200">
                    Double-check this is your official FRC team number before continuing.
                  </p>
                </div>
              )
            : undefined
        }
        confirmLabel={loading ? "Registering..." : "Yes, register team"}
        cancelLabel="Go back"
        tone="warning"
        confirmDisabled={loading}
        onConfirm={() => void confirmCreateTeam()}
        onClose={() => {
          if (loading) return;
          setPendingCreate(null);
        }}
      />
    </div>
  );
}

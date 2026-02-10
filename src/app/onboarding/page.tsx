"use client";

import { useState } from "react";
import { completeOnboarding } from "@/lib/auth-actions";

const ROLE_OPTIONS = [
  { value: "driver", label: "Driver" },
  { value: "coach", label: "Coach" },
  { value: "programmer", label: "Programmer" },
  { value: "strategist", label: "Strategist" },
  { value: "scout", label: "Scout" },
  { value: "data", label: "Data / Analytics" },
  { value: "mechanical", label: "Mechanical" },
  { value: "electrical", label: "Electrical" },
  { value: "cad", label: "CAD / Design" },
  { value: "pit", label: "Pit Crew" },
  { value: "mentor", label: "Mentor" },
  { value: "other", label: "Other" },
];

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    const result = await completeOnboarding(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/3 h-96 w-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute top-10 right-1/4 h-72 w-72 rounded-full bg-purple-600/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-lg items-center px-4 pb-16 pt-28">
        <div className="w-full rounded-2xl border border-white/10 bg-gray-900/70 p-8 shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            Team onboarding
          </p>
          <h1 className="mt-2 text-2xl font-bold">Tell us about your role</h1>
          <p className="mt-2 text-sm text-gray-300">
            This helps your team organize assignments and strategy.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}

          <form action={handleSubmit} className="mt-6 space-y-6">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-200">
                Your name
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Jamie Chen"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-gray-200">Team roles</p>
              <p className="mt-1 text-xs text-gray-400">
                Select all that apply.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {ROLE_OPTIONS.map((role) => (
                  <label
                    key={role.value}
                    className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200"
                  >
                    <input
                      type="checkbox"
                      name="teamRoles"
                      value={role.value}
                      className="h-4 w-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? "Saving..." : "Continue to dashboard"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

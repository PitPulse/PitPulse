"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import { completeOnboarding } from "@/lib/auth-actions";

const ROLE_OPTIONS = [
  { value: "driver", label: "Driver" },
  { value: "coach", label: "Coach" },
  { value: "programmer", label: "Programmer" },
  { value: "scout", label: "Scout" },
  { value: "data", label: "Data / Analytics" },
  { value: "mechanical", label: "Mechanical" },
  { value: "electrical", label: "Electrical" },
  { value: "cad", label: "CAD / Design" },
  { value: "pit", label: "Pit Crew" },
  { value: "mentor", label: "Mentor" },
  { value: "other", label: "Other" },
];

const STEPS = [
  {
    title: "Profile",
    subtitle: "Set your display name",
    icon: UserRound,
  },
  {
    title: "Team Roles",
    subtitle: "Choose up to four roles",
    icon: UsersRound,
  },
  {
    title: "Confirm",
    subtitle: "Review and finish setup",
    icon: ShieldCheck,
  },
];

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const maxRoles = 4;
  const maxRolesReached = selectedRoles.length >= maxRoles;
  const totalSteps = STEPS.length;

  const progressPercent = useMemo(
    () => Math.round((step / totalSteps) * 100),
    [step, totalSteps]
  );

  function validateStep(targetStep: number) {
    if (targetStep >= 1 && !displayName.trim()) {
      return "Please enter your name.";
    }
    if (targetStep >= 2 && selectedRoles.length === 0) {
      return "Select at least one team role.";
    }
    return null;
  }

  function handleBack() {
    setError(null);
    setStep((prev) => Math.max(1, prev - 1));
  }

  function handleNext() {
    const nextStep = Math.min(totalSteps, step + 1);
    const stepError = validateStep(step);
    if (stepError) {
      setError(stepError);
      return;
    }
    setError(null);
    setStep(nextStep);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (step < totalSteps) {
      const stepError = validateStep(step);
      if (stepError) {
        setError(stepError);
        return;
      }

      setError(null);
      setStep((prev) => Math.min(totalSteps, prev + 1));
      return;
    }

    const stepError = validateStep(totalSteps);
    if (stepError) {
      setError(stepError);
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.set("displayName", displayName.trim());
    selectedRoles.forEach((role) => formData.append("teamRoles", role));

    const result = await completeOnboarding(formData);
    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }
    window.location.href = "/dashboard";
  }

  const CurrentStepIcon = STEPS[step - 1].icon;

  return (
    <div className="marketing-shell text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-44 left-1/4 h-[32rem] w-[32rem] rounded-full bg-[#43d9a2]/16 blur-3xl" />
        <div className="absolute right-8 top-20 h-96 w-96 rounded-full bg-cyan-500/14 blur-3xl" />
        <div className="absolute -bottom-40 left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-teal-400/10 blur-3xl" />
      </div>

      <div className="marketing-content mx-auto flex min-h-screen max-w-4xl items-center px-4 pb-16 pt-32">
        <form
          onSubmit={handleSubmit}
          className="marketing-card w-full rounded-3xl border border-white/10 p-6 sm:p-8"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[#43d9a2]">
                Team onboarding
              </p>
              <h1 className="mt-2 font-outfit text-3xl font-bold leading-tight text-white sm:text-4xl">
                Setup your scouting profile
              </h1>
              <p className="mt-2 max-w-xl text-sm text-slate-300 sm:text-base">
                Quick 3-step setup so your team can assign scouts and coordinate match strategy.
              </p>
            </div>

            <div className="rounded-2xl border border-[#43d9a2]/30 bg-[#43d9a2]/10 px-4 py-3 text-right shadow-[0_0_28px_-16px_rgba(67,217,162,0.95)]">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8cf2ce]">
                Current step
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {step}/{totalSteps} · {STEPS[step - 1].title}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-[#0b101a]/80 p-4 backdrop-blur-md">
            <div
              className="h-2 w-full rounded-full bg-white/10"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-label="Onboarding progress"
            >
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#2bd3a3] via-[#43d9a2] to-[#35c9ee] shadow-[0_0_20px_-6px_rgba(67,217,162,0.9)]"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.32, ease: "easeOut" }}
              />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {STEPS.map((item, index) => {
                const stepNumber = index + 1;
                const active = stepNumber === step;
                const complete = stepNumber < step;
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className={`rounded-xl border px-3 py-2 transition ${
                      active
                        ? "border-[#43d9a2]/55 bg-[#43d9a2]/12 shadow-[0_0_24px_-16px_rgba(67,217,162,0.8)]"
                        : complete
                          ? "border-cyan-400/40 bg-cyan-400/10"
                          : "border-white/10 bg-white/[0.02]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${
                          active
                            ? "border-[#43d9a2]/60 bg-[#43d9a2]/20 text-[#aaf6dd]"
                            : complete
                              ? "border-cyan-300/60 bg-cyan-400/20 text-cyan-100"
                              : "border-white/20 text-slate-400"
                        }`}
                      >
                        {complete ? <Check className="h-3.5 w-3.5" /> : stepNumber}
                      </span>
                      <Icon className="h-4 w-4 text-slate-200" />
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{item.subtitle}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-white/10 bg-[#0b101a]/65 p-5">
            <div className="mb-4 flex items-center gap-2 text-slate-200">
              <CurrentStepIcon className="h-4 w-4 text-[#7eecc8]" />
              <p className="font-semibold">
                {STEPS[step - 1].title} · {STEPS[step - 1].subtitle}
              </p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
              >
                {step === 1 ? (
                  <div>
                    <label htmlFor="displayName" className="block text-sm font-medium text-slate-200">
                      Your name
                    </label>
                    <input
                      id="displayName"
                      name="displayName"
                      type="text"
                      value={displayName}
                      required
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="marketing-input mt-2 w-full rounded-xl px-3 py-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#43d9a2]/30"
                      placeholder="e.g. Jamie Chen"
                    />
                    <p className="mt-2 text-xs text-slate-400">
                      This will be shown across team scouting reports and Team Pulse.
                    </p>
                  </div>
                ) : step === 2 ? (
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-200">Team roles</p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          maxRolesReached
                            ? "bg-cyan-400/20 text-cyan-100"
                            : "bg-white/10 text-slate-300"
                        }`}
                      >
                        {selectedRoles.length}/{maxRoles}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Pick up to {maxRoles} roles.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {ROLE_OPTIONS.map((role) => {
                        const checked = selectedRoles.includes(role.value);
                        const disabled = !checked && maxRolesReached;
                        return (
                          <label
                            key={role.value}
                            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                              checked
                                ? "border-[#43d9a2]/60 bg-[#43d9a2]/14 text-white shadow-[0_0_20px_-16px_rgba(67,217,162,0.95)]"
                                : disabled
                                  ? "border-white/10 bg-white/5 text-slate-500"
                                  : "border-white/10 bg-white/[0.02] text-slate-200 hover:border-cyan-300/35 hover:bg-cyan-300/8"
                            }`}
                          >
                            <input
                              type="checkbox"
                              value={role.value}
                              checked={checked}
                              disabled={disabled}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...selectedRoles, role.value]
                                  : selectedRoles.filter((item) => item !== role.value);
                                setSelectedRoles(next);
                              }}
                              className="h-4 w-4 rounded border-white/20 bg-white/5 text-[#43d9a2] focus:ring-[#43d9a2]"
                            />
                            {role.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#79efd0]">
                        Display name
                      </p>
                      <p className="mt-1 text-lg font-semibold text-white">
                        {displayName.trim() || "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#79efd0]">
                        Team roles
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedRoles.length === 0 ? (
                          <p className="text-sm text-slate-400">No roles selected yet.</p>
                        ) : (
                          selectedRoles.map((role) => {
                            const label =
                              ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role;
                            return (
                              <span
                                key={role}
                                className="rounded-full border border-cyan-300/35 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-100"
                              >
                                {label}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">
                      You can update these later in team settings.
                    </p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1 || loading}
              className="rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-cyan-300/45 hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              Back
            </button>

            {step < totalSteps ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={loading}
                className="rounded-full bg-gradient-to-r from-[#2bcf9f] via-[#43d9a2] to-[#35c9ee] px-6 py-2.5 text-sm font-semibold text-[#041117] shadow-[0_0_28px_-12px_rgba(67,217,162,0.95)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-gradient-to-r from-[#2bcf9f] via-[#43d9a2] to-[#35c9ee] px-6 py-2.5 text-sm font-semibold text-[#041117] shadow-[0_0_28px_-12px_rgba(67,217,162,0.95)] transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Saving..." : "Finish setup"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

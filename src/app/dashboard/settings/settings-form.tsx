"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { updateOrganization } from "@/lib/auth-actions";
import { updateMemberRole } from "@/lib/captain-actions";
import { DeleteTeamButton } from "@/components/delete-team-button";

interface TeamSettingsFormProps {
  org: {
    name: string;
    teamNumber: number | null;
    joinCode: string;
    planTier: "free" | "supporter";
  };
  billingOverview: {
    stripeConfigured: boolean;
    subscription: {
      id: string;
      status: string;
      currentPeriodStart: number | null;
      currentPeriodEnd: number | null;
      cancelAtPeriodEnd: boolean;
      cancelAt: number | null;
      customerId: string;
    } | null;
    invoices: Array<{
      id: string;
      status: string | null;
      currency: string;
      amountPaid: number;
      amountDue: number;
      created: number;
      hostedInvoiceUrl: string | null;
    }>;
    error: string | null;
  } | null;
  members: {
    id: string;
    display_name: string;
    role: string;
    created_at: string;
  }[];
  memberCount: number;
  isCaptain: boolean;
}

export function TeamSettingsForm({
  org,
  billingOverview,
  members,
  memberCount,
  isCaptain,
}: TeamSettingsFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [memberStatus, setMemberStatus] = useState<string | null>(null);

  // Team settings state
  const [teamName, setTeamName] = useState(org.name);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamMessage, setTeamMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planMessage, setPlanMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const billingState = searchParams.get("billing");
    if (!billingState) return;

    if (billingState === "success") {
      setPlanMessage({
        type: "success",
        text: "Supporter checkout completed. Plan updates after webhook confirmation.",
      });
      return;
    }

    if (billingState === "cancel") {
      setPlanMessage({
        type: "error",
        text: "Checkout canceled. No billing changes were made.",
      });
      return;
    }

    if (billingState === "portal") {
      setPlanMessage({
        type: "success",
        text: "Returned from billing portal.",
      });
    }
  }, [searchParams]);

  async function handleTeamSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTeamLoading(true);
    setTeamMessage(null);

    const formData = new FormData();
    formData.set("name", teamName);

    const result = await updateOrganization(formData);
    if (result?.error) {
      setTeamMessage({ type: "error", text: result.error });
    } else {
      setTeamMessage({ type: "success", text: "Team name updated." });
      router.refresh();
    }
    setTeamLoading(false);
  }

  async function handleMemberRoleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMemberStatus(null);

    const formData = new FormData(e.currentTarget);
    const result = await updateMemberRole(formData);

    if (result?.error) {
      setMemberStatus(result.error);
      return;
    }

    setMemberStatus("Member role updated.");
    router.refresh();
  }

  async function handleUpgradeCheckout() {
    setPlanLoading(true);
    setPlanMessage(null);

    try {
      const res = await fetch("/api/stripe/checkout", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; url?: string }
        | null;

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to start checkout.");
      }

      window.location.assign(data.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start checkout.";
      setPlanMessage({ type: "error", text: message });
      setPlanLoading(false);
    }
  }

  async function handleManageBilling() {
    setPlanLoading(true);
    setPlanMessage(null);

    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; url?: string }
        | null;

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Failed to open billing portal.");
      }

      window.location.assign(data.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open billing portal.";
      setPlanMessage({ type: "error", text: message });
      setPlanLoading(false);
    }
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(org.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function formatBillingDate(unixSeconds: number | null) {
    if (!unixSeconds) return "Not available";
    return new Date(unixSeconds * 1000).toLocaleString();
  }

  function formatInvoiceAmount(cents: number, currency: string) {
    const upper = currency.toUpperCase();
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: upper,
      }).format(cents / 100);
    } catch {
      return `${(cents / 100).toFixed(2)} ${upper}`;
    }
  }

  function statusBadgeClass(status: string) {
    if (status === "active" || status === "trialing") {
      return "border-green-300/35 bg-green-500/10 text-green-200";
    }
    if (status === "past_due" || status === "unpaid") {
      return "border-amber-300/35 bg-amber-500/10 text-amber-200";
    }
    return "border-white/20 bg-white/10 text-gray-200";
  }

  return (
    <div className="space-y-6">

        {/* Team Info */}
        <div className="rounded-2xl dashboard-panel p-6">
          <h3 className="text-lg font-semibold text-white">Team Info</h3>
          <p className="mt-1 text-sm text-gray-300">
            {isCaptain
              ? "Manage your team's display name. This overrides the name from The Blue Alliance."
              : "Only captains can edit team settings."}
          </p>

          <div className="mt-4 space-y-4">
            {org.teamNumber && (
              <div>
                <label className="block text-sm font-medium text-gray-300">
                  Team Number
                </label>
                <p className="mt-1 text-sm text-white">{org.teamNumber}</p>
              </div>
            )}

            <form onSubmit={handleTeamSubmit} className="space-y-3">
              <div>
                <label htmlFor="teamName" className="block text-sm font-medium text-gray-300">
                  Team Name
                </label>
                <input
                  id="teamName"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  disabled={!isCaptain}
                  className="mt-1 block w-full px-3 py-2 text-sm text-white shadow-sm dashboard-input disabled:bg-white/5 disabled:text-gray-400"
                />
              </div>

              {teamMessage && (
                <p className={`text-sm ${teamMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
                  {teamMessage.text}
                </p>
              )}

              {isCaptain && (
                <button
                  type="submit"
                  disabled={teamLoading || teamName === org.name}
                  className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-400 disabled:opacity-50"
                >
                  {teamLoading ? "Saving..." : "Save team name"}
                </button>
              )}
            </form>
          </div>
        </div>

        {isCaptain && (
          <div className="rounded-2xl dashboard-panel p-6">
            <h3 className="text-lg font-semibold text-white">Team Members</h3>
            <p className="mt-1 text-sm text-gray-300">
              Promote teammates to captain or scout roles.
            </p>

            <div className="mt-4 space-y-3">
              {members.length === 0 ? (
                <p className="text-sm text-gray-400">No members found.</p>
              ) : (
                members.map((member) => (
                  <form
                    key={member.id}
                    onSubmit={handleMemberRoleSubmit}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-gray-950/60 px-3 py-2 dashboard-panel"
                  >
                    <input type="hidden" name="memberId" value={member.id} />
                    <div>
                      <p className="text-sm font-medium text-white">{member.display_name}</p>
                      <p className="text-xs text-gray-400">{member.id}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        name="role"
                        defaultValue={member.role}
                        className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white dashboard-input"
                      >
                        <option value="scout">Scout</option>
                        <option value="captain">Captain</option>
                      </select>
                      <button
                        type="submit"
                        className="rounded-lg bg-teal-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-400"
                      >
                        Update
                      </button>
                    </div>
                  </form>
                ))
              )}
            </div>

            {memberStatus && (
              <p className="mt-3 text-sm text-gray-200">{memberStatus}</p>
            )}
          </div>
        )}

        {/* Organization */}
        <div className="rounded-2xl dashboard-panel p-6">
          <h3 className="text-lg font-semibold text-white">Organization</h3>
          <p className="mt-1 text-sm text-gray-300">
            Share the join code with teammates so they can join your organization.
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300">
                Join Code
              </label>
              <div className="mt-1 flex items-center gap-2">
                <code className="rounded-md border border-white/10 bg-white/5 px-3 py-2 font-mono text-sm tracking-widest text-white">
                  {org.joinCode}
                </code>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300">
                Members
              </label>
              <p className="mt-1 text-sm text-white">
                {memberCount} {memberCount === 1 ? "member" : "members"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl dashboard-panel p-6">
          <h3 className="text-lg font-semibold text-white">Plan</h3>
          <p className="mt-1 text-sm text-gray-300">
            Plans are shared by your whole team.
          </p>

          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-white/10 bg-gray-950/60 p-4">
              <p className="text-sm text-gray-300">Current plan</p>
              <p className="mt-1 text-lg font-semibold text-white">
                {org.planTier === "supporter" ? "Supporter ($5.99/team/month)" : "Free"}
              </p>
              <p className="mt-1 text-sm text-gray-400">
                {org.planTier === "supporter"
                  ? "Higher AI usage limits for your team."
                  : "Unlimited prompts with usage limits."}
              </p>
            </div>

            {isCaptain && (
              <div className="rounded-lg border border-white/10 bg-gray-950/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-300">Billing status</p>
                  {billingOverview?.subscription ? (
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${statusBadgeClass(
                        billingOverview.subscription.status
                      )}`}
                    >
                      {billingOverview.subscription.status.replaceAll("_", " ")}
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-200">
                      No subscription
                    </span>
                  )}
                </div>

                {!billingOverview?.stripeConfigured ? (
                  <p className="mt-2 text-xs text-amber-200">
                    Stripe is not fully configured on the server yet.
                  </p>
                ) : billingOverview.error ? (
                  <p className="mt-2 text-xs text-red-300">{billingOverview.error}</p>
                ) : billingOverview.subscription ? (
                  <div className="mt-2 space-y-1 text-xs text-gray-300">
                    <p>
                      Current period: {formatBillingDate(billingOverview.subscription.currentPeriodStart)} to{" "}
                      {formatBillingDate(billingOverview.subscription.currentPeriodEnd)}
                    </p>
                    <p>
                      Renewal behavior:{" "}
                      {billingOverview.subscription.cancelAtPeriodEnd
                        ? "Cancels at period end"
                        : "Auto-renews"}
                    </p>
                    {billingOverview.subscription.cancelAt && (
                      <p>Cancellation date: {formatBillingDate(billingOverview.subscription.cancelAt)}</p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-400">
                    No subscription has been created for this team yet.
                  </p>
                )}

                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-300">
                    Recent invoices
                  </p>
                  {billingOverview && billingOverview.invoices.length > 0 ? (
                    <ul className="mt-2 space-y-1.5 text-xs text-gray-300">
                      {billingOverview.invoices.slice(0, 5).map((invoice) => (
                        <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>
                            {new Date(invoice.created * 1000).toLocaleDateString()} ·{" "}
                            {(invoice.status ?? "unknown").replaceAll("_", " ")}
                          </span>
                          <span className="font-medium text-gray-200">
                            {formatInvoiceAmount(
                              invoice.amountPaid > 0 ? invoice.amountPaid : invoice.amountDue,
                              invoice.currency
                            )}
                          </span>
                          {invoice.hostedInvoiceUrl && (
                            <a
                              href={invoice.hostedInvoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-300 hover:text-cyan-200"
                            >
                              View
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-gray-400">No invoices yet.</p>
                  )}
                </div>
              </div>
            )}

            {isCaptain ? (
              <div className="flex flex-wrap items-center gap-2">
                {org.planTier !== "supporter" ? (
                  <button
                    type="button"
                    disabled={planLoading}
                    onClick={() => void handleUpgradeCheckout()}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {planLoading ? "Redirecting..." : "Upgrade to Supporter"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={planLoading}
                    onClick={() => void handleManageBilling()}
                    className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {planLoading ? "Redirecting..." : "Manage billing"}
                  </button>
                )}
                <p className="text-xs text-gray-400">
                  Billing runs through Stripe checkout and customer portal.
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">
                Only captains can change plans.
              </p>
            )}

            {planMessage && (
              <p className={`text-sm ${planMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
                {planMessage.text}
              </p>
            )}
          </div>
        </div>

        {isCaptain && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
            <h3 className="text-lg font-semibold text-red-200">Danger Zone</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-100/95">
              Delete this team and remove every member from it. This action is
              permanent.
            </p>
            <div className="mt-4">
              <DeleteTeamButton />
            </div>
          </div>
        )}
    </div>
  );
}

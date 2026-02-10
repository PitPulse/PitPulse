"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrganization, updateProfile } from "@/lib/auth-actions";
import { updateMemberRole } from "@/lib/captain-actions";

interface SettingsFormProps {
  profile: {
    displayName: string;
    email: string;
    role: string;
  };
  org: {
    name: string;
    teamNumber: number | null;
    joinCode: string;
  };
  members: {
    id: string;
    display_name: string;
    role: string;
    created_at: string;
  }[];
  memberCount: number;
  isCaptain: boolean;
}

export function SettingsForm({
  profile,
  org,
  members,
  memberCount,
  isCaptain,
}: SettingsFormProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [memberStatus, setMemberStatus] = useState<string | null>(null);

  // Team settings state
  const [teamName, setTeamName] = useState(org.name);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamMessage, setTeamMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Account settings state
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [accountLoading, setAccountLoading] = useState(false);
  const [accountMessage, setAccountMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  async function handleAccountSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAccountLoading(true);
    setAccountMessage(null);

    const formData = new FormData();
    formData.set("displayName", displayName);

    const result = await updateProfile(formData);
    if (result?.error) {
      setAccountMessage({ type: "error", text: result.error });
    } else {
      setAccountMessage({ type: "success", text: "Profile updated." });
      router.refresh();
    }
    setAccountLoading(false);
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

  function handleCopyCode() {
    navigator.clipboard.writeText(org.joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Team Info */}
      <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
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
                className="mt-1 block w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-white/5 disabled:text-gray-400"
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
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {teamLoading ? "Saving..." : "Save team name"}
              </button>
            )}
          </form>
        </div>
      </div>

      {isCaptain && (
        <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-white">Team Members</h3>
          <p className="mt-1 text-sm text-gray-300">
            Promote teammates to strategist or captain roles.
          </p>

          <div className="mt-4 space-y-3">
            {members.length === 0 ? (
              <p className="text-sm text-gray-400">No members found.</p>
            ) : (
              members.map((member) => (
                <form
                  key={member.id}
                  onSubmit={handleMemberRoleSubmit}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-gray-950/60 px-3 py-2"
                >
                  <input type="hidden" name="memberId" value={member.id} />
                  <div>
                    <p className="text-sm font-medium text-white">{member.display_name}</p>
                    <p className="text-xs text-gray-500">{member.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      name="role"
                      defaultValue={member.role}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white"
                    >
                      <option value="scout">Scout</option>
                      <option value="strategist">Strategist</option>
                      <option value="captain">Captain</option>
                    </select>
                    <button
                      type="submit"
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
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
      <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
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
                className="rounded-md border border-white/10 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
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

      {/* Account */}
      <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-white">Account</h3>
        <p className="mt-1 text-sm text-gray-300">
          Your personal account settings.
        </p>

        <form onSubmit={handleAccountSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-300">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Email
            </label>
            <p className="mt-1 text-sm text-white">{profile.email}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300">
              Role
            </label>
            <span className="mt-1 inline-block rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium capitalize text-blue-200">
              {profile.role}
            </span>
          </div>

          {accountMessage && (
            <p className={`text-sm ${accountMessage.type === "success" ? "text-green-400" : "text-red-400"}`}>
              {accountMessage.text}
            </p>
          )}

          <button
            type="submit"
            disabled={accountLoading || displayName === profile.displayName}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
          >
            {accountLoading ? "Saving..." : "Save profile"}
          </button>
        </form>
      </div>
    </div>
  );
}

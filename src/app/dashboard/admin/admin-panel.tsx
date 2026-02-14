"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteAnnouncement,
  deleteTestimonial,
  deleteContactMessage,
  deleteOrganization,
} from "@/lib/staff-actions";
import { Button } from "@/components/ui/button";
import { OverviewTab } from "./tabs/overview-tab";
import { AnalyticsTab } from "./tabs/analytics-tab";
import { AnnouncementsTab } from "./tabs/announcements-tab";
import { InboxTab } from "./tabs/inbox-tab";
import { TestimonialsTab } from "./tabs/testimonials-tab";
import { TeamsTab } from "./tabs/teams-tab";

/* ── Types ── */

interface OrgRow {
  id: string;
  name: string;
  team_number: number | null;
  join_code: string;
  created_at: string;
}

interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string;
  team: string;
  rating: number;
  sort_order: number;
  is_published: boolean;
}

interface Announcement {
  id: string;
  message: string;
  variant: string;
  is_active: boolean;
  created_at: string;
}

interface ContactMessage {
  id: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  response: string | null;
  created_at: string;
  responded_at: string | null;
}

interface TimePoint {
  date: string;
  count: number;
}

interface AdminPanelProps {
  stats: {
    organizations: number;
    users: number;
    entries: number;
    matches: number;
    events: number;
  };
  organizations: OrgRow[];
  testimonials: Testimonial[];
  announcements: Announcement[];
  contactMessages: ContactMessage[];
  analytics: {
    signups: TimePoint[];
    organizations: TimePoint[];
    scoutingEntries: TimePoint[];
    messages: TimePoint[];
  };
  eventSyncMinYear: number;
  scoutingAbilityQuestions: string[];
  teamAiPromptLimits: {
    free: number;
    supporter: number;
  };
  adminName: string;
  adminEmail: string;
}

type Tab = "overview" | "analytics" | "announcements" | "inbox" | "testimonials" | "teams";

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "grid" },
  { key: "analytics", label: "Analytics", icon: "chart" },
  { key: "announcements", label: "Announcements", icon: "megaphone" },
  { key: "inbox", label: "Inbox", icon: "mail" },
  { key: "testimonials", label: "Testimonials", icon: "quote" },
  { key: "teams", label: "Teams", icon: "users" },
];

/* ── Sidebar Icons ── */

function SidebarIcon({ type }: { type: string }) {
  const props = {
    xmlns: "http://www.w3.org/2000/svg",
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (type) {
    case "grid":
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
      );
    case "chart":
      return (
        <svg {...props}>
          <path d="M3 3v18h18" />
          <path d="M7 16l4-8 4 4 4-6" />
        </svg>
      );
    case "megaphone":
      return (
        <svg {...props}>
          <path d="m3 11 18-5v12L3 13v-2z" />
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
        </svg>
      );
    case "mail":
      return (
        <svg {...props}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case "quote":
      return (
        <svg {...props}>
          <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V21" />
          <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3" />
        </svg>
      );
    case "users":
      return (
        <svg {...props}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    default:
      return null;
  }
}

/* ── Main Component ── */

export function AdminPanel({
  stats,
  organizations,
  testimonials,
  announcements,
  contactMessages,
  analytics,
  eventSyncMinYear,
  scoutingAbilityQuestions,
  teamAiPromptLimits,
  adminName,
  adminEmail,
}: AdminPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [status, setStatus] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: string;
    id: string;
    label: string;
  } | null>(null);

  const refresh = () => startTransition(() => router.refresh());

  const showStatus = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(null), 3000);
  };

  const newInboxCount = contactMessages.filter((m) => m.status === "new").length;

  /* ── Delete handler ── */

  async function executeDelete() {
    if (!confirmDelete) return;
    const formData = new FormData();
    formData.set("id", confirmDelete.id);

    let result: { error?: string } | undefined;
    if (confirmDelete.type === "announcement") result = await deleteAnnouncement(formData);
    else if (confirmDelete.type === "testimonial") result = await deleteTestimonial(formData);
    else if (confirmDelete.type === "contact") result = await deleteContactMessage(formData);
    else if (confirmDelete.type === "organization") {
      formData.set("orgId", confirmDelete.id);
      result = await deleteOrganization(formData);
    }

    setConfirmDelete(null);
    if (result?.error) { showStatus(result.error); return; }
    showStatus("Deleted successfully.");
    refresh();
  }

  /* ── Tab content ── */

  function renderTab() {
    switch (activeTab) {
      case "overview":
        return (
          <OverviewTab
            stats={stats}
            eventSyncMinYear={eventSyncMinYear}
            scoutingAbilityQuestions={scoutingAbilityQuestions}
            teamAiPromptLimits={teamAiPromptLimits}
          />
        );
      case "analytics":
        return <AnalyticsTab analytics={analytics} />;
      case "announcements":
        return <AnnouncementsTab announcements={announcements} onStatus={showStatus} onConfirmDelete={setConfirmDelete} />;
      case "inbox":
        return <InboxTab contactMessages={contactMessages} onStatus={showStatus} onConfirmDelete={setConfirmDelete} />;
      case "testimonials":
        return <TestimonialsTab testimonials={testimonials} onStatus={showStatus} onConfirmDelete={setConfirmDelete} />;
      case "teams":
        return <TeamsTab organizations={organizations} onStatus={showStatus} onConfirmDelete={setConfirmDelete} />;
    }
  }

  return (
    <div className="admin-shell dashboard-page flex min-h-screen pt-14">
      {/* Mobile sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed top-16 left-4 z-40 flex h-10 w-10 items-center justify-center rounded-xl dashboard-panel text-gray-300 shadow-lg lg:hidden"
        aria-label="Toggle sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-14 left-0 z-30 flex h-[calc(100dvh-56px)] w-72 flex-col border-r border-white/10 bg-gray-950/95 backdrop-blur-xl transition-transform lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-white/10 px-5 py-4">
          <p className="text-base font-semibold text-white">
            <span className="text-teal-400">PitPilot</span>
            <span className="mx-2 text-gray-500">/</span>
            <span className="text-gray-200">Admin</span>
          </p>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {tabs.map((tab) => (
              <li key={tab.key}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.key);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    activeTab === tab.key
                      ? "bg-teal-500/15 text-teal-200 ring-1 ring-blue-400/30"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <SidebarIcon type={tab.icon} />
                  {tab.label}
                  {tab.key === "inbox" && newInboxCount > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500/20 px-1.5 text-xs font-bold text-red-300">
                      {newInboxCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto border-t border-white/10 p-4">
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-white">{adminName}</p>
            {adminEmail ? (
              <p className="truncate text-xs text-gray-400">{adminEmail}</p>
            ) : null}
            <span className="mt-2 inline-flex rounded-md bg-teal-500/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-teal-300">
              Admin
            </span>
          </div>
          <a
            href="/dashboard"
            className="back-button back-button-block"
          >
            Back to Dashboard
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:ml-72">
        <div className="mx-auto max-w-5xl px-4 py-8 lg:pl-4">
          {/* Status toast */}
          {status && (
            <div className="mb-4 rounded-xl dashboard-panel px-4 py-3 text-sm font-medium text-teal-200 border-teal-500/30 bg-teal-500/10">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-teal-400"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                {status}
              </div>
            </div>
          )}

          {/* Loading */}
          {isPending && (
            <div className="mb-4 flex items-center gap-2 text-xs text-gray-400 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
              Refreshing data...
            </div>
          )}

          {/* Active tab */}
          {renderTab()}
        </div>
      </main>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-2xl dashboard-panel p-6 shadow-2xl">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Confirm delete</h3>
                <p className="mt-1 text-sm text-gray-300">
                  Are you sure you want to delete this {confirmDelete.label}? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-6 flex items-center justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button type="button" variant="danger" onClick={executeDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

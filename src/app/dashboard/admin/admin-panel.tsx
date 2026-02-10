"use client";

import { useState } from "react";
import {
  updateOrganizationTeamNumber,
  clearOrganizationTeamNumber,
  upsertAnnouncement,
  deleteAnnouncement,
  upsertTestimonial,
  deleteTestimonial,
  respondContactMessage,
  deleteContactMessage,
} from "@/lib/staff-actions";

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
}

export function AdminPanel({
  stats,
  organizations,
  testimonials,
  announcements,
  contactMessages,
}: AdminPanelProps) {
  const [orgStatus, setOrgStatus] = useState<string | null>(null);
  const [announcementStatus, setAnnouncementStatus] = useState<string | null>(null);
  const [testimonialStatus, setTestimonialStatus] = useState<string | null>(null);
  const [contactStatus, setContactStatus] = useState<string | null>(null);

  const formatDateTime = (value: string | null) => {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return value;
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  async function handleUpdateOrg(formData: FormData) {
    setOrgStatus(null);
    const result = await updateOrganizationTeamNumber(formData);
    if (result?.error) {
      setOrgStatus(result.error);
      return;
    }
    setOrgStatus("Team number updated.");
  }

  async function handleClearOrg(formData: FormData) {
    setOrgStatus(null);
    const result = await clearOrganizationTeamNumber(formData);
    if (result?.error) {
      setOrgStatus(result.error);
      return;
    }
    setOrgStatus("Team number cleared.");
  }

  async function handleAnnouncementSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAnnouncementStatus(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await upsertAnnouncement(formData);

    if (result?.error) {
      setAnnouncementStatus(result.error);
      return;
    }

    setAnnouncementStatus("Announcement saved.");
    form.reset();
  }

  async function handleAnnouncementUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAnnouncementStatus(null);

    const formData = new FormData(e.currentTarget);
    const result = await upsertAnnouncement(formData);

    if (result?.error) {
      setAnnouncementStatus(result.error);
      return;
    }

    setAnnouncementStatus("Announcement updated.");
  }

  async function handleAnnouncementDelete(id: string) {
    setAnnouncementStatus(null);
    const formData = new FormData();
    formData.set("id", id);

    const result = await deleteAnnouncement(formData);
    if (result?.error) {
      setAnnouncementStatus(result.error);
      return;
    }

    setAnnouncementStatus("Announcement deleted.");
  }

  async function handleTestimonialSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTestimonialStatus(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await upsertTestimonial(formData);

    if (result?.error) {
      setTestimonialStatus(result.error);
      return;
    }

    setTestimonialStatus("Testimonial saved.");
    form.reset();
  }

  async function handleTestimonialUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTestimonialStatus(null);

    const formData = new FormData(e.currentTarget);
    const result = await upsertTestimonial(formData);

    if (result?.error) {
      setTestimonialStatus(result.error);
      return;
    }

    setTestimonialStatus("Testimonial updated.");
  }

  async function handleTestimonialDelete(id: string) {
    setTestimonialStatus(null);
    const formData = new FormData();
    formData.set("id", id);

    const result = await deleteTestimonial(formData);
    if (result?.error) {
      setTestimonialStatus(result.error);
      return;
    }

    setTestimonialStatus("Testimonial deleted.");
  }

  async function handleContactUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setContactStatus(null);

    const formData = new FormData(e.currentTarget);
    const result = await respondContactMessage(formData);

    if (result?.error) {
      setContactStatus(result.error);
      return;
    }

    setContactStatus("Response saved.");
  }

  async function handleContactDelete(id: string) {
    setContactStatus(null);
    const formData = new FormData();
    formData.set("id", id);

    const result = await deleteContactMessage(formData);
    if (result?.error) {
      setContactStatus(result.error);
      return;
    }

    setContactStatus("Message deleted.");
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-400">Organizations</p>
          <p className="mt-2 text-2xl font-bold">{stats.organizations}</p>
          <p className="text-xs text-gray-400">Registered teams</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-400">Users</p>
          <p className="mt-2 text-2xl font-bold">{stats.users}</p>
          <p className="text-xs text-gray-400">Profiles created</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-400">Scouting Entries</p>
          <p className="mt-2 text-2xl font-bold">{stats.entries}</p>
          <p className="text-xs text-gray-400">Total submissions</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-400">Matches</p>
          <p className="mt-2 text-2xl font-bold">{stats.matches}</p>
          <p className="text-xs text-gray-400">Synced matches</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-gray-900/60 p-5">
          <p className="text-xs uppercase tracking-widest text-gray-400">Events</p>
          <p className="mt-2 text-2xl font-bold">{stats.events}</p>
          <p className="text-xs text-gray-400">Synced events</p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
        <h2 className="text-lg font-semibold">Announcement Banner</h2>
        <p className="mt-1 text-sm text-gray-300">
          Publish short announcements across the website.
        </p>

        <form onSubmit={handleAnnouncementSubmit} className="mt-4 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-gray-400">Message</label>
            <input
              name="message"
              type="text"
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="e.g. 2026 preseason demo is live!"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Variant</label>
            <select
              name="variant"
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              defaultValue="info"
            >
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="danger">Danger</option>
            </select>
          </div>
          <label className="mt-6 flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" name="isActive" className="h-4 w-4" />
            Active
          </label>
          <div className="md:col-span-6">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Publish announcement
            </button>
          </div>
        </form>

        {announcementStatus && (
          <p className="mt-3 text-sm text-gray-200">{announcementStatus}</p>
        )}

        <div className="mt-6 space-y-4">
          {announcements.length === 0 ? (
            <p className="text-sm text-gray-400">No announcements yet.</p>
          ) : (
            announcements.map((announcement) => (
              <form
                key={announcement.id}
                onSubmit={handleAnnouncementUpdate}
                className="rounded-xl border border-white/10 bg-gray-950/60 p-4"
              >
                <input type="hidden" name="id" value={announcement.id} />
                <div className="grid gap-3 md:grid-cols-6">
                  <div className="md:col-span-4">
                    <label className="block text-xs font-medium text-gray-400">Message</label>
                    <input
                      name="message"
                      type="text"
                      defaultValue={announcement.message}
                      className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Variant</label>
                    <select
                      name="variant"
                      defaultValue={announcement.variant}
                      className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    >
                      <option value="info">Info</option>
                      <option value="success">Success</option>
                      <option value="warning">Warning</option>
                      <option value="danger">Danger</option>
                    </select>
                  </div>
                  <label className="mt-6 flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={announcement.is_active}
                      className="h-4 w-4"
                    />
                    Active
                  </label>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAnnouncementDelete(announcement.id)}
                    className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </form>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
        <h2 className="text-lg font-semibold">Contact Inbox</h2>
        <p className="mt-1 text-sm text-gray-300">
          Review inbound messages and reply from the dashboard.
        </p>

        {contactStatus && (
          <p className="mt-3 text-sm text-gray-200">{contactStatus}</p>
        )}

        <div className="mt-6 space-y-4">
          {contactMessages.length === 0 ? (
            <p className="text-sm text-gray-400">No contact messages yet.</p>
          ) : (
            contactMessages.map((message) => (
              <form
                key={message.id}
                onSubmit={handleContactUpdate}
                className="rounded-xl border border-white/10 bg-gray-950/60 p-4"
              >
                <input type="hidden" name="id" value={message.id} />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{message.subject}</p>
                    <p className="mt-1 text-xs text-gray-400">
                      {message.email} · {formatDateTime(message.created_at)}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-300">
                    {message.status}
                  </span>
                </div>

                <p className="mt-3 text-sm text-gray-200">{message.message}</p>

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <div className="md:col-span-3">
                    <label className="block text-xs font-medium text-gray-400">Response</label>
                    <textarea
                      name="response"
                      rows={3}
                      defaultValue={message.response ?? ""}
                      className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      placeholder="Draft your reply..."
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Response drafts are stored here. You can email manually after saving.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Status</label>
                    <select
                      name="status"
                      defaultValue={message.status}
                      className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                    >
                      <option value="new">New</option>
                      <option value="in_progress">In Progress</option>
                      <option value="replied">Replied</option>
                      <option value="closed">Closed</option>
                    </select>
                    <p className="mt-2 text-xs text-gray-500">
                      {message.responded_at
                        ? `Replied ${formatDateTime(message.responded_at)}`
                        : "No response yet"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    Save response
                  </button>
                  <button
                    type="button"
                    onClick={() => handleContactDelete(message.id)}
                    className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                  <a
                    href={`mailto:${message.email}?subject=${encodeURIComponent(
                      `Re: ${message.subject}`
                    )}&body=${encodeURIComponent(message.response ?? "")}`}
                    className="text-sm text-gray-300 underline underline-offset-4 transition hover:text-white"
                  >
                    Open email client
                  </a>
                </div>
              </form>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
        <h2 className="text-lg font-semibold">Testimonials</h2>
        <p className="mt-1 text-sm text-gray-300">
          Manage testimonials shown on the landing page.
        </p>

        <form onSubmit={handleTestimonialSubmit} className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-400">Quote</label>
            <textarea
              name="quote"
              rows={2}
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              placeholder="Add a testimonial quote"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Name</label>
            <input
              name="name"
              type="text"
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Role</label>
            <input
              name="role"
              type="text"
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Team</label>
            <input
              name="team"
              type="text"
              className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              required
            />
          </div>
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400">Rating</label>
              <input
                name="rating"
                type="number"
                min={1}
                max={5}
                defaultValue={5}
                className="mt-1 w-24 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400">Sort</label>
              <input
                name="sortOrder"
                type="number"
                defaultValue={0}
                className="mt-1 w-24 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>
            <label className="mt-6 flex items-center gap-2 text-sm text-gray-300">
              <input name="isPublished" type="checkbox" defaultChecked />
              Published
            </label>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
            >
              Add testimonial
            </button>
          </div>
        </form>

        {testimonialStatus && (
          <p className="mt-3 text-sm text-gray-200">{testimonialStatus}</p>
        )}

        <div className="mt-6 space-y-4">
          {testimonials.length === 0 ? (
            <p className="text-sm text-gray-400">No testimonials yet.</p>
          ) : (
            testimonials.map((t) => (
              <form
                key={t.id}
                onSubmit={handleTestimonialUpdate}
                className="rounded-xl border border-white/10 bg-gray-950/60 p-4"
              >
                <input type="hidden" name="id" value={t.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-400">Quote</label>
                    <textarea
                      name="quote"
                      defaultValue={t.quote}
                      rows={2}
                      className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Name</label>
                    <input
                      name="name"
                      type="text"
                      defaultValue={t.name}
                      className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Role</label>
                    <input
                      name="role"
                      type="text"
                      defaultValue={t.role}
                      className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400">Team</label>
                    <input
                      name="team"
                      type="text"
                      defaultValue={t.team}
                      className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Rating</label>
                      <input
                        name="rating"
                        type="number"
                        min={1}
                        max={5}
                        defaultValue={t.rating}
                        className="mt-1 w-24 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400">Sort</label>
                      <input
                        name="sortOrder"
                        type="number"
                        defaultValue={t.sort_order}
                        className="mt-1 w-24 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <label className="mt-6 flex items-center gap-2 text-sm text-gray-300">
                      <input
                        name="isPublished"
                        type="checkbox"
                        defaultChecked={t.is_published}
                      />
                      Published
                    </label>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestimonialDelete(t.id)}
                    className="rounded-md border border-red-500/40 px-3 py-1.5 text-sm font-medium text-red-300 hover:bg-red-500/10"
                  >
                    Delete
                  </button>
                </div>
              </form>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-gray-900/60 p-6">
        <h2 className="text-lg font-semibold">Registered Teams</h2>
        <p className="mt-1 text-sm text-gray-300">
          Update team numbers for organizations.
        </p>

        {orgStatus && (
          <p className="mt-3 text-sm text-gray-200">{orgStatus}</p>
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
                <form action={handleUpdateOrg} className="flex flex-wrap items-end gap-3">
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
                <form action={handleClearOrg}>
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
      </section>
    </div>
  );
}

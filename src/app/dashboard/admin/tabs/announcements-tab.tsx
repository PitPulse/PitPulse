"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { upsertAnnouncement } from "@/lib/staff-actions";
import { Button } from "@/components/ui/button";

interface Announcement {
  id: string;
  message: string;
  variant: string;
  is_active: boolean;
  created_at: string;
}

interface AnnouncementsTabProps {
  announcements: Announcement[];
  onStatus: (msg: string) => void;
  onConfirmDelete: (info: { type: string; id: string; label: string }) => void;
}

export function AnnouncementsTab({ announcements, onStatus, onConfirmDelete }: AnnouncementsTabProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const result = await upsertAnnouncement(new FormData(form));
    if (result?.error) { onStatus(result.error); return; }
    onStatus("Announcement saved.");
    form.reset();
    refresh();
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const result = await upsertAnnouncement(new FormData(e.currentTarget));
    if (result?.error) { onStatus(result.error); return; }
    onStatus("Announcement updated.");
    refresh();
  }

  return (
    <div>
      <h2 className="text-xl font-bold">Announcements</h2>
      <p className="mt-1 text-sm text-gray-400">Publish short banners across the website.</p>

      <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-white/10 bg-gray-900/60 p-6">
        <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-400">New Announcement</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-6">
          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-gray-400">Message</label>
            <input name="message" type="text" className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" placeholder="e.g. 2026 preseason demo is live!" required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400">Variant</label>
            <select name="variant" className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" defaultValue="info">
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
            <Button type="submit" size="md">Publish announcement</Button>
          </div>
        </div>
      </form>

      <div className="mt-6 space-y-4">
        {announcements.length === 0 ? (
          <p className="text-sm text-gray-400">No announcements yet.</p>
        ) : (
          announcements.map((a) => (
            <form key={a.id} onSubmit={handleUpdate} className="rounded-2xl border border-white/10 bg-gray-900/60 p-5">
              <input type="hidden" name="id" value={a.id} />
              <div className="grid gap-3 md:grid-cols-6">
                <div className="md:col-span-4">
                  <label className="block text-xs font-medium text-gray-400">Message</label>
                  <input name="message" type="text" defaultValue={a.message} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white" required />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400">Variant</label>
                  <select name="variant" defaultValue={a.variant} className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white">
                    <option value="info">Info</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="danger">Danger</option>
                  </select>
                </div>
                <label className="mt-6 flex items-center gap-2 text-sm text-gray-300">
                  <input type="checkbox" name="isActive" defaultChecked={a.is_active} className="h-4 w-4" />
                  Active
                </label>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <Button type="submit" size="sm">Save</Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => onConfirmDelete({ type: "announcement", id: a.id, label: `announcement "${a.message.slice(0, 40)}…"` })}
                >
                  Delete
                </Button>
              </div>
            </form>
          ))
        )}
      </div>
    </div>
  );
}

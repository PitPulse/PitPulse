"use client";

import { useState, useTransition } from "react";
import { submitContactMessage } from "@/lib/contact-actions";

export function ContactForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSent(false);

    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await submitContactMessage(formData);
      if (result?.error) {
        setError(result.error);
        setSent(false);
        return;
      }
      setSent(true);
      form.reset();
    });
  }

  return (
    <div className="marketing-card rounded-2xl p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Leave a message</h2>
      <p className="mt-1 text-sm text-gray-300">
        Share your question or idea and we&apos;ll respond as soon as we can.
      </p>

      {sent && (
        <div className="mt-4 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          Message sent. We&apos;ll be in touch soon.
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <input
          type="text"
          name="company"
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
        />
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
            Email
          </label>
          <input
            name="email"
            type="email"
            required
            className="marketing-input mt-2 w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none"
            placeholder="you@team.org"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
            Subject
          </label>
          <input
            name="subject"
            type="text"
            required
            className="marketing-input mt-2 w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none"
            placeholder="What can PitPilot do for my team?"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400">
            Message
          </label>
          <textarea
            name="message"
            rows={5}
            required
            className="marketing-input mt-2 w-full rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none"
            placeholder="Tell us about your team and what you need."
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-400 disabled:opacity-50"
        >
          {isPending ? "Sending..." : "Send message"}
        </button>
      </form>
    </div>
  );
}

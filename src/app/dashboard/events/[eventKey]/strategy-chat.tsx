"use client";

import { useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import {
  formatRateLimitUsageMessage,
  readRateLimitSnapshot,
  resolveRateLimitMessage,
} from "@/lib/rate-limit-ui";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function StrategyChat({
  eventKey,
  initialInput = "",
}: {
  eventKey: string;
  initialInput?: string;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Ask about opponents, alliance matchups, or who fits your team best. I will answer using EPA and your scouting data for this event.",
    },
  ]);
  const [input, setInput] = useState(initialInput);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (initialInput) {
      setInput(initialInput);
    }
  }, [initialInput]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/strategy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventKey, message: trimmed }),
      });
      const usage = readRateLimitSnapshot(res.headers);
      if (usage) {
        toast(formatRateLimitUsageMessage(usage, "ai"), "info");
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          resolveRateLimitMessage(
            res.status,
            data.error || "Failed to get response",
            "ai"
          )
        );
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply as string },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl dashboard-panel p-4 text-sm text-gray-300">
        Responses are based on EPA stats plus your team&apos;s scouting entries.
        The more scouting data you capture, the better and more specific the
        answers will be.
      </div>

      <div className="rounded-2xl dashboard-panel p-4 space-y-3">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                message.role === "user"
                  ? "bg-blue-600/20 text-blue-100"
                  : "bg-white/5 text-gray-100"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/50 border-t-transparent" />
            Thinking...
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="rounded-2xl dashboard-panel p-4 space-y-3">
        <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Ask PitPilot
        </label>
        <textarea
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a matchup, an opponent, or how to play a team..."
          autoFocus={Boolean(initialInput)}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50"
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
            )}
            {loading ? "Sending..." : "Send"}
          </button>
          <p className="text-xs text-gray-400">
            Keep questions focused on robotics strategy and scouting.
          </p>
        </div>
        {error && (
          <p className="text-xs text-red-300">{error}</p>
        )}
      </div>
    </div>
  );
}

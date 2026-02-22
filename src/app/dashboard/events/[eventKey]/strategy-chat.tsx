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
  compact = false,
}: {
  eventKey: string;
  initialInput?: string;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: compact
        ? "Ask me anything about this event — matchups, team comparisons, draft advice."
        : "Ask about opponents, alliance matchups, or who fits your team best. I will answer using EPA and your scouting data for this event.",
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

    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);

    // Send conversation history (skip the initial greeting, cap at last 6 messages)
    const history = updatedMessages.slice(1, -1).slice(-6);

    try {
      const res = await fetch("/api/strategy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventKey, message: trimmed, history }),
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const panelPadding = compact ? "p-3" : "p-4";
  const textSize = compact ? "text-xs" : "text-sm";
  const maxBubble = compact ? "max-w-[85%]" : "max-w-[80%]";

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="rounded-2xl dashboard-panel p-4 text-sm text-gray-300">
          Responses are based on EPA stats plus your team&apos;s scouting entries.
          The more scouting data you capture, the better and more specific the
          answers will be.
        </div>
      )}

      <div className={`rounded-2xl dashboard-panel ${panelPadding} space-y-2.5`}>
        <div className={compact ? "max-h-64 overflow-y-auto space-y-2" : "space-y-3"}>
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`${maxBubble} rounded-2xl px-3.5 py-2.5 ${textSize} leading-relaxed ${
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
      </div>

      <div className={`rounded-2xl dashboard-panel ${panelPadding} space-y-2.5`}>
        {!compact && (
          <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Ask PitPilot
          </label>
        )}
        <textarea
          rows={compact ? 2 : 3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            compact
              ? "Ask about a team or matchup..."
              : "Ask about a matchup, an opponent, or how to play a team..."
          }
          autoFocus={Boolean(initialInput)}
          className={`w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${textSize} text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={`inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 ${
              compact ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"
            } font-semibold text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-50`}
          >
            {loading && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
            )}
            {loading ? "Sending..." : "Send"}
          </button>
          {!compact && (
            <p className="text-xs text-gray-400">
              Keep questions focused on robotics strategy and scouting.
            </p>
          )}
          {compact && (
            <p className="text-[10px] text-gray-500">
              Enter to send · Shift+Enter for newline
            </p>
          )}
        </div>
        {error && (
          <p className="text-xs text-red-300">{error}</p>
        )}
      </div>
    </div>
  );
}

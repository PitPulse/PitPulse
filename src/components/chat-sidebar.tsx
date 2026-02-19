"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  readRateLimitSnapshot,
  resolveRateLimitMessage,
} from "@/lib/rate-limit-ui";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

/* ── Suggestion prompts ────────────────────────────────────────── */

const SUGGESTION_PROMPTS = [
  "Who are the strongest teams here?",
  "Compare the top 3 pick list teams",
  "Best alliance partner for a scoring robot?",
  "Which teams are underrated sleepers?",
];

/* ── Chat session cache (sessionStorage per event) ────────────── */

const CACHE_PREFIX = "pitpilot_chat_";

function getCachedMessages(eventKey: string): ChatMessage[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`${CACHE_PREFIX}${eventKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 1 ? parsed : null;
  } catch {
    return null;
  }
}

function setCachedMessages(eventKey: string, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`${CACHE_PREFIX}${eventKey}`, JSON.stringify(messages));
  } catch {
    /* quota exceeded — ignore */
  }
}

/* ── Markdown components for chat bubbles ─────────────────────── */

const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-2 last:mb-0">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic text-gray-300">{children}</em>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-gray-200">{children}</li>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <pre className="mb-2 overflow-x-auto rounded-lg bg-black/30 p-3 text-xs last:mb-0">
          <code className="text-gray-200">{children}</code>
        </pre>
      );
    }
    return (
      <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-blue-200">{children}</code>
    );
  },
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-1 mt-3 text-sm font-semibold text-white first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-1 mt-2 text-xs font-semibold text-white first:mt-0">{children}</h4>
  ),
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-300 underline hover:text-blue-200">
      {children}
    </a>
  ),
  hr: () => <hr className="my-3 border-white/10" />,
} as Record<string, React.ComponentType<Record<string, unknown>>>;

/* ── Sparkle icon (reused in several spots) ───────────────────── */

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
    </svg>
  );
}

/* ── Main sidebar ─────────────────────────────────────────────── */

interface ChatSidebarProps {
  open: boolean;
  onClose: () => void;
  eventKey: string;
  eventName?: string | null;
  userName?: string | null;
}

export function ChatSidebar({ open, onClose, eventKey, eventName, userName }: ChatSidebarProps) {
  // Build a personalised greeting
  const greeting = useMemo(() => {
    const nameGreet = userName ? `Hey ${userName.split(" ")[0]}!` : "Hey!";
    const eventPart = eventName
      ? `I'm your strategy assistant for **${eventName}**.`
      : "I'm your strategy assistant for this event.";
    return `${nameGreet} ${eventPart} Ask me about team comparisons, matchup analysis, draft strategy, or scouting insights.`;
  }, [userName, eventName]);

  // Restore cached messages for this event (or start fresh)
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const cached = getCachedMessages(eventKey);
    if (cached) return cached;
    return [{ role: "assistant", content: greeting }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Show suggestion chips only until the user sends a message
  const [showSuggestions, setShowSuggestions] = useState(() => {
    const cached = getCachedMessages(eventKey);
    // If there are cached messages with conversation, don't show suggestions
    return !cached || cached.length <= 1;
  });
  // Inline usage hint shown above the input bar
  const [usageHint, setUsageHint] = useState<string | null>(null);
  const usageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Persist messages to sessionStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      setCachedMessages(eventKey, messages);
    }
  }, [messages, eventKey]);

  // Auto-scroll on new messages
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input when sidebar opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  async function handleSend(overrideMessage?: string) {
    const trimmed = (overrideMessage ?? input).trim();
    if (!trimmed || loading) return;

    setShowSuggestions(false);
    const updatedMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);

    // Send conversation history (skip initial greeting, cap at 12)
    const history = updatedMessages.slice(1, -1).slice(-12);

    try {
      const res = await fetch("/api/strategy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventKey, message: trimmed, history }),
      });
      const usage = readRateLimitSnapshot(res.headers);
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

      // Show inline usage hint above the input bar
      if (usage) {
        const remainingPct = Math.max(
          0,
          Math.min(100, Math.round((usage.remaining / Math.max(1, usage.limit)) * 100))
        );
        setUsageHint(`${remainingPct}% AI usage remaining`);
        if (usageTimerRef.current) clearTimeout(usageTimerRef.current);
        usageTimerRef.current = setTimeout(() => setUsageHint(null), 5000);
      }
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

  /** Render message content as markdown. */
  const renderContent = useCallback((text: string) => (
    <ReactMarkdown components={markdownComponents}>{text}</ReactMarkdown>
  ), []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[998] flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Sidebar panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 400, damping: 34, mass: 0.8 }}
            className="relative flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0a0f1a]/98 shadow-[-8px_0_40px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                  <SparkleIcon className="h-4 w-4 text-blue-300" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-white">PitPilot AI</h2>
                  <p className="text-[11px] text-gray-500">Strategy assistant</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white"
                aria-label="Close chat"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <span className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                      <SparkleIcon className="h-3 w-3 text-blue-300" />
                    </span>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "bg-blue-600/25 text-blue-50"
                        : "bg-white/[0.06] text-gray-200"
                    }`}
                  >
                    {renderContent(message.content)}
                  </div>
                </div>
              ))}

              {/* Suggestion chips — shown only before the first user message */}
              {showSuggestions && !loading && messages.length === 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25, delay: 0.15 }}
                  className="flex flex-wrap gap-2 pl-8"
                >
                  {SUGGESTION_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSend(prompt)}
                      className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-gray-300 transition hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-200"
                    >
                      {prompt}
                    </button>
                  ))}
                </motion.div>
              )}

              {loading && (
                <div className="flex items-start gap-2">
                  <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/20">
                    <SparkleIcon className="h-3 w-3 text-blue-300" />
                  </span>
                  <div className="rounded-2xl bg-white/[0.06] px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "0ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "150ms" }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-white/10 px-5 py-4">
              <AnimatePresence>
                {usageHint && (
                  <motion.p
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: "auto", marginBottom: 8 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden text-center text-[11px] text-gray-400"
                  >
                    {usageHint}
                  </motion.p>
                )}
              </AnimatePresence>
              {error && (
                <p className="mb-2 text-xs text-red-300">{error}</p>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about a team, matchup, or strategy..."
                  className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  style={{ maxHeight: "120px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={loading || !input.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label="Send message"
                >
                  {loading ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-gray-600">
                Enter to send · Shift+Enter for newline · Powered by EPA + your scouting data
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** Trigger button to open the chat sidebar. */
export function ChatSidebarTrigger({
  eventKey,
  eventName,
  userName,
  className,
  label = "Ask PitPilot",
}: {
  eventKey: string;
  eventName?: string | null;
  userName?: string | null;
  className?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300 transition hover:bg-blue-500/20 hover:border-blue-500/40"
        }
      >
        <SparkleIcon className="h-3.5 w-3.5" />
        {label}
      </button>
      <ChatSidebar
        open={open}
        onClose={() => setOpen(false)}
        eventKey={eventKey}
        eventName={eventName}
        userName={userName}
      />
    </>
  );
}

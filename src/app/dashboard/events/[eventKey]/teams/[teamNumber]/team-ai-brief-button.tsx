"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/components/toast";
import {
  formatRateLimitUsageMessage,
  readRateLimitSnapshot,
  resolveRateLimitMessage,
} from "@/lib/rate-limit-ui";

function renderInlineMarkdown(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let tokenIndex = 0;

  for (const match of text.matchAll(tokenRegex)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`${keyPrefix}-bold-${tokenIndex}`}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${tokenIndex}`}
          className="rounded bg-white/10 px-1 py-0.5 text-[0.9em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkLabelEnd = token.indexOf("](");
      const label = token.slice(1, linkLabelEnd);
      const href = token.slice(linkLabelEnd + 2, -1);
      nodes.push(
        <a
          key={`${keyPrefix}-link-${tokenIndex}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-blue-300 underline decoration-blue-400/60 underline-offset-2 hover:text-blue-200"
        >
          {label}
        </a>
      );
    } else {
      nodes.push(token);
    }

    lastIndex = start + token.length;
    tokenIndex += 1;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

function TeamBriefMarkdown({ markdown, animate = false }: { markdown: string; animate?: boolean }) {
  const elements = useMemo(() => {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const blocks: ReactNode[] = [];
    let paragraph: string[] = [];
    let unorderedList: string[] = [];
    let orderedList: string[] = [];
    let quote: string[] = [];
    let blockKey = 0;

    const flushParagraph = () => {
      if (paragraph.length === 0) return;
      const text = paragraph.join(" ");
      blocks.push(
        <p key={`p-${blockKey}`} className="my-3 text-sm leading-6">
          {renderInlineMarkdown(text, `p-${blockKey}`)}
        </p>
      );
      paragraph = [];
      blockKey += 1;
    };

    const flushUnordered = () => {
      if (unorderedList.length === 0) return;
      blocks.push(
        <ul key={`ul-${blockKey}`} className="my-3 list-disc space-y-1 pl-6 text-sm">
          {unorderedList.map((item, index) => (
            <li key={`ul-${blockKey}-${index}`}>
              {renderInlineMarkdown(item, `ul-${blockKey}-${index}`)}
            </li>
          ))}
        </ul>
      );
      unorderedList = [];
      blockKey += 1;
    };

    const flushOrdered = () => {
      if (orderedList.length === 0) return;
      blocks.push(
        <ol key={`ol-${blockKey}`} className="my-3 list-decimal space-y-1 pl-6 text-sm">
          {orderedList.map((item, index) => (
            <li key={`ol-${blockKey}-${index}`}>
              {renderInlineMarkdown(item, `ol-${blockKey}-${index}`)}
            </li>
          ))}
        </ol>
      );
      orderedList = [];
      blockKey += 1;
    };

    const flushQuote = () => {
      if (quote.length === 0) return;
      const text = quote.join(" ");
      blocks.push(
        <blockquote
          key={`quote-${blockKey}`}
          className="my-3 border-l-2 border-blue-400/50 pl-3 text-sm"
        >
          {renderInlineMarkdown(text, `quote-${blockKey}`)}
        </blockquote>
      );
      quote = [];
      blockKey += 1;
    };

    const flushAll = () => {
      flushParagraph();
      flushUnordered();
      flushOrdered();
      flushQuote();
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        flushAll();
        continue;
      }

      if (/^([-*])\s+/.test(trimmed)) {
        flushParagraph();
        flushOrdered();
        flushQuote();
        unorderedList.push(trimmed.replace(/^([-*])\s+/, ""));
        continue;
      }

      const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
      if (orderedMatch) {
        flushParagraph();
        flushUnordered();
        flushQuote();
        orderedList.push(orderedMatch[1]);
        continue;
      }

      if (trimmed.startsWith(">")) {
        flushParagraph();
        flushUnordered();
        flushOrdered();
        quote.push(trimmed.replace(/^>\s?/, ""));
        continue;
      }

      if (/^(---|\*\*\*)$/.test(trimmed)) {
        flushAll();
        blocks.push(<hr key={`hr-${blockKey}`} className="my-4 border-white/10" />);
        blockKey += 1;
        continue;
      }

      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (heading) {
        flushAll();
        const level = heading[1].length;
        const headingText = heading[2];
        if (level === 1) {
          blocks.push(
            <h2 key={`h1-${blockKey}`} className="mt-2 text-xl font-semibold text-white">
              {renderInlineMarkdown(headingText, `h1-${blockKey}`)}
            </h2>
          );
        } else if (level === 2) {
          blocks.push(
            <h3 key={`h2-${blockKey}`} className="mt-2 text-lg font-semibold text-white">
              {renderInlineMarkdown(headingText, `h2-${blockKey}`)}
            </h3>
          );
        } else {
          blocks.push(
            <h4 key={`h3-${blockKey}`} className="mt-2 text-base font-semibold text-white">
              {renderInlineMarkdown(headingText, `h3-${blockKey}`)}
            </h4>
          );
        }
        blockKey += 1;
        continue;
      }

      flushUnordered();
      flushOrdered();
      flushQuote();
      paragraph.push(trimmed);
    }

    flushAll();
    return blocks;
  }, [markdown]);

  if (!animate) {
    return <div className="ai-brief-markdown">{elements}</div>;
  }

  return (
    <div className="ai-brief-markdown">
      {elements.map((element, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06, ease: "easeOut" }}
        >
          {element}
        </motion.div>
      ))}
    </div>
  );
}

export function TeamAIBriefButton({
  eventKey,
  teamNumber,
  teamName,
}: {
  eventKey: string;
  teamNumber: number;
  teamName?: string | null;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [brief, setBrief] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generateBurst, setGenerateBurst] = useState(0);
  const [freshlyGenerated, setFreshlyGenerated] = useState(false);
  const cacheKey = useMemo(
    () => `scoutai:team-brief:v1:${eventKey}:${teamNumber}`,
    [eventKey, teamNumber]
  );

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(cacheKey);
      if (!raw) {
        setBrief(null);
        return;
      }

      const parsed = JSON.parse(raw) as { brief?: unknown } | null;
      if (typeof parsed?.brief === "string" && parsed.brief.trim().length > 0) {
        setBrief(parsed.brief);
      } else {
        setBrief(null);
      }
    } catch {
      setBrief(null);
    }
  }, [cacheKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (brief && brief.trim().length > 0) {
        window.localStorage.setItem(
          cacheKey,
          JSON.stringify({
            brief,
            cachedAt: new Date().toISOString(),
          })
        );
      } else {
        window.localStorage.removeItem(cacheKey);
      }
    } catch {
      // localStorage can fail in private contexts; ignore and continue.
    }
  }, [brief, cacheKey]);

  async function generateBrief(force = false) {
    if (loading) return;
    if (brief && !force) return;

    setLoading(true);
    setError(null);
    if (force) setBrief(null);

    try {
      const res = await fetch("/api/strategy/team-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventKey, teamNumber }),
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
            data.error || "Failed to generate AI briefing",
            "ai"
          )
        );
      }
      setBrief(data.reply as string);
      setFreshlyGenerated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate briefing");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    setOpen(true);
  }

  function handleGenerateClick() {
    setGenerateBurst((value) => value + 1);
    void generateBrief(Boolean(brief));
  }

  const portalRoot = typeof document !== "undefined" ? document.body : null;
  const modal = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="relative z-[1001] w-full max-w-2xl rounded-2xl dashboard-panel p-5 shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.985 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { type: "spring", stiffness: 280, damping: 26 },
            }}
            exit={{
              opacity: 0,
              y: 14,
              scale: 0.985,
              transition: { duration: 0.16, ease: "easeInOut" },
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.2 }}
              >
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                  AI Briefing
                </p>
                <h3 className="mt-1 text-lg font-semibold text-white">
                  Team {teamNumber}
                  {teamName ? ` • ${teamName}` : ""}
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  Uses Statbotics team history plus this event&apos;s scouting and EPA data.
                </p>
              </motion.div>
              <motion.button
                type="button"
                onClick={() => setOpen(false)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.97 }}
                className="rounded-md border border-white/10 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
              >
                Close
              </motion.button>
            </div>

            <motion.div
              className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.24 }}
            >
              {!brief && (
                <p className="text-sm text-gray-300">
                  Generates a quick strategic intro for Team {teamNumber}
                  {teamName ? ` (${teamName})` : ""} using Statbotics history plus
                  your scouting records from this event.
                </p>
              )}

              <AnimatePresence mode="wait" initial={false}>
                {loading && (
                  <motion.div
                    key="loading"
                    className="mt-4 rounded-lg border border-blue-400/20 bg-blue-500/5 p-4"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="relative inline-flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400/70" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-400" />
                      </span>
                      <p className="text-sm text-gray-200">Generating briefing...</p>
                    </div>
                    <div className="mt-3 space-y-2">
                      <div className="h-2.5 w-11/12 animate-pulse rounded bg-white/10" />
                      <div className="h-2.5 w-10/12 animate-pulse rounded bg-white/10 [animation-delay:120ms]" />
                      <div className="h-2.5 w-9/12 animate-pulse rounded bg-white/10 [animation-delay:220ms]" />
                    </div>
                  </motion.div>
                )}
                {!loading && error && (
                  <motion.p
                    key="error"
                    className="mt-4 text-sm text-red-300"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                  >
                    {error}
                  </motion.p>
                )}
                {!loading && !error && brief && (
                  <motion.div
                    key="brief"
                    className="max-h-[55vh] overflow-y-auto pr-2"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    <TeamBriefMarkdown markdown={brief} animate={freshlyGenerated} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              className="mt-4 flex flex-col items-center gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: 0.22 }}
            >
              <p className="text-center text-xs text-gray-400">
                This brief is strongest when current EPA and your team&apos;s scouting entries are both available; sparse data produces broader guidance.
              </p>
              <motion.button
                type="button"
                onClick={handleGenerateClick}
                disabled={loading}
                whileHover={!loading ? { y: -1 } : undefined}
                whileTap={!loading ? { scale: 0.97 } : undefined}
                className="relative overflow-hidden rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-200 transition hover:bg-blue-500/20 disabled:opacity-50"
              >
                <span className="relative z-[1]">
                  {loading ? "Generating..." : brief ? "Regenerate" : "Generate Brief"}
                </span>
                {!loading && generateBurst > 0 && (
                  <motion.span
                    key={`burst-${generateBurst}`}
                    className="pointer-events-none absolute inset-0 rounded-md bg-blue-300/20"
                    initial={{ opacity: 0.5, scale: 0.2 }}
                    animate={{ opacity: 0, scale: 2.2 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                  />
                )}
              </motion.button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <motion.button
        type="button"
        onClick={handleOpen}
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.97 }}
        className="dashboard-action dashboard-action-alt"
      >
        AI Briefing
      </motion.button>

      {portalRoot && createPortal(modal, portalRoot)}
    </>
  );
}

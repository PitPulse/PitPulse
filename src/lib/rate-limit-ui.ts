export type RateLimitKind = "ai" | "sync";

export const TEAM_AI_RATE_LIMIT_MESSAGE =
  "Your team has reached its shared AI token limit for this window. Supporter access has a higher token budget. Please try again soon.";

export const TEAM_SYNC_RATE_LIMIT_MESSAGE =
  "Your team has reached its sync rate limit. Please wait a few minutes before trying again.";

export type RateLimitSnapshot = {
  limit: number;
  remaining: number;
  resetAt: number;
};

function formatTimeUntil(resetAt: number): string {
  const ms = Math.max(0, resetAt - Date.now());
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${Math.max(1, minutes)}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.max(1, seconds)}s`;
}

export function resolveRateLimitMessage(
  status: number,
  fallback: string,
  kind: RateLimitKind = "ai"
) {
  if (status !== 429) return fallback;
  return kind === "sync" ? TEAM_SYNC_RATE_LIMIT_MESSAGE : TEAM_AI_RATE_LIMIT_MESSAGE;
}

export function readRateLimitSnapshot(headers: Headers): RateLimitSnapshot | null {
  const limit = Number(headers.get("x-ratelimit-limit"));
  const remaining = Number(headers.get("x-ratelimit-remaining"));
  const resetAt = Number(headers.get("x-ratelimit-reset"));

  if (
    !Number.isFinite(limit) ||
    !Number.isFinite(remaining) ||
    !Number.isFinite(resetAt) ||
    limit <= 0
  ) {
    return null;
  }

  return {
    limit: Math.max(0, Math.floor(limit)),
    remaining: Math.max(0, Math.floor(remaining)),
    resetAt: Math.max(0, Math.floor(resetAt)),
  };
}

export function formatRateLimitUsageMessage(
  snapshot: RateLimitSnapshot,
  kind: RateLimitKind = "ai"
): string {
  const used = Math.max(0, snapshot.limit - snapshot.remaining);
  const usedPct = Math.max(
    0,
    Math.min(100, Math.round((used / Math.max(1, snapshot.limit)) * 100))
  );
  const resetIn = formatTimeUntil(snapshot.resetAt);

  if (kind === "sync") {
    return `Sync usage: ${usedPct}% (${used}/${snapshot.limit}). Resets in ${resetIn}.`;
  }

  return `AI usage: ${usedPct}% (${used}/${snapshot.limit} tokens) for your team. Resets in ${resetIn}.`;
}

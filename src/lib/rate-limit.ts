type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

type RateLimitSnapshot = Pick<RateLimitResult, "remaining" | "resetAt">;

export type PlanTier = "free" | "supporter";

export const TEAM_AI_WINDOW_MS = 3 * 60 * 60 * 1000;
export const TEAM_AI_LIMITS: Record<PlanTier, number> = {
  free: 3,
  supporter: 13,
};

const storeKey = "__scoutaiRateLimitStore";
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL?.trim();
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const canUseUpstashRateLimit =
  !!UPSTASH_REDIS_REST_URL && !!UPSTASH_REDIS_REST_TOKEN;

const RATE_LIMIT_LUA = `
local key = KEYS[1]
local max = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local cost = tonumber(ARGV[3]) or 1

local current = tonumber(redis.call("GET", key) or "0")

if current + cost > max and current > 0 then
  local ttl = redis.call("PTTL", key)
  local remaining = max - current
  if remaining < 0 then remaining = 0 end
  return {0, remaining, ttl}
end

current = redis.call("INCRBY", key, cost)
if current == cost then
  redis.call("PEXPIRE", key, window)
end

local ttl = redis.call("PTTL", key)
local remaining = max - current
if remaining < 0 then remaining = 0 end

return {1, remaining, ttl}
`;

function getStore(): Map<string, RateLimitEntry> {
  const globalAny = globalThis as typeof globalThis & {
    [storeKey]?: Map<string, RateLimitEntry>;
  };

  if (!globalAny[storeKey]) {
    globalAny[storeKey] = new Map();
  }

  return globalAny[storeKey] as Map<string, RateLimitEntry>;
}

function resetRateLimitPrefixInMemory(prefix: string): number {
  const store = getStore();
  let deleted = 0;
  for (const key of store.keys()) {
    if (!key.startsWith(prefix)) continue;
    store.delete(key);
    deleted += 1;
  }
  return deleted;
}

function checkRateLimitInMemory(
  key: string,
  windowMs: number,
  max: number,
  cost: number = 1
): RateLimitResult {
  const store = getStore();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: cost, resetAt });
    return { allowed: true, remaining: Math.max(max - cost, 0), resetAt };
  }

  if (entry.count + cost > max) {
    return { allowed: false, remaining: Math.max(max - entry.count, 0), resetAt: entry.resetAt };
  }

  entry.count += cost;
  store.set(key, entry);
  return {
    allowed: true,
    remaining: Math.max(max - entry.count, 0),
    resetAt: entry.resetAt,
  };
}

async function checkRateLimitUpstash(
  key: string,
  windowMs: number,
  max: number,
  cost: number = 1
): Promise<RateLimitResult | null> {
  if (!canUseUpstashRateLimit) return null;

  try {
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["EVAL", RATE_LIMIT_LUA, "1", key, String(max), String(windowMs), String(cost)],
      ]),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Upstash response status ${response.status}`);
    }

    const payload = (await response.json()) as Array<{
      result?: unknown;
      error?: string | null;
    }>;
    const first = Array.isArray(payload) ? payload[0] : null;
    if (!first) {
      throw new Error("Invalid Upstash response");
    }
    if (first.error) {
      throw new Error(first.error);
    }

    const result = Array.isArray(first.result)
      ? first.result
      : (first.result as { result?: unknown } | undefined)?.result;
    if (!Array.isArray(result) || result.length < 3) {
      throw new Error("Missing Upstash rate limit result");
    }

    const allowed = Number(result[0]) === 1;
    const remaining = Math.max(0, Number(result[1]) || 0);
    const ttl = Number(result[2]);
    const resetAt = Date.now() + (Number.isFinite(ttl) && ttl > 0 ? ttl : windowMs);

    return {
      allowed,
      remaining,
      resetAt,
    };
  } catch (error) {
    console.error("Upstash rate limit failed, falling back to in-memory store.", error);
    return null;
  }
}

function peekRateLimitInMemory(
  key: string,
  windowMs: number,
  max: number
): RateLimitSnapshot {
  const store = getStore();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    if (entry && entry.resetAt <= now) {
      store.delete(key);
    }

    return {
      remaining: max,
      resetAt: now + windowMs,
    };
  }

  return {
    remaining: Math.max(0, max - Math.max(0, entry.count)),
    resetAt: entry.resetAt,
  };
}

async function peekRateLimitUpstash(
  key: string,
  windowMs: number,
  max: number
): Promise<RateLimitSnapshot | null> {
  if (!canUseUpstashRateLimit) return null;

  try {
    const response = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["GET", key],
        ["PTTL", key],
      ]),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Upstash response status ${response.status}`);
    }

    const payload = (await response.json()) as Array<{
      result?: unknown;
      error?: string | null;
    }>;

    const countResult = Array.isArray(payload) ? payload[0] : null;
    const ttlResult = Array.isArray(payload) ? payload[1] : null;

    if (!countResult || !ttlResult) {
      throw new Error("Invalid Upstash response");
    }
    if (countResult.error) {
      throw new Error(countResult.error);
    }
    if (ttlResult.error) {
      throw new Error(ttlResult.error);
    }

    const parsedCount = Number(countResult.result ?? 0);
    const count = Number.isFinite(parsedCount) ? Math.max(0, parsedCount) : 0;
    const parsedTtl = Number(ttlResult.result);
    const ttlMs = Number.isFinite(parsedTtl) && parsedTtl > 0 ? parsedTtl : windowMs;

    return {
      remaining: Math.max(0, max - count),
      resetAt: Date.now() + ttlMs,
    };
  } catch (error) {
    console.error(
      "Upstash rate limit snapshot failed, falling back to in-memory store.",
      error
    );
    return null;
  }
}

async function resetRateLimitPrefixUpstash(
  prefix: string
): Promise<number | null> {
  if (!canUseUpstashRateLimit) return null;

  let cursor = "0";
  let deleted = 0;

  try {
    do {
      const scanResponse = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["SCAN", cursor, "MATCH", `${prefix}*`, "COUNT", "500"],
        ]),
        cache: "no-store",
      });

      if (!scanResponse.ok) {
        throw new Error(`Upstash response status ${scanResponse.status}`);
      }

      const scanPayload = (await scanResponse.json()) as Array<{
        result?: unknown;
        error?: string | null;
      }>;
      const first = Array.isArray(scanPayload) ? scanPayload[0] : null;
      if (!first) throw new Error("Invalid Upstash scan response");
      if (first.error) throw new Error(first.error);

      const result = Array.isArray(first.result) ? first.result : null;
      if (!result || result.length < 2) {
        throw new Error("Invalid Upstash SCAN result shape");
      }

      cursor = String(result[0] ?? "0");
      const keys = Array.isArray(result[1])
        ? result[1].map((item) => String(item))
        : [];

      if (keys.length > 0) {
        const deleteResponse = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(keys.map((key) => ["DEL", key])),
          cache: "no-store",
        });

        if (!deleteResponse.ok) {
          throw new Error(`Upstash response status ${deleteResponse.status}`);
        }

        const deletePayload = (await deleteResponse.json()) as Array<{
          result?: unknown;
          error?: string | null;
        }>;

        for (const row of deletePayload) {
          if (row?.error) {
            throw new Error(row.error);
          }
          const count = Number(row?.result ?? 0);
          if (Number.isFinite(count) && count > 0) {
            deleted += count;
          }
        }
      }
    } while (cursor !== "0");

    return deleted;
  } catch (error) {
    console.error(
      "Upstash rate limit reset failed, falling back to in-memory store.",
      error
    );
    return null;
  }
}

export async function checkRateLimit(
  key: string,
  windowMs: number,
  max: number,
  cost: number = 1
): Promise<RateLimitResult> {
  const distributed = await checkRateLimitUpstash(key, windowMs, max, cost);
  if (distributed) return distributed;
  return checkRateLimitInMemory(key, windowMs, max, cost);
}

export async function peekRateLimit(
  key: string,
  windowMs: number,
  max: number
): Promise<RateLimitSnapshot> {
  const distributed = await peekRateLimitUpstash(key, windowMs, max);
  if (distributed) return distributed;
  return peekRateLimitInMemory(key, windowMs, max);
}

export async function resetRateLimitPrefix(prefix: string): Promise<{
  deleted: number;
  backend: "upstash" | "memory";
}> {
  const distributed = await resetRateLimitPrefixUpstash(prefix);
  if (distributed !== null) {
    return { deleted: distributed, backend: "upstash" };
  }

  const deleted = resetRateLimitPrefixInMemory(prefix);
  return { deleted, backend: "memory" };
}

export function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

export function hasSupporterAccess(planTier: string | null | undefined): boolean {
  const normalized = (planTier ?? "").trim().toLowerCase();
  return normalized === "supporter" || normalized === "gifted_supporter";
}

export function normalizePlanTier(value: string | null | undefined): PlanTier {
  return hasSupporterAccess(value) ? "supporter" : "free";
}

export function getTeamAiLimit(planTier: string | null | undefined): number {
  return TEAM_AI_LIMITS[normalizePlanTier(planTier)];
}

export function buildRateLimitHeaders(
  limit: Pick<RateLimitResult, "remaining" | "resetAt">,
  max: number
): HeadersInit {
  return {
    "X-RateLimit-Limit": String(Math.max(0, max)),
    "X-RateLimit-Remaining": String(Math.max(0, limit.remaining)),
    "X-RateLimit-Reset": String(limit.resetAt),
  };
}

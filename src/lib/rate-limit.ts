type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
};

const storeKey = "__scoutaiRateLimitStore";

function getStore(): Map<string, RateLimitEntry> {
  const globalAny = globalThis as typeof globalThis & {
    [storeKey]?: Map<string, RateLimitEntry>;
  };

  if (!globalAny[storeKey]) {
    globalAny[storeKey] = new Map();
  }

  return globalAny[storeKey] as Map<string, RateLimitEntry>;
}

export function checkRateLimit(
  key: string,
  windowMs: number,
  max: number
): RateLimitResult {
  const store = getStore();
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(max - 1, 0), resetAt };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  store.set(key, entry);
  return {
    allowed: true,
    remaining: Math.max(max - entry.count, 0),
    resetAt: entry.resetAt,
  };
}

export function retryAfterSeconds(resetAt: number): number {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));
}

import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  retryAfterSeconds,
  hasSupporterAccess,
  normalizePlanTier,
  getTeamAiLimit,
  TEAM_AI_LIMITS,
  TEAM_AI_WINDOW_MS,
} from "@/lib/rate-limit";

describe("rate-limit utilities", () => {
  describe("checkRateLimit (in-memory fallback)", () => {
    it("allows first request", async () => {
      const result = await checkRateLimit("test-first-request", 60_000, 5);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
      expect(result.resetAt).toBeGreaterThan(Date.now());
    });

    it("decrements remaining on subsequent requests", async () => {
      const key = "test-decrement";
      await checkRateLimit(key, 60_000, 3);
      const second = await checkRateLimit(key, 60_000, 3);
      expect(second.allowed).toBe(true);
      expect(second.remaining).toBe(1);
    });

    it("blocks requests past the max limit", async () => {
      const key = "test-block";
      await checkRateLimit(key, 60_000, 2);
      await checkRateLimit(key, 60_000, 2);
      const third = await checkRateLimit(key, 60_000, 2);
      expect(third.allowed).toBe(false);
      expect(third.remaining).toBe(0);
    });

    it("resets after the window expires", async () => {
      const key = "test-expire";
      // Use a very short window
      await checkRateLimit(key, 1, 1);
      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 5));
      const result = await checkRateLimit(key, 1, 1);
      expect(result.allowed).toBe(true);
    });
  });

  describe("retryAfterSeconds", () => {
    it("returns at least 1 second", () => {
      expect(retryAfterSeconds(Date.now())).toBe(1);
    });

    it("returns correct seconds until reset", () => {
      const resetAt = Date.now() + 30_000;
      const seconds = retryAfterSeconds(resetAt);
      expect(seconds).toBeGreaterThanOrEqual(29);
      expect(seconds).toBeLessThanOrEqual(31);
    });
  });

  describe("hasSupporterAccess", () => {
    it("returns true for supporter", () => {
      expect(hasSupporterAccess("supporter")).toBe(true);
    });

    it("returns true for gifted_supporter", () => {
      expect(hasSupporterAccess("gifted_supporter")).toBe(true);
    });

    it("returns false for free", () => {
      expect(hasSupporterAccess("free")).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(hasSupporterAccess(null)).toBe(false);
      expect(hasSupporterAccess(undefined)).toBe(false);
    });

    it("handles case-insensitive input", () => {
      expect(hasSupporterAccess("Supporter")).toBe(true);
      expect(hasSupporterAccess("GIFTED_SUPPORTER")).toBe(true);
    });

    it("handles whitespace", () => {
      expect(hasSupporterAccess("  supporter  ")).toBe(true);
    });
  });

  describe("normalizePlanTier", () => {
    it("returns supporter for supporter-tier values", () => {
      expect(normalizePlanTier("supporter")).toBe("supporter");
      expect(normalizePlanTier("gifted_supporter")).toBe("supporter");
    });

    it("returns free for everything else", () => {
      expect(normalizePlanTier("free")).toBe("free");
      expect(normalizePlanTier(null)).toBe("free");
      expect(normalizePlanTier("invalid")).toBe("free");
    });
  });

  describe("getTeamAiLimit", () => {
    it("returns correct limit for free tier", () => {
      expect(getTeamAiLimit("free")).toBe(TEAM_AI_LIMITS.free);
    });

    it("returns correct limit for supporter tier", () => {
      expect(getTeamAiLimit("supporter")).toBe(TEAM_AI_LIMITS.supporter);
    });

    it("falls back to free for unknown tiers", () => {
      expect(getTeamAiLimit(null)).toBe(TEAM_AI_LIMITS.free);
    });
  });

  describe("constants", () => {
    it("TEAM_AI_WINDOW_MS is 3 hours", () => {
      expect(TEAM_AI_WINDOW_MS).toBe(3 * 60 * 60 * 1000);
    });

    it("supporter limit is higher than free", () => {
      expect(TEAM_AI_LIMITS.supporter).toBeGreaterThan(TEAM_AI_LIMITS.free);
    });
  });
});

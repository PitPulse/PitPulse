import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSiteUrl } from "@/lib/site-url";

describe("getSiteUrl", () => {
  beforeEach(() => {
    // Clear all relevant env vars before each test
    vi.unstubAllEnvs();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.VERCEL_URL;
    delete process.env.PORT;
  });

  it("returns NEXT_PUBLIC_SITE_URL when set", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://pitpilot.app";
    expect(getSiteUrl()).toBe("https://pitpilot.app");
  });

  it("normalizes bare domain to https", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "pitpilot.app";
    expect(getSiteUrl()).toBe("https://pitpilot.app");
  });

  it("returns VERCEL_PROJECT_PRODUCTION_URL as fallback", () => {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "pitpilot.vercel.app";
    expect(getSiteUrl()).toBe("https://pitpilot.vercel.app");
  });

  it("returns VERCEL_URL as second fallback", () => {
    process.env.VERCEL_URL = "pitpilot-abc123.vercel.app";
    expect(getSiteUrl()).toBe("https://pitpilot-abc123.vercel.app");
  });

  it("falls back to localhost:3000 when no env vars", () => {
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("uses custom PORT when set", () => {
    process.env.PORT = "4000";
    expect(getSiteUrl()).toBe("http://localhost:4000");
  });

  it("forces https for non-localhost URLs", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://pitpilot.app";
    expect(getSiteUrl()).toBe("https://pitpilot.app");
  });

  it("preserves http for localhost", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    expect(getSiteUrl()).toBe("http://localhost:3000");
  });
});

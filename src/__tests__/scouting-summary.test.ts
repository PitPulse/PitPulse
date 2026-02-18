import { describe, it, expect } from "vitest";
import {
  summarizeScouting,
  type ScoutingEntrySummaryInput,
} from "@/lib/scouting-summary";

function makeEntry(overrides?: Partial<ScoutingEntrySummaryInput>): ScoutingEntrySummaryInput {
  return {
    auto_score: 10,
    teleop_score: 20,
    endgame_score: 5,
    defense_rating: 3,
    reliability_rating: 4,
    notes: "Solid performance",
    ...overrides,
  };
}

describe("summarizeScouting", () => {
  it("returns null for empty array", () => {
    expect(summarizeScouting([])).toBeNull();
  });

  it("returns null for undefined-like input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(summarizeScouting(undefined as any)).toBeNull();
  });

  it("computes correct averages for a single entry", () => {
    const result = summarizeScouting([makeEntry()]);
    expect(result).not.toBeNull();
    expect(result!.count).toBe(1);
    expect(result!.avg_auto).toBe(10);
    expect(result!.avg_teleop).toBe(20);
    expect(result!.avg_endgame).toBe(5);
    expect(result!.avg_defense).toBe(3);
    expect(result!.avg_reliability).toBe(4);
  });

  it("computes correct averages for multiple entries", () => {
    const result = summarizeScouting([
      makeEntry({ auto_score: 10, teleop_score: 20 }),
      makeEntry({ auto_score: 20, teleop_score: 30 }),
    ]);
    expect(result!.count).toBe(2);
    expect(result!.avg_auto).toBe(15);
    expect(result!.avg_teleop).toBe(25);
  });

  it("rounds averages to 1 decimal place", () => {
    const result = summarizeScouting([
      makeEntry({ auto_score: 10 }),
      makeEntry({ auto_score: 11 }),
      makeEntry({ auto_score: 12 }),
    ]);
    // (10+11+12)/3 = 11.0
    expect(result!.avg_auto).toBe(11);

    const result2 = summarizeScouting([
      makeEntry({ auto_score: 1 }),
      makeEntry({ auto_score: 2 }),
      makeEntry({ auto_score: 3 }),
    ]);
    // (1+2+3)/3 = 2.0
    expect(result2!.avg_auto).toBe(2);
  });

  it("collects up to 3 notes", () => {
    const entries = [
      makeEntry({ notes: "Note 1" }),
      makeEntry({ notes: "Note 2" }),
      makeEntry({ notes: "Note 3" }),
      makeEntry({ notes: "Note 4" }),
    ];
    const result = summarizeScouting(entries);
    expect(result!.notes).toHaveLength(3);
    expect(result!.notes).toEqual(["Note 1", "Note 2", "Note 3"]);
  });

  it("truncates long notes at 180 chars", () => {
    const longNote = "A".repeat(200);
    const result = summarizeScouting([makeEntry({ notes: longNote })]);
    expect(result!.notes[0].length).toBeLessThanOrEqual(180);
    expect(result!.notes[0]).toMatch(/\.\.\.$/);
  });

  it("filters out empty and whitespace-only notes", () => {
    const result = summarizeScouting([
      makeEntry({ notes: "" }),
      makeEntry({ notes: "   " }),
      makeEntry({ notes: "Valid note" }),
      makeEntry({ notes: null }),
    ]);
    expect(result!.notes).toEqual(["Valid note"]);
  });
});

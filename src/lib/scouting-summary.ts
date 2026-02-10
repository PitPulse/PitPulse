export interface ScoutingEntrySummaryInput {
  auto_score: number;
  teleop_score: number;
  endgame_score: number;
  defense_rating: number;
  reliability_rating: number;
  notes?: string | null;
}

export interface ScoutingSummary {
  count: number;
  avg_auto: number;
  avg_teleop: number;
  avg_endgame: number;
  avg_defense: number;
  avg_reliability: number;
  notes: string[];
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeNote(note: string): string {
  const trimmed = note.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 180) return trimmed;
  return `${trimmed.slice(0, 177)}...`;
}

export function summarizeScouting(
  entries: ScoutingEntrySummaryInput[]
): ScoutingSummary | null {
  if (!entries || entries.length === 0) return null;

  const notes = entries
    .map((e) => e.notes ?? "")
    .map((note) => note.trim())
    .filter((note) => note.length > 0)
    .slice(0, 3)
    .map(normalizeNote);

  return {
    count: entries.length,
    avg_auto: round1(avg(entries.map((e) => e.auto_score))),
    avg_teleop: round1(avg(entries.map((e) => e.teleop_score))),
    avg_endgame: round1(avg(entries.map((e) => e.endgame_score))),
    avg_defense: round1(avg(entries.map((e) => e.defense_rating))),
    avg_reliability: round1(avg(entries.map((e) => e.reliability_rating))),
    notes,
  };
}

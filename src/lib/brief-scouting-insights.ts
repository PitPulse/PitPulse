const NO_SCOUTING_PREFIX =
  /^No scouting data available(?:; analysis based on EPA only\.)?\s*/i;

export function isEpaOnlyScoutingInsight(text: string | null | undefined): boolean {
  if (!text) return false;
  return NO_SCOUTING_PREFIX.test(text.trim());
}

export function stripEpaOnlyScoutingPrefix(text: string | null | undefined): string {
  if (!text) return "";
  return text.trim().replace(NO_SCOUTING_PREFIX, "").trim();
}

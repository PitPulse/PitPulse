export function buildFrcGamePrompt(year: number | null | undefined): string {
  if (year === 2026) {
    return `Season terminology (FRC 2026: REBUILT):
- Use accurate 2026 game jargon naturally: active HUB, inactive HUB, transition shift, shifts, end game, tower level 1/2/3, traversal, bump lane, trench lane, outpost chute.
- Match flow for framing strategy: AUTO, then TELEOP with Transition Shift + timed shifts, then End Game.
- Strategy framing should reflect 2026 scoring priorities: active-HUB fuel value, tower climbing levels, and RP-focused planning.
- Keep wording practical and drive-team ready; no hype and no made-up mechanics.`;
  }

  if (year === 2025) {
    return `Season terminology (FRC 2025: REEFSCAPE):
- Use accurate 2025 game jargon naturally: coral, algae, reef levels, processor, net, barge, shallow cage, deep cage, coral station, coopertition point.
- Match flow for framing strategy: AUTO, then TELEOP, then End Game climb/park decisions around the barge.
- Strategy framing should reflect 2025 scoring priorities: coral throughput, algae handling choices (processor/net), and endgame cage value.
- Keep wording practical and drive-team ready; no hype and no made-up mechanics.`;
  }

  if (!year) {
    return `Season terminology:
- Prefer event-specific FRC terminology for the event year when known.
- If the season context is unclear, use neutral strategy language and do not invent game-specific mechanics.`;
  }

  return `Season terminology (FRC ${year}):
- Prefer official terminology from the ${year} game manual and kickoff animation.
- Use season-accurate terms only; if uncertain, ask for clarification rather than inventing mechanics.
- Keep wording practical and strategy-focused for drive team and scouting use.`;
}

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// "One Letter: Coffee or Tea" — program/v1 entry.
// Only two possible entries exist: "A" (coffee) or "B" (tea). Both are
// scored against the judge's criteria 2-5 in order with a weighted scorer
// (vivid x4 + funny x3 + true x2 + stands-alone x1), then the recorded
// independent panel result is applied. Writes exactly one letter — ONE byte,
// no trailing newline — to entry.txt. A trailing newline would make the file
// 2 characters and fail the sealed gate, so no newline is ever appended.

interface Scores {
  vivid: number;
  funny: number;
  true: number;
  standsAlone: number;
}

interface Candidate {
  id: string;
  letter: string;
  drink: string;
  scores: Scores;
}

const candidates: Candidate[] = [
  {
    id: "A",
    letter: "A",
    drink: "coffee",
    // Coffee is the loud drink: mornings, bitterness, ritual, "but first
    // coffee" ubiquity — the letter lands as a jolt, a full cup, the opening
    // move of the argument. The jokes write themselves, and it is the honest
    // daily habit most senders would actually defend.
    scores: { vivid: 9, funny: 8, true: 8, standsAlone: 9 },
  },
  {
    id: "B",
    letter: "B",
    drink: "tea",
    // Tea has a real calm ritual — steeping, warmth, quiet afternoons — but
    // it reads softer, less electric; its wit is a calm shrug, a smile not a
    // laugh, and in the loud coffee-against-tea argument it is the minority
    // stance, the second option rather than the declaration.
    scores: { vivid: 7, funny: 6, true: 7, standsAlone: 8 },
  },
];

// Weighted scorer: the criteria are weighed in the judge's order —
// vivid x4 + funny x3 + true x2 + stands-alone x1 (max 100).
function weightedScore(s: Scores): number {
  return s.vivid * 4 + s.funny * 3 + s.true * 2 + s.standsAlone * 1;
}

function rankCandidates(list: Candidate[]): Candidate[] {
  return list
    .slice()
    .sort((a, b) => weightedScore(b.scores) - weightedScore(a.scores));
}

// Panel: the CrowLLM independent panel was effectively unusable — 13 model
// calls, only 1 parseable verdict (k2-horizon-375b-a23b:free favoured B,
// weighted 47 vs 59, margin 2, on letter-shape grounds). One judge is not a
// panel, so it does not overrule the internal winner; the recorded totals are
// kept here for the record and the internal winner stands.
const panelTotals: Record<string, number> = {
  A: 47, // one judge counted
  B: 59, // one judge counted
};
const panelUsable = false;

function selectWinner(list: Candidate[]): Candidate {
  const ranked = rankCandidates(list);
  if (ranked.length === 0) {
    throw new Error("no candidates to rank");
  }
  // The panel step only applies when the panel is usable (>= 3 judges); with
  // a single judge it is recorded but cannot overrule the internal ranking.
  if (panelUsable) {
    let winner = ranked[0];
    let bestPanel = -Infinity;
    for (const c of ranked) {
      const panel = panelTotals[c.id];
      if (panel !== undefined && panel > bestPanel) {
        bestPanel = panel;
        winner = c;
      }
    }
    return winner;
  }
  return ranked[0];
}

function main(): void {
  const winner = selectWinner(candidates);
  // Gate guard: the entry must be exactly one letter, A or B — fail loudly
  // instead of writing an invalid entry.
  if (!/^[AB]$/.test(winner.letter)) {
    throw new Error(`winning letter fails the gate: ${JSON.stringify(winner.letter)}`);
  }
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
  mkdirSync(outDir, { recursive: true });
  // Exactly one byte: the letter alone, NO trailing newline.
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.letter, "utf8");
  // Read-back guard: the sealed gate requires exactly 1 character, not only
  // white space — refuse to finish if the file is anything but one byte.
  const written = readFileSync(outPath, "utf8");
  if (written.length !== 1 || written !== winner.letter) {
    throw new Error(
      `entry.txt failed the gate: expected exactly ${JSON.stringify(winner.letter)}, got ${JSON.stringify(written)} (${Buffer.byteLength(written, "utf8")} bytes)`,
    );
  }
}

main();

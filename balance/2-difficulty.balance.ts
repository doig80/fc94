import { it } from "vitest";
import { applyDifficulty, cloneParams, DEFAULT_PARAMS, type Difficulty } from "../src/sim";
import { playMatch } from "./match";
import { report } from "./section";

/** Matches per level. Half with the CPU as the home team, half as the away team. */
const MATCHES = 80;

/**
 * A team playing at Normal stands in for an average player (docs/specs/11 §6: "Easy is beatable, Hard is
 * hard"). It's not a human, but it shows whether the levels are far enough apart, and in the right order.
 */
function versus(level: Difficulty) {
  let wins = 0;
  let scored = 0;
  let conceded = 0;
  let offsides = 0;
  for (let seed = 1; seed <= MATCHES; seed++) {
    const cpu = (seed % 2) as 0 | 1;
    const params = cloneParams(DEFAULT_PARAMS);
    applyDifficulty(params, level, cpu);
    const stats = playMatch(seed, params);
    const score = stats.score;
    const us = score[cpu === 1 ? 0 : 1];
    const them = score[cpu];
    if (us > them) wins++;
    scored += us;
    conceded += them;
    offsides += stats.offsides[cpu];
  }
  return {
    wins: wins / MATCHES,
    scored: scored / MATCHES,
    conceded: conceded / MATCHES,
    offsides: offsides / MATCHES,
  };
}

it("Easy is beatable and Hard is hard (docs/specs/11 §2)", () => {
  const easy = versus("easy");
  const hard = versus("hard");
  report("2-difficulty", {
    title: "Difficulty: a Normal-level team against the CPU",
    about: `${MATCHES} matches per level`,
    rows: [
      { label: "Wins against Easy", value: easy.wins, unit: "%", min: 0.7, enforced: true },
      { label: "Goals per match against Easy", value: easy.scored, unit: "", enforced: false },
      { label: "Goals conceded per match against Easy", value: easy.conceded, unit: "", enforced: false },
      {
        label: "Times Easy is caught offside per match",
        note: "offside is off on Easy unless switched on",
        value: easy.offsides,
        unit: "",
        enforced: false,
      },
      { label: "Wins against Hard", value: hard.wins, unit: "%", max: 0.35, enforced: true },
      {
        label: "Goals per match against Hard",
        note: "Hard can still be beaten",
        value: hard.scored,
        unit: "",
        min: 0.5,
        enforced: true,
      },
      { label: "Goals conceded per match against Hard", value: hard.conceded, unit: "", enforced: false },
      { label: "Times Hard is caught offside per match", value: hard.offsides, unit: "", enforced: false },
    ],
  });
});

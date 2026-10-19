import { it } from "vitest";
import { cloneParams, DEFAULT_PARAMS } from "../src/sim";
import { fouls, playMatch, type MatchStats } from "./match";
import { mean, percentile, report } from "./section";

/** Matches played; enough that a one-sided edge of a few percent shows up. */
const MATCHES = 300;

it("an even match plays like football (docs/specs/10 §8)", () => {
  const params = cloneParams(DEFAULT_PARAMS);
  const all: MatchStats[] = [];
  for (let seed = 1; seed <= MATCHES; seed++) all.push(playMatch(seed, params));

  const goals = all.map((m) => m.score[0] + m.score[1]);
  const shots = all.map((m) => m.shots[0] + m.shots[1]);
  const home = all.reduce((n, m) => n + m.score[0], 0);
  const possession = all.reduce((n, m) => n + m.possession[0], 0);
  const possessionAll = all.reduce((n, m) => n + m.possession[0] + m.possession[1], 0);
  const passes = all.flatMap((m) => m.passes);
  const short = passes.filter((p) => p.dist < 15).map((p) => p.time);
  const long = passes.filter((p) => p.dist >= 15).map((p) => p.time);
  const tried = all.reduce((n, m) => n + m.passesTried, 0);

  report("1-even", {
    title: "Even match: Normal vs Normal",
    about: `${MATCHES} CPU-vs-CPU matches of 2 × 5 minutes`,
    rows: [
      { label: "Goals per match", value: mean(goals), unit: "", min: 3, max: 6, enforced: true },
      {
        label: "Goalless draws",
        value: goals.filter((g) => g === 0).length / MATCHES,
        unit: "%",
        enforced: false,
      },
      {
        label: "Home team's share of the goals",
        note: "both sides play the same, so about half",
        value: home / Math.max(1, mean(goals) * MATCHES),
        unit: "%",
        min: 0.45,
        max: 0.55,
        enforced: true,
      },
      {
        label: "Home team's possession",
        value: possession / Math.max(1, possessionAll),
        unit: "%",
        min: 0.4,
        max: 0.6,
        enforced: true,
      },
      {
        label: "Short passes (under 15 m): 9 in 10 arrive within",
        value: percentile(short, 0.9),
        unit: "s",
        max: 1,
        enforced: true,
      },
      long.length >= 20
        ? {
            label: "Long passes: 9 in 10 arrive within",
            value: percentile(long, 0.9),
            unit: "s",
            max: 2,
            enforced: true,
          }
        : {
            label: "Long passes per match",
            note: "the CPU rarely plays them",
            value: long.length / MATCHES,
            unit: "",
            enforced: false,
          },
      { label: "Passes per match", value: tried / MATCHES, unit: "", enforced: false },
      {
        label: "Passes that reach a teammate",
        value: passes.length / Math.max(1, tried),
        unit: "%",
        enforced: false,
      },
      { label: "Shots per match", value: mean(shots), unit: "", enforced: false },
      {
        label: "Shots that go in",
        value: mean(goals) / Math.max(1, mean(shots)),
        unit: "%",
        enforced: false,
      },
      { label: "Fouls per match", value: mean(all.map(fouls)), unit: "", enforced: false },
      {
        label: "Penalties per match",
        value: mean(all.map((m) => m.calls.penalty ?? 0)),
        unit: "",
        enforced: false,
      },
    ],
  });
});

import { describe, expect, it } from "vitest";
import { cloneState, DEFAULT_PARAMS, kickBall, Rng, step, type Intent, type MatchState } from "../src/sim";
import { newMatch } from "./helpers";

/** A long, varied input stream from a seed: everyone runs around, sprints, and the ball gets kicked. */
function scriptedRun(state: MatchState, ticks: number, inputSeed: number): void {
  const rng = new Rng(inputSeed);
  const intents: Intent[] = state.players.map(() => ({
    moveX: 0,
    moveZ: 0,
    sprint: false,
    pass: false,
    shoot: false,
    lob: false,
  }));
  for (let t = 0; t < ticks; t++) {
    if (t % 20 === 0) {
      for (const intent of intents) {
        intent.moveX = rng.range(-1, 1);
        intent.moveZ = rng.range(-1, 1);
        intent.sprint = rng.next() < 0.3;
      }
    }
    if (t % 90 === 45 && state.ball.owner >= 0) {
      kickBall(
        state,
        state.ball.owner,
        { x: rng.range(-20, 20), y: rng.range(0, 8), z: rng.range(-10, 10) },
        { x: 0, y: rng.range(-15, 15), z: 0 },
      );
    }
    step(state, intents, DEFAULT_PARAMS);
  }
}

describe("determinism (docs/specs/01 §7)", () => {
  it("produces identical matches from the same seed and inputs", () => {
    const a = newMatch(7);
    const b = newMatch(7);
    scriptedRun(a, 5000, 99);
    scriptedRun(b, 5000, 99);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("continues identically from a snapshot", () => {
    const original = newMatch(3);
    scriptedRun(original, 1200, 5);
    const snapshot = cloneState(original);
    scriptedRun(original, 1200, 6);
    scriptedRun(snapshot, 1200, 6);
    expect(snapshot).toEqual(original);
  });

  it("survives a JSON round trip (save files, network)", () => {
    const s = newMatch(11);
    scriptedRun(s, 600, 2);
    const restored = JSON.parse(JSON.stringify(s)) as MatchState;
    scriptedRun(s, 600, 4);
    scriptedRun(restored, 600, 4);
    expect(restored).toEqual(s);
  });

  it("actually moves things (guards against a test that passes because nothing happens)", () => {
    const s = newMatch(7);
    const before = cloneState(s);
    scriptedRun(s, 600, 99);
    expect(s.players[3].pos).not.toEqual(before.players[3].pos);
    expect(s.tick).toBe(600);
  });
});

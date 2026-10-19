import { NullEngine, Scene, TransformNode } from "@babylonjs/core";
import { describe, expect, it } from "vitest";
import { Officials } from "../src/render/officials";
import { PlayerRig } from "../src/render/players";
import { createMatch, PITCH_FULL, type MatchState } from "../src/sim";

function setup(fouls = true): { officials: Officials; rigs: PlayerRig[]; state: MatchState } {
  const scene = new Scene(new NullEngine());
  const rigs = [0, 1, 2].map((k) => new PlayerRig(scene, `official${k}`));
  const state = createMatch({ seed: 1, pitch: PITCH_FULL, teamSize: 11, rules: { halfTicks: 1000, fouls } });
  state.phase = { kind: "play" };
  return { officials: new Officials(scene, rigs), rigs, state };
}

describe("referee and assistants (#47)", () => {
  it("the referee keeps a few metres from the ball, towards the middle, and follows play", () => {
    const { officials, state } = setup();
    officials.update(state, 30, 20, 0);
    let ref = officials.positions()[0];
    const d = Math.hypot(ref.x - 30, ref.z - 20);
    expect(d).toBeGreaterThan(6);
    expect(d).toBeLessThan(14);
    expect(Math.abs(ref.z)).toBeLessThan(20);
    // The ball moves 10 m: he runs after it, not teleporting.
    for (let t = 0; t < 60; t++) officials.update(state, 20, 20, 1 / 60);
    const after = officials.positions()[0];
    expect(after.x).toBeLessThan(ref.x);
    ref = after;
    expect(Math.hypot(ref.x - 20, ref.z - 20)).toBeLessThan(16);
  });

  it("the assistants stand on opposite touchlines, one in each half", () => {
    const { officials, state } = setup();
    officials.update(state, 0, 0, 0);
    const [, a, b] = officials.positions();
    expect(a.x).toBeGreaterThan(0);
    expect(b.x).toBeLessThan(0);
    expect(Math.abs(a.z)).toBeGreaterThan(PITCH_FULL.width / 2);
    expect(Math.sign(a.z)).toBe(-Math.sign(b.z));
  });

  it("an offside call raises the flag in that half; a card goes up in the referee's hand", () => {
    const { officials, rigs, state } = setup();
    officials.update(state, 0, 0, 0);
    // The right arm: the shoulder joint on the +z side.
    const arm = (rig: PlayerRig) =>
      rig.root.getDescendants(false).find((n) => n.name.endsWith(":shoulder1")) as TransformNode;
    state.lastEvent = { kind: "offside", team: 1, tick: state.tick - 30, line: 20 };
    officials.update(state, 0, 0, 1 / 60);
    expect(arm(rigs[1]).rotation.z).toBeGreaterThan(2.5);
    expect(arm(rigs[2]).rotation.z).toBeLessThan(1);
    state.lastEvent = { kind: "freekick", team: 0, tick: state.tick - 60, card: { player: 14, red: false } };
    officials.update(state, 0, 0, 1 / 60);
    expect(arm(rigs[0]).rotation.z).toBeGreaterThan(2.5);
  });

  it("with no referee they're nowhere to be seen", () => {
    const { officials, rigs, state } = setup(false);
    officials.update(state, 0, 0, 0);
    for (const rig of rigs) expect(rig.root.position.y).toBeLessThan(-10);
  });
});

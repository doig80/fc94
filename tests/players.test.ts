import { describe, expect, it } from "vitest";
import { step, type Intent } from "../src/sim";
import { newMatch, params } from "./helpers";

function intent(moveX: number, moveZ: number, sprint = false): Intent {
  return { moveX, moveZ, sprint, pass: false, shoot: false, lob: false };
}

describe("player movement", () => {
  const p = params();

  it("accelerates to run speed and no further", () => {
    const s = newMatch();
    for (let i = 0; i < 120; i++) step(s, [intent(1, 0)], p);
    expect(s.players[0].vel.x).toBeCloseTo(p.player.runSpeed, 5);
  });

  it("sprints faster, uses stamina, and recovers it", () => {
    const s = newMatch();
    for (let i = 0; i < 60; i++) step(s, [intent(0, 1, true)], p);
    expect(s.players[0].vel.z).toBeCloseTo(p.player.sprintSpeed, 5);
    const tired = s.players[0].stamina;
    expect(tired).toBeLessThan(1);
    for (let i = 0; i < 60; i++) step(s, [intent(0, 0)], p);
    expect(s.players[0].stamina).toBeGreaterThan(tired);
  });

  it("cannot sprint with an empty tank", () => {
    const s = newMatch();
    s.players[0].stamina = 0;
    for (let i = 0; i < 60; i++) step(s, [intent(0, 1, true)], p);
    expect(s.players[0].vel.z).toBeLessThanOrEqual(p.player.runSpeed + 1e-9);
  });

  it("diagonal input is not faster than straight input", () => {
    const s = newMatch();
    for (let i = 0; i < 120; i++) step(s, [intent(1, 1)], p);
    const v = s.players[0].vel;
    expect(Math.hypot(v.x, v.z)).toBeCloseTo(p.player.runSpeed, 5);
  });

  it("turns to face the direction of movement", () => {
    const s = newMatch();
    for (let i = 0; i < 30; i++) step(s, [intent(0, -1)], p);
    expect(s.players[0].facing.z).toBeCloseTo(-1, 2);
  });

  it("stops when there is no input", () => {
    const s = newMatch();
    for (let i = 0; i < 60; i++) step(s, [intent(1, 0)], p);
    for (let i = 0; i < 60; i++) step(s, [], p);
    expect(s.players[0].vel.x).toBe(0);
  });

  it("players do not overlap after running into each other", () => {
    const s = newMatch();
    s.players[1].pos = { x: 0, z: 0 };
    s.players[6].pos = { x: 3, z: 0 };
    const intents: Intent[] = [];
    intents[1] = intent(1, 0);
    intents[6] = intent(-1, 0);
    for (let i = 0; i < 90; i++) step(s, intents, p);
    const a = s.players[1].pos;
    const b = s.players[6].pos;
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(p.player.radius * 2 - 1e-9);
  });

  it("stay near the pitch", () => {
    const s = newMatch();
    for (let i = 0; i < 600; i++) step(s, [intent(1, 1, true)], p);
    expect(s.players[0].pos.x).toBeLessThanOrEqual(s.pitch.length / 2 + p.player.boundsMargin);
    expect(s.players[0].pos.z).toBeLessThanOrEqual(s.pitch.width / 2 + p.player.boundsMargin);
  });
});

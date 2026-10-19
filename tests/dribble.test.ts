import { describe, expect, it } from "vitest";
import { kickBall, step, type Intent } from "../src/sim";
import { emptyPitch, params } from "./helpers";

function intent(moveX: number, moveZ: number, sprint = false): Intent {
  return { moveX, moveZ, sprint, pass: false, shoot: false, lob: false };
}

describe("dribbling", () => {
  const p = params();

  function playerOnBall() {
    const s = emptyPitch();
    s.players[2].pos = { x: -0.4, z: 0 };
    s.players[2].facing = { x: 1, z: 0 };
    return s;
  }

  it("picks up a loose ball at the feet", () => {
    const s = playerOnBall();
    step(s, [], p);
    expect(s.ball.owner).toBe(2);
  });

  it("keeps the ball close while running and turning", () => {
    const s = playerOnBall();
    const intents: Intent[] = [];
    for (let t = 0; t < 300; t++) {
      intents[2] = t < 150 ? intent(1, 0) : intent(0, 1);
      step(s, intents, p);
      expect(s.ball.owner).toBe(2);
    }
    const pl = s.players[2];
    expect(Math.hypot(s.ball.pos.x - pl.pos.x, s.ball.pos.z - pl.pos.z)).toBeLessThan(
      p.dribble.distance + 0.3,
    );
  });

  it("pushes the ball further ahead when sprinting", () => {
    const run = (sprint: boolean) => {
      const s = playerOnBall();
      const intents: Intent[] = [];
      intents[2] = intent(1, 0, sprint);
      for (let t = 0; t < 60; t++) step(s, intents, p);
      return s.ball.pos.x - s.players[2].pos.x;
    };
    expect(run(true)).toBeGreaterThan(run(false) + 0.3);
  });

  it("releases the ball on a kick, and the kicker can't immediately take it back", () => {
    const s = playerOnBall();
    step(s, [], p);
    kickBall(s, 2, { x: 3, y: 0, z: 0 });
    step(s, [], p);
    expect(s.ball.owner).toBe(-1);
    expect(s.ball.lastTouch).toBe(2);
  });

  it("a teammate receives a pass", () => {
    const s = playerOnBall();
    s.players[3].pos = { x: 8, z: 0 };
    step(s, [], p);
    kickBall(s, 2, { x: 9, y: 0, z: 0 });
    let received = false;
    for (let t = 0; t < 180 && !received; t++) {
      step(s, [], p);
      received = s.ball.owner === 3;
    }
    expect(received).toBe(true);
  });

  it("a hard shot is too fast to be stopped by simply standing in the way", () => {
    const s = playerOnBall();
    s.players[3].pos = { x: 6, z: 0 };
    step(s, [], p);
    kickBall(s, 2, { x: 25, y: 0, z: 0 });
    for (let t = 0; t < 30; t++) step(s, [], p);
    expect(s.ball.owner).not.toBe(3);
  });
});

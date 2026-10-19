import { describe, expect, it } from "vitest";
import {
  aiIntents,
  attackSign,
  cloneParams,
  createMatch,
  DEFAULT_PARAMS,
  IDLE,
  kickBall,
  matchMinute,
  PITCH_5_A_SIDE,
  stepMatch,
  type Intent,
  type MatchState,
  type Phase,
  type SimParams,
} from "../src/sim";

const L = PITCH_5_A_SIDE.length / 2;
const W = PITCH_5_A_SIDE.width / 2;
const R = DEFAULT_PARAMS.ball.radius;
const HALF = 600;

/** A refereed match; the human (controller 0) plays for team 0. */
function match(fouls = true, halfTicks = HALF): MatchState {
  return createMatch({ seed: 3, pitch: PITCH_5_A_SIDE, teamSize: 5, rules: { halfTicks, fouls } });
}

/** Skip the kick-off: play is on, everyone parked by the touchlines, the ball loose at (x, z). */
function inPlay(s: MatchState, x = 0, z = 0): void {
  s.phase = { kind: "play" };
  s.players.forEach((p, i) => (p.pos = { x: -L + 2 + i * 3.5, z: p.team === 0 ? W - 0.5 : -W + 0.5 }));
  s.ball.owner = -1;
  s.ball.pos = { x, y: R, z };
  s.ball.vel = { x: 0, y: 0, z: 0 };
}

function intent(partial: Partial<Intent> = {}): Intent {
  return { ...IDLE, ...partial };
}

function run(s: MatchState, ticks: number, i: Intent = intent(), p: SimParams = DEFAULT_PARAMS): void {
  for (let t = 0; t < ticks; t++) stepMatch(s, [i], p);
}

function dist(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

describe("kick-off", () => {
  it("lines the teams up: the forward on the ball, opponents outside the circle, everyone in their half", () => {
    const s = match();
    expect(s.phase.kind).toBe("restart");
    if (s.phase.kind !== "restart") return;
    expect(s.phase.restart.kind).toBe("kickoff");
    expect(s.ball.owner).toBe(4);
    expect(s.controllers[0].player).toBe(4);
    run(s, 30);
    for (const [i, p] of s.players.entries()) {
      if (i === 4) continue;
      expect(p.pos.x * attackSign(s, p.team)).toBeLessThanOrEqual(0);
      if (p.team === 1)
        expect(dist(p.pos, { x: 0, z: 0 })).toBeGreaterThanOrEqual(PITCH_5_A_SIDE.centreCircle);
    }
  });

  it("the taker can turn but not run off with the ball", () => {
    const s = match();
    run(s, 30, intent({ moveX: 1, moveZ: 0.5 }));
    expect(s.phase.kind).toBe("restart");
    expect(dist(s.ball.pos, { x: 0, z: 0 })).toBeLessThan(1e-9);
    expect(dist(s.players[4].pos, { x: 0, z: 0 })).toBeLessThan(0.6);
  });

  it("a pass starts play", () => {
    const s = match();
    run(s, 2, intent({ pass: true, moveZ: 1 }));
    expect(s.phase.kind).toBe("play");
    expect(s.ball.owner).toBe(-1);
  });

  it("a human who waits too long has it taken for them", () => {
    const s = match();
    run(s, DEFAULT_PARAMS.referee.autoRestartTicks + 5);
    expect(s.phase.kind).toBe("play");
  });
});

describe("goals", () => {
  it("count, pause, then the team that conceded kicks off", () => {
    const s = match();
    inPlay(s, L - 3, 0);
    kickBall(s, 4, { x: 20, y: 0.5, z: 0 });
    run(s, 20);
    expect(s.score).toEqual([1, 0]);
    expect(s.phase.kind).toBe("goal");
    expect(s.lastEvent?.kind).toBe("goal");
    run(s, DEFAULT_PARAMS.referee.goalPauseTicks);
    expect(s.phase.kind).toBe("restart");
    if (s.phase.kind === "restart") expect(s.phase.restart).toMatchObject({ kind: "kickoff", team: 1 });
  });
});

describe("out of play", () => {
  it("over the touchline: a kick-in for the other team, on the line, opponents back", () => {
    const s = match();
    inPlay(s, 5, W - 1);
    kickBall(s, 2, { x: 0, y: 0, z: 8 }); // team 0 touched it last
    run(s, 30);
    expect(s.phase.kind).toBe("restart");
    if (s.phase.kind !== "restart") return;
    const r = s.phase.restart;
    expect(r).toMatchObject({ kind: "kickin", team: 1 });
    expect(r.spot.x).toBeCloseTo(5, 0);
    expect(Math.abs(r.spot.z)).toBeCloseTo(W, 0);
    expect(s.players[r.taker].team).toBe(1);
    run(s, 2);
    for (const p of s.players) if (p.team === 0) expect(dist(p.pos, r.spot)).toBeGreaterThanOrEqual(3.4);
  });

  it("over the goal line off a defender: a corner", () => {
    const s = match();
    // Team 1 defends the goal at +x in the first half.
    inPlay(s, L - 2, 3);
    kickBall(s, 6, { x: 10, y: 0, z: 2 });
    run(s, 30);
    expect(s.phase.kind).toBe("restart");
    if (s.phase.kind !== "restart") return;
    expect(s.phase.restart).toMatchObject({ kind: "corner", team: 0 });
    expect(s.phase.restart.spot.x).toBeCloseTo(L, 0);
    expect(s.phase.restart.spot.z).toBeCloseTo(W, 0);
  });

  it("over the goal line off an attacker: a goal kick by the keeper", () => {
    const s = match();
    inPlay(s, L - 2, 4);
    kickBall(s, 3, { x: 10, y: 0, z: 0 });
    run(s, 30);
    expect(s.phase.kind).toBe("restart");
    if (s.phase.kind !== "restart") return;
    expect(s.phase.restart).toMatchObject({ kind: "goalkick", team: 1, taker: 5 });
  });
});

describe("fouls (docs/specs/10 §6)", () => {
  /** Team 1's player 9 dribbles away from the human's player 1, who is right behind. */
  function chase(s: MatchState, x: number, z = 0): void {
    inPlay(s);
    s.players[9].pos = { x, z };
    s.players[9].facing = { x: -1, z: 0 };
    s.ball.pos = { x: x - 0.5, y: R, z };
    s.ball.owner = 9;
    s.players[1].pos = { x: x + 0.8, z };
    s.players[1].facing = { x: -1, z: 0 };
    s.controllers[0].player = 1;
    s.controllers[0].assists.autoSwitch = false;
  }

  it("a tackle from behind gives a free kick where it happened", () => {
    const s = match();
    chase(s, 2);
    const p = cloneParams(DEFAULT_PARAMS);
    p.action.tackleSuccess = 0;
    run(s, 3, intent({ shoot: true }), p);
    expect(s.phase.kind).toBe("restart");
    if (s.phase.kind !== "restart") return;
    expect(s.phase.restart).toMatchObject({ kind: "freekick", team: 1 });
    expect(dist(s.phase.restart.spot, { x: 2, z: 0 })).toBeLessThan(1);
    expect(s.phase.restart.aim).not.toBeNull();
  });

  it("inside your own area it's a penalty: keeper on the line, everyone else out of the box", () => {
    const s = match();
    // Team 0 defends the goal at −x; foul 3 m from it.
    chase(s, -L + 3);
    const p = cloneParams(DEFAULT_PARAMS);
    p.action.tackleSuccess = 0;
    run(s, 3, intent({ shoot: true }), p);
    expect(s.phase.kind).toBe("restart");
    if (s.phase.kind !== "restart") return;
    expect(s.phase.restart).toMatchObject({ kind: "penalty", team: 1, taker: 9 });
    run(s, 2, intent(), p);
    const gk = s.players[0];
    expect(gk.pos.x).toBeCloseTo(-L + 0.3, 1);
    for (const [i, pl] of s.players.entries()) {
      if (i === 0 || i === 9) continue;
      expect(pl.pos.x - -L).toBeGreaterThan(PITCH_5_A_SIDE.penaltyAreaDepth);
    }
  });

  it("plays advantage when the fouled team keeps the ball", () => {
    const s = match();
    inPlay(s);
    // Player 9 has just laid the ball off to teammate 8; the human's player 1 slides into 9 anyway.
    s.players[9].pos = { x: 2, z: 0 };
    s.players[9].facing = { x: 1, z: 0 };
    s.players[8].pos = { x: -4, z: 3 };
    s.ball.pos = { x: -3.5, y: R, z: 3 };
    s.ball.owner = 8;
    s.players[1].pos = { x: 3.4, z: 0 };
    s.players[1].facing = { x: -1, z: 0 };
    s.controllers[0].player = 1;
    s.controllers[0].assists.autoSwitch = false;
    run(s, 20, intent({ lob: true, moveX: -1 }));
    expect(s.lastEvent?.kind).toBe("advantage");
    expect(s.phase.kind).toBe("play");
  });

  it("with no referee fouls aren't called", () => {
    const s = match(false);
    chase(s, 2);
    const p = cloneParams(DEFAULT_PARAMS);
    p.action.tackleSuccess = 0;
    run(s, 3, intent({ shoot: true }), p);
    expect(s.phase.kind).toBe("play");
  });
});

describe("free-kick aiming (M7)", () => {
  it("the stick moves the marker along the goal, and the shot goes there", () => {
    const s = match();
    inPlay(s);
    s.players[4].pos = { x: L - 10, z: 0 };
    // Team 0 fouled 10 m out, the ball running loose: a free kick.
    s.foul = { by: 6, victim: 4, spot: { x: L - 10, z: 0 } };
    run(s, 1);
    const phase = (s as { phase: Phase }).phase;
    expect(phase.kind).toBe("restart");
    if (phase.kind !== "restart") return;
    const r = phase.restart;
    expect(r.aim?.z).toBe(0);
    // Hold the stick sideways (−z) for half a second: the marker slides.
    run(s, 30, intent({ moveZ: -1 }));
    expect(r.aim!.z).toBeLessThan(-0.8);
    const target = r.aim!.z;
    // Shoot (stick centred, so no curl).
    s.players.forEach((p, i) => {
      if (i !== 4) p.pos = { x: -L + 2 + i, z: W - 0.5 };
    });
    run(s, 20, intent({ shoot: true }));
    let crossed = NaN;
    for (let t = 0; t < 60 && Number.isNaN(crossed); t++) {
      run(s, 1);
      if (s.ball.pos.x >= L) crossed = s.ball.pos.z;
    }
    expect(crossed).toBeCloseTo(target, 0);
  });
});

describe("halves and the clock", () => {
  it("half-time after the first half; then the teams swap ends and the other team kicks off", () => {
    const s = match(true, 120);
    inPlay(s);
    run(s, 121);
    expect(s.phase.kind).toBe("halftime");
    expect(matchMinute(s)).toBe(45);
    run(s, DEFAULT_PARAMS.referee.halftimeTicks + 1);
    expect(s.half).toBe(2);
    expect(attackSign(s, 0)).toBe(-1);
    expect(s.phase.kind).toBe("restart");
    if (s.phase.kind === "restart") expect(s.phase.restart).toMatchObject({ kind: "kickoff", team: 1 });
    expect(matchMinute(s)).toBe(45);
  });

  it("full time after the second half: nothing moves any more", () => {
    const s = match(true, 60);
    run(s, 1000);
    expect(s.phase.kind).toBe("fulltime");
    const frozen = JSON.stringify(s.players);
    run(s, 30, intent({ moveX: 1 }));
    expect(JSON.stringify(s.players)).toBe(frozen);
    expect(s.lastEvent?.kind).toBe("fulltime");
  });
});

describe("CPU restarts", () => {
  it("the CPU takes its own kick-ins", () => {
    const p = cloneParams(DEFAULT_PARAMS);
    const s = match();
    inPlay(s, 5, W - 1);
    kickBall(s, 2, { x: 0, y: 0, z: 8 });
    const phase = () => (s as { phase: Phase }).phase.kind;
    for (let t = 0; t < 60 && phase() !== "restart"; t++) stepMatch(s, [intent()], p, (m) => aiIntents(m, p));
    expect(phase()).toBe("restart");
    for (let t = 0; t < 200 && phase() !== "play"; t++) stepMatch(s, [intent()], p, (m) => aiIntents(m, p));
    expect(phase()).toBe("play");
    expect(s.ball.lastTouch >= 5).toBe(true);
  });
});

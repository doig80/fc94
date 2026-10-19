import { describe, expect, it } from "vitest";
import {
  aiIntents,
  applyDifficulty,
  cloneParams,
  createMatch,
  DEFAULT_PARAMS,
  DIFFICULTY,
  IDLE,
  isInGoal,
  kickBall,
  PITCH_5_A_SIDE,
  Rng,
  stepMatch,
  type Difficulty,
  type Intent,
  type MatchState,
  type SimParams,
} from "../src/sim";

const L = PITCH_5_A_SIDE.length / 2;
const W = PITCH_5_A_SIDE.width / 2;
const R = DEFAULT_PARAMS.ball.radius;

function paramsFor(d: Difficulty): SimParams {
  const p = cloneParams(DEFAULT_PARAMS);
  applyDifficulty(p, d);
  return p;
}

/** A CPU-vs-CPU match; goals restart from the kick-off, balls out of play come back 1 m inside. */
function cpuMatch(seed: number, ticks: number, p: SimParams): { state: MatchState; goals: number } {
  let s = createMatch({ seed, pitch: PITCH_5_A_SIDE, teamSize: 5, humans: [] });
  let goals = 0;
  for (let t = 0; t < ticks; t++) {
    stepMatch(s, [], p, (m) => aiIntents(m, p));
    const b = s.ball;
    if (isInGoal(b, s.pitch, R) !== 0) {
      goals++;
      s = createMatch({ seed: s.rng, pitch: PITCH_5_A_SIDE, teamSize: 5, humans: [] });
    } else if (Math.abs(b.pos.x) > L + 0.2 || Math.abs(b.pos.z) > W + 0.2) {
      b.owner = -1;
      b.vel = { x: 0, y: 0, z: 0 };
      b.pos = {
        x: Math.max(-L + 1, Math.min(L - 1, b.pos.x)),
        y: R,
        z: Math.max(-W + 1, Math.min(W - 1, b.pos.z)),
      };
    }
  }
  return { state: s, goals };
}

/** The CPU forward (4) on the ball 6–13 m out, alone against the keeper (5). Returns how many go in. */
function shootout(d: Difficulty, n: number): number {
  const p = paramsFor(d);
  const rng = new Rng(42);
  let goals = 0;
  for (let k = 0; k < n; k++) {
    const s = createMatch({ seed: k + 1, pitch: PITCH_5_A_SIDE, teamSize: 5, humans: [] });
    s.players.forEach((pl, i) => {
      if (i !== 4 && i !== 5) pl.pos = { x: -L + 1 + i, z: W + 1 };
    });
    const dist = rng.range(6, 13);
    const z = rng.range(-5, 5);
    s.players[4].pos = { x: L - dist, z };
    s.players[4].facing = { x: 1, z: 0 };
    s.ball.pos = { x: L - dist + 0.5, y: R, z };
    s.ball.owner = 4;
    s.ball.lastTouch = 4;
    for (let t = 0; t < 240; t++) {
      stepMatch(s, [], p, (m) => aiIntents(m, p));
      if (isInGoal(s.ball, s.pitch, R) === 1) {
        goals++;
        break;
      }
    }
  }
  return goals;
}

describe("CPU players (docs/specs/11)", () => {
  it("play the same match every time from the same seed", () => {
    const p = paramsFor("normal");
    const a = cpuMatch(7, 3000, p).state;
    const b = cpuMatch(7, 3000, p).state;
    expect(a).toEqual(b);
  });

  it("play a few minutes of football: goals, and nothing breaks", () => {
    const p = paramsFor("easy");
    const { state, goals } = cpuMatch(3, 10800, p);
    expect(goals).toBeGreaterThan(0);
    for (const pl of state.players) expect(Number.isFinite(pl.pos.x + pl.pos.z)).toBe(true);
    expect(Number.isFinite(state.ball.pos.x + state.ball.pos.y + state.ball.pos.z)).toBe(true);
  });

  it("shoot when in range", () => {
    const p = paramsFor("normal");
    const s = createMatch({ seed: 1, pitch: PITCH_5_A_SIDE, teamSize: 5, humans: [] });
    s.players[4].pos = { x: L - 9, z: 0 };
    s.ball.pos = { x: L - 8.5, y: R, z: 0 };
    s.ball.owner = 4;
    let shot = false;
    for (let t = 0; t < 90 && !shot; t++) {
      stepMatch(s, [], p, (m) => aiIntents(m, p));
      shot = s.ball.owner < 0 && s.ball.vel.x > 15;
    }
    expect(shot).toBe(true);
  });

  it("close down a human on the ball, from the goal side", () => {
    const p = paramsFor("normal");
    const s = createMatch({ seed: 1, pitch: PITCH_5_A_SIDE, teamSize: 5 });
    // The human (player 4) has the ball in midfield; CPU defenders start 8 m away.
    s.players[4].pos = { x: 0, z: 0 };
    s.ball.pos = { x: 0.5, y: R, z: 0 };
    s.ball.owner = 4;
    const gap = () =>
      Math.min(...s.players.filter((o) => o.team === 1).map((o) => Math.hypot(o.pos.x, o.pos.z)));
    const before = gap();
    for (let t = 0; t < 60; t++) stepMatch(s, [{ ...IDLE }], p, (m) => aiIntents(m, p));
    expect(gap()).toBeLessThan(Math.min(before, 2.5));
  });

  it("are harder to beat on Hard than on Easy", () => {
    const easy = shootout("easy", 60);
    const normal = shootout("normal", 60);
    const hard = shootout("hard", 60);
    expect(easy).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(hard);
  });

  it("difficulty changes only reactions, accuracy and decisions, never speed", () => {
    for (const d of ["easy", "hard"] as const) {
      const p = paramsFor(d);
      expect(p.player).toEqual(DEFAULT_PARAMS.player);
      expect(p.ai).not.toEqual(DEFAULT_PARAMS.ai);
    }
    expect(paramsFor("normal")).toEqual(DEFAULT_PARAMS);
  });
});

describe("goalkeepers (docs/specs/11 §4)", () => {
  /** Keeper 5 alone in the goal at +x; a shot from `from` with velocity `vel`. */
  function shotAt(from: { x: number; y: number; z: number }, vel: { x: number; y: number; z: number }) {
    const s = createMatch({ seed: 1, pitch: PITCH_5_A_SIDE, teamSize: 5, humans: [] });
    s.players.forEach((pl, i) => {
      if (i !== 5) pl.pos = { x: -L + 1 + i, z: W + 1 };
    });
    s.players[5].pos = { x: L - 1, z: 0 };
    s.players[5].facing = { x: -1, z: 0 };
    s.ball.pos = { ...from };
    kickBall(s, 4, vel);
    return s;
  }
  const idle = (s: MatchState, ticks: number) => {
    for (let t = 0; t < ticks; t++) stepMatch(s, [], DEFAULT_PARAMS);
  };

  it("catch a soft shot straight at them", () => {
    const s = shotAt({ x: L - 8, y: 0.6, z: 0 }, { x: 12, y: 0.5, z: 0 });
    idle(s, 50);
    expect(s.ball.owner).toBe(5);
  });

  it("parry a hard shot wide, never back towards the goal", () => {
    const s = shotAt({ x: L - 8, y: 0.6, z: 0.2 }, { x: 28, y: 0.3, z: 0 });
    let touched = false;
    for (let t = 0; t < 60; t++) {
      idle(s, 1);
      if (!touched && s.ball.lastTouch === 5) {
        touched = true;
        expect(s.ball.owner).toBe(-1);
        expect(s.ball.vel.x).toBeLessThan(0); // away from the goal
        expect(Math.abs(s.ball.vel.z)).toBeGreaterThan(2); // and wide
      }
    }
    expect(touched).toBe(true);
    expect(isInGoal(s.ball, s.pitch, R)).toBe(0);
  });

  it("tip a high, hard shot over the bar", () => {
    const s = shotAt({ x: L - 4, y: 1.8, z: 0.3 }, { x: 26, y: 0.4, z: 0 });
    let tipped = false;
    for (let t = 0; t < 60; t++) {
      idle(s, 1);
      if (!tipped && s.ball.lastTouch === 5) {
        tipped = true;
        expect(s.ball.vel.y).toBeGreaterThan(3);
      }
    }
    expect(tipped).toBe(true);
    expect(isInGoal(s.ball, s.pitch, R)).toBe(0);
  });

  it("can't be tackled while holding the ball in their area", () => {
    const s = createMatch({ seed: 1, pitch: PITCH_5_A_SIDE, teamSize: 5 });
    const gk = 5;
    s.players[gk].pos = { x: L - 1.5, z: 0 };
    s.players[gk].facing = { x: -1, z: 0 };
    s.ball.pos = { x: L - 1.9, y: R, z: 0 };
    s.ball.owner = gk;
    s.ball.ownedSince = 0;
    s.players[4].pos = { x: L - 2.6, z: 0 };
    s.players[4].facing = { x: 1, z: 0 };
    s.controllers[0].player = 4;
    s.controllers[0].assists.autoSwitch = false;
    const p = cloneParams(DEFAULT_PARAMS);
    p.action.tackleSuccess = 1;
    for (let t = 0; t < 5; t++) stepMatch(s, [{ ...IDLE, shoot: t === 0 }], p);
    expect(s.ball.owner).toBe(gk);
  });
});

describe("auto-sprint assist (docs/specs/11 §3)", () => {
  function run(autoSprint: boolean, blocker: boolean): number {
    const s = createMatch({ seed: 1, pitch: PITCH_5_A_SIDE, teamSize: 5 });
    s.players.forEach((pl, i) => {
      if (i !== 4) pl.pos = { x: -L + 1 + i, z: W + 1 };
    });
    s.players[4].pos = { x: -5, z: 0 };
    if (blocker) s.players[9].pos = { x: -2, z: 0 };
    s.controllers[0].player = 4;
    s.controllers[0].assists.autoSprint = autoSprint;
    const forward: Intent = { ...IDLE, moveX: 1 };
    for (let t = 0; t < 30; t++) stepMatch(s, [forward], DEFAULT_PARAMS);
    return s.players[4].stamina;
  }

  it("sprints when running hard into open ground", () => {
    expect(run(true, false)).toBeLessThan(run(false, false));
  });

  it("doesn't sprint into an opponent", () => {
    expect(run(true, true)).toBe(run(false, true));
  });

  it("is on by default on Easy only", () => {
    expect(DIFFICULTY.easy.assists.autoSprint).toBe(true);
    expect(DIFFICULTY.normal.assists.autoSprint).toBe(false);
    expect(DIFFICULTY.hard.assists.autoSprint).toBe(false);
  });
});

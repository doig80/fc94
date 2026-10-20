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
  shootoutWinner,
  startRestart,
  stepMatch,
  type Rules,
  type Intent,
  type MatchState,
  type Phase,
  type SimParams,
} from "../src/sim";

const L = PITCH_5_A_SIDE.length / 2;
const W = PITCH_5_A_SIDE.width / 2;
const R = DEFAULT_PARAMS.ball.radius;
const HALF = 600;

/** A refereed match; the human (controller 0) plays for team 0. `more` switches on further rules. */
function match(fouls = true, halfTicks = HALF, more: Partial<Rules> = {}): MatchState {
  return createMatch({ seed: 3, pitch: PITCH_5_A_SIDE, teamSize: 5, rules: { halfTicks, fouls, ...more } });
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

  const READY = DEFAULT_PARAMS.referee.kickoffReadyTicks;

  it("a pass after the referee's whistle starts play", () => {
    const s = match();
    run(s, READY);
    expect(s.lastEvent).toMatchObject({ kind: "kickoff", team: 0, tick: READY });
    run(s, 2, intent({ pass: true, moveZ: 1 }));
    expect(s.phase.kind).toBe("play");
    expect(s.ball.owner).toBe(-1);
  });

  it("nobody can kick off before the whistle, so the camera is back at the centre", () => {
    const s = match();
    run(s, 2, intent({ pass: true }));
    run(s, 10);
    run(s, 2, intent({ shoot: true }));
    run(s, 2, intent({ lob: true }));
    expect(s.phase.kind).toBe("restart");
    expect(s.ball.owner).toBe(4);
    expect(s.lastEvent?.kind).not.toBe("kickoff");
  });

  it("a button held through the wait doesn't count: it has to be pressed again", () => {
    const s = match();
    // Held from before the kick-off was set up (say, from skipping the goal replay) until after the whistle.
    run(s, READY + 30, intent({ pass: true }));
    expect(s.phase.kind).toBe("restart");
    run(s, 1);
    run(s, 2, intent({ pass: true }));
    expect(s.phase.kind).toBe("play");
  });

  it("the computer waits for the whistle too", () => {
    const s = match();
    s.controllers = [];
    const cpu = (m: MatchState) => aiIntents(m, DEFAULT_PARAMS);
    let taken = -1;
    for (let t = 0; t < 300 && taken < 0; t++) {
      stepMatch(s, [], DEFAULT_PARAMS, cpu);
      if (s.phase.kind === "play") taken = s.tick;
    }
    expect(taken).toBeGreaterThan(READY);
    expect(taken).toBeLessThan(READY + 45);
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
    s.foul = { by: 6, victim: 4, spot: { x: L - 10, z: 0 }, slide: false, fromBehind: false };
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

describe("offside (docs/specs/10 §6)", () => {
  /**
   * Team 0's player 4 on the ball at halfway, teammate 3 up front at `receiverX`; team 1 holds a line at
   * x = L − 8 with the keeper behind it.
   */
  function attack(receiverX: number, offside = true): MatchState {
    const s = match(true, HALF, { offside });
    inPlay(s);
    const spots = [
      [-L + 1, 0],
      [-6, -4],
      [-6, 4],
      [receiverX, 0],
      [0, 0],
      [L - 1, 0],
      [L - 8, -5],
      [L - 8, 5],
      [-2, -8],
      [-2, 8],
    ];
    s.players.forEach((p, i) => {
      p.pos = { x: spots[i][0], z: spots[i][1] };
      p.facing = { x: 1, z: 0 };
    });
    s.ball.pos = { x: 0.5, y: R, z: 0 };
    s.ball.owner = 4;
    s.ball.lastTouch = 4;
    s.controllers[0].player = 4;
    return s;
  }

  /** Pass towards +x and play on until the ball reaches someone or the referee stops play. */
  function passForward(s: MatchState): void {
    run(s, 1, intent({ pass: true, moveX: 1 }));
    for (let t = 0; t < 150 && s.phase.kind === "play" && s.ball.owner !== 3; t++) run(s, 1);
  }

  it("a pass to a teammate beyond the defenders: free kick to them where he was, and the line shows where", () => {
    const s = attack(L - 5);
    passForward(s);
    const phase = (s as { phase: Phase }).phase;
    expect(phase.kind).toBe("restart");
    if (phase.kind !== "restart") return;
    expect(phase.restart).toMatchObject({ kind: "freekick", team: 1 });
    expect(dist(phase.restart.spot, { x: L - 5, z: 0 })).toBeLessThan(1);
    expect(s.lastEvent?.kind).toBe("offside");
    expect(s.lastEvent?.line).toBeCloseTo(L - 8, 0);
  });

  it("level with the second-last defender is onside", () => {
    const s = attack(L - 8);
    passForward(s);
    expect(s.phase.kind).toBe("play");
    expect(s.ball.owner).toBe(3);
  });

  it("nobody is offside in their own half", () => {
    const s = attack(-1);
    // The defenders push up into team 0's half; the passer is behind them.
    for (const i of [6, 7, 8, 9]) s.players[i].pos.x = -5;
    s.players[4].pos = { x: -10, z: 0 };
    s.ball.pos = { x: -9.5, y: R, z: 0 };
    passForward(s);
    expect(s.phase.kind).toBe("play");
    expect(s.ball.owner).toBe(3);
  });

  it("not from a kick-in", () => {
    const s = attack(L - 5);
    startRestart(s, "kickin", 0, { x: L - 10, z: W - 0.1 }, 4);
    run(s, 1, intent({ pass: true, moveX: 1, moveZ: -0.5 }));
    for (let t = 0; t < 150 && s.ball.owner !== 3 && s.phase.kind !== "restart"; t++) run(s, 1);
    expect(s.lastEvent?.kind).not.toBe("offside");
  });

  it("a restart wipes the slate: the free kick's taker isn't offside from the pass before it", () => {
    const s = attack(L - 5);
    run(s, 1, intent({ pass: true, moveX: 1 }));
    expect(s.offside?.players).toEqual([3]);
    // A foul stops play before the pass arrives; player 3 takes the free kick and plays on.
    s.foul = { by: 9, victim: 4, spot: { x: 2, z: 0 }, slide: false, fromBehind: false };
    s.ball.owner = -1;
    run(s, 1);
    startRestart(s, "freekick", 0, { x: L - 6, z: 0 }, 3);
    s.controllers[0].player = 3;
    run(s, 1, intent({ pass: true, moveX: -1 }));
    run(s, 30);
    expect(s.lastEvent?.kind).not.toBe("offside");
  });

  it("isn't called when offside is off (Easy, or no referee)", () => {
    const s = attack(L - 5, false);
    passForward(s);
    expect(s.phase.kind).toBe("play");
    expect(s.ball.owner).toBe(3);
  });
});

describe("cards (docs/specs/10 §6)", () => {
  const foul = (by: number, victim: number, x: number, more: { slide: boolean; fromBehind: boolean }) => ({
    by,
    victim,
    spot: { x, z: 0 },
    ...more,
  });

  it("a slide from behind is a yellow; a second yellow is a red, and the player leaves the pitch", () => {
    const s = match(true, HALF, { cards: true });
    inPlay(s);
    s.foul = foul(6, 4, 0, { slide: true, fromBehind: true });
    run(s, 1);
    expect(s.lastEvent?.card).toEqual({ player: 6, red: false });
    expect(s.players[6].yellows).toBe(1);
    s.phase = { kind: "play" };
    s.foul = foul(6, 4, 0, { slide: true, fromBehind: true });
    run(s, 1);
    expect(s.lastEvent?.card).toEqual({ player: 6, red: true });
    expect(s.players[6].sentOff).toBe(true);
    expect(Math.abs(s.players[6].pos.z)).toBeGreaterThan(W);
    // Out of the game: the CPU leaves them be and they never touch the ball again.
    const p = cloneParams(DEFAULT_PARAMS);
    const at = { ...s.players[6].pos };
    for (let t = 0; t < 600; t++) {
      stepMatch(s, [intent()], p, (m) => aiIntents(m, p));
      expect(s.ball.lastTouch).not.toBe(6);
    }
    expect(s.players[6].pos).toEqual(at);
  });

  /** Team 0's player 4 through on goal at x, ball at their feet; team 1's player 6 alongside, the rest behind. */
  function through(x: number): MatchState {
    const s = match(true, HALF, { cards: true });
    inPlay(s);
    for (const i of [7, 8, 9]) s.players[i].pos = { x: 0, z: (i - 8) * 4 };
    s.players[5].pos = { x: L - 1, z: 0 };
    s.players[4].pos = { x, z: 0 };
    s.players[6].pos = { x, z: 1 };
    // Knocked off their feet: the ball runs on a little, out of their control (so no advantage).
    s.ball.pos = { x: x + 1.5, y: R, z: 0 };
    s.foul = foul(6, 4, x, { slide: false, fromBehind: false });
    return s;
  }

  it("stopping a player through on goal is a red card", () => {
    const s = through(L - 10);
    run(s, 1);
    expect(s.phase.kind).toBe("restart");
    expect(s.lastEvent).toMatchObject({ kind: "freekick", card: { player: 6, red: true } });
    expect(s.players[6].sentOff).toBe(true);
  });

  it("...but a yellow when it gives away a penalty", () => {
    const s = through(L - 4);
    run(s, 1);
    expect(s.lastEvent).toMatchObject({ kind: "penalty", card: { player: 6, red: false } });
  });

  it("an ordinary mistimed tackle is no card, and with cards off there are none", () => {
    const s = match(true, HALF, { cards: true });
    inPlay(s);
    s.foul = foul(6, 4, 0, { slide: false, fromBehind: false });
    run(s, 1);
    expect(s.lastEvent?.card).toBeUndefined();
    const off = through(L - 10);
    off.rules!.cards = false;
    run(off, 1);
    expect(off.lastEvent?.card).toBeUndefined();
    expect(off.players[6].sentOff).toBe(false);
  });
});

describe("must have a winner: extra time, then a penalty shoot-out", () => {
  it("best of five kicks, then sudden death", () => {
    const so = (a: boolean[], b: boolean[]) =>
      shootoutWinner({ kicks: [a, b], next: 0, taker: -1, struck: -1 });
    const T = true;
    const F = false;
    expect(so([T, T, T], [F, F, F])).toBe(0);
    expect(so([T, T, T], [F, F])).toBeNull();
    expect(so([T, T, T, T, T], [T, T, T, T, T])).toBeNull();
    expect(so([T, T, T, T, T, F], [T, T, T, T, T])).toBeNull();
    expect(so([T, T, T, T, T, F], [T, T, T, T, T, T])).toBe(1);
  });

  it("a draw goes to two short halves of extra time, then the CPU plays a shoot-out to a winner", () => {
    const p = cloneParams(DEFAULT_PARAMS);
    const s = createMatch({
      seed: 3,
      pitch: PITCH_5_A_SIDE,
      teamSize: 5,
      humans: [],
      rules: { halfTicks: 60, fouls: true, winner: true },
    });
    // Nobody plays, so it stays 0–0.
    const calls = new Set<string>();
    let extraTime = 0;
    for (let t = 0; t < 5000 && !s.shootout; t++) {
      stepMatch(s, [], p);
      if (s.lastEvent) calls.add(s.lastEvent.kind);
      if (s.half === 3 && s.phase.kind !== "halftime") {
        extraTime++;
        expect(matchMinute(s)).toBeGreaterThanOrEqual(90);
      }
    }
    expect(calls).toContain("extratime");
    expect(extraTime).toBeGreaterThan(0);
    expect(s.shootout).not.toBeNull();
    expect(matchMinute(s)).toBe(120);
    // Both teams shoot at the goal at +x; only the taker and the keeper move.
    for (let t = 0; t < 20000 && s.phase.kind !== "fulltime"; t++) {
      const before = s.players.map((pl) => ({ ...pl.pos }));
      const lined = s.phase.kind === "restart" || s.phase.kind === "play";
      stepMatch(s, [], p, (m) => aiIntents(m, p));
      const so = s.shootout!;
      if (lined && (s.phase.kind === "restart" || s.phase.kind === "play")) {
        expect(attackSign(s, so.next)).toBe(1);
        s.players.forEach((pl, i) => {
          if (i !== so.taker && pl.role !== "gk") expect(pl.pos).toEqual(before[i]);
        });
      }
    }
    expect(s.phase.kind).toBe("fulltime");
    expect(shootoutWinner(s.shootout!)).not.toBeNull();
    expect(s.score).toEqual([0, 0]);
  });

  it("a human takes their own team's kicks", () => {
    const s = match(true, 30, { winner: true });
    for (let t = 0; t < 5000 && !(s.shootout && s.phase.kind === "restart"); t++) run(s, 1);
    expect(s.phase.kind).toBe("restart");
    expect(s.shootout?.next).toBe(0);
    expect(s.controllers[0].player).toBe(s.shootout?.taker);
  });
});

describe("corner aiming (M7)", () => {
  /** A corner for team 0 at the goal they attack (+x), the human on the ball. */
  function corner(): MatchState {
    const s = match();
    inPlay(s);
    s.players[3].pos = { x: L - 6, z: 2 };
    startRestart(s, "corner", 0, { x: L - 0.3, z: W - 0.3 }, 4);
    return s;
  }

  it("the marker starts on the penalty spot and the stick moves it around the box, never out of it", () => {
    const s = corner();
    const aim = () => (s.phase.kind === "restart" ? s.phase.restart.aim! : { x: NaN, z: NaN });
    expect(aim()).toEqual({ x: L - PITCH_5_A_SIDE.penaltySpot, z: 0 });
    run(s, 20, intent({ moveZ: 1 }));
    expect(aim().z).toBeGreaterThan(1);
    run(s, 60, intent({ moveX: -1 }));
    expect(aim().x).toBeCloseTo(L - PITCH_5_A_SIDE.penaltyAreaDepth, 1);
    expect(s.phase.kind).toBe("restart");
  });

  it("the cross goes to the marker, for the teammate nearest it", () => {
    const s = corner();
    if (s.phase.kind !== "restart") return;
    s.phase.restart.aim = { x: L - 5, z: -2 };
    run(s, 1, intent({ lob: true }));
    expect(s.ball.intendedReceiver).toBe(3);
    let landed: { x: number; z: number } | null = null;
    for (let t = 0; t < 120 && !landed; t++) {
      const high = s.ball.pos.y > 0.3;
      run(s, 1);
      if (high && s.ball.pos.y <= 0.3 && s.ball.vel.y < 0) landed = { x: s.ball.pos.x, z: s.ball.pos.z };
    }
    expect(landed).not.toBeNull();
    expect(dist(landed!, { x: L - 5, z: -2 })).toBeLessThan(2.5);
  });

  it("the CPU picks a target in the box for its corners", () => {
    const p = cloneParams(DEFAULT_PARAMS);
    const s = match();
    inPlay(s);
    // Team 1 attacks −x in the first half.
    startRestart(s, "corner", 1, { x: -L + 0.3, z: W - 0.3 }, 9);
    let aimed: { x: number; z: number } | null = null;
    for (let t = 0; t < 200 && s.phase.kind === "restart"; t++) {
      stepMatch(s, [intent()], p, (m) => aiIntents(m, p));
      if (s.phase.kind === "restart" && s.phase.restart.aim) aimed = { ...s.phase.restart.aim };
    }
    expect(aimed).not.toBeNull();
    expect(aimed!.x).toBeLessThan(-L + PITCH_5_A_SIDE.penaltyAreaDepth);
    expect(Math.abs(aimed!.z)).toBeLessThan(PITCH_5_A_SIDE.penaltyAreaWidth / 2);
    expect(s.phase.kind).toBe("play");
  });
});

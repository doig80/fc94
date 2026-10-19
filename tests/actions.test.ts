import { describe, expect, it } from "vitest";
import {
  cloneParams,
  createMatch,
  DEFAULT_PARAMS,
  groundPassSpeed,
  IDLE,
  isInGoal,
  PITCH_5_A_SIDE,
  Rng,
  stepMatch,
  type Intent,
  type MatchState,
  type SimParams,
} from "../src/sim";

const L = PITCH_5_A_SIDE.length / 2;
const W = PITCH_5_A_SIDE.width / 2;

/** A match with everyone parked by the touchlines, so each test places only the players it needs. */
function setup(weather: MatchState["weather"] = "clear"): MatchState {
  const s = createMatch({ seed: 5, pitch: PITCH_5_A_SIDE, teamSize: 5, weather });
  s.players.forEach((p, i) => {
    p.pos = { x: -L + 2 + i * 3.5, z: p.team === 0 ? W + 1.5 : -W - 1.5 };
  });
  s.ball.pos = { x: 0, y: DEFAULT_PARAMS.ball.radius, z: 0 };
  return s;
}

/** Put player `i` on the ball at (x, z), facing `fx, fz`, controlled by the human. */
function onBall(s: MatchState, i: number, x: number, z: number, fx = 1, fz = 0): void {
  s.players[i].pos = { x, z };
  s.players[i].facing = { x: fx, z: fz };
  s.ball.pos = { x: x + 0.5 * fx, y: DEFAULT_PARAMS.ball.radius, z: z + 0.5 * fz };
  s.ball.owner = i;
  s.ball.lastTouch = i;
  s.controllers[0].player = i;
}

function intent(partial: Partial<Intent> = {}): Intent {
  return { ...IDLE, ...partial };
}

function run(s: MatchState, ticks: number, i: Intent = intent(), p: SimParams = DEFAULT_PARAMS): void {
  for (let t = 0; t < ticks; t++) stepMatch(s, [i], p);
}

/** Hold the buttons in `i` for `ticks`, then release them for one tick. */
function tap(s: MatchState, i: Intent, ticks = 1, p: SimParams = DEFAULT_PARAMS): void {
  run(s, ticks, i, p);
  run(s, 1, intent({ moveX: i.moveX, moveZ: i.moveZ }), p);
}

describe("passing", () => {
  for (const weather of ["clear", "rain", "snow"] as const) {
    it(`a ground pass reaches the teammate in ${weather}`, () => {
      const s = setup(weather);
      onBall(s, 4, -6, 0);
      s.players[3].pos = { x: 6, z: 0 };
      tap(s, intent({ pass: true, moveX: 1 }));
      let received = false;
      for (let t = 0; t < 240 && !received; t++) {
        run(s, 1);
        received = s.ball.owner === 3;
      }
      expect(received).toBe(true);
    });
  }

  it("picks the teammate in the direction of the stick", () => {
    const s = setup();
    onBall(s, 4, 0, 0);
    s.players[2].pos = { x: 6, z: -6 };
    s.players[3].pos = { x: 6, z: 6 };
    tap(s, intent({ pass: true, moveX: 1, moveZ: 1 }));
    expect(s.ball.intendedReceiver).toBe(3);
    expect(s.ball.vel.z).toBeGreaterThan(0);
  });

  it("leads a running teammate (pass-lead assist)", () => {
    const angle = (lead: boolean) => {
      const s = setup();
      s.controllers[0].assists.passLead = lead;
      onBall(s, 4, -6, 0);
      s.players[3].pos = { x: 6, z: 0 };
      s.players[3].vel = { x: 0, z: 6 };
      tap(s, intent({ pass: true, moveX: 1 }));
      return s.ball.vel.z / s.ball.vel.x;
    };
    expect(angle(false)).toBeCloseTo(0, 5);
    expect(angle(true)).toBeGreaterThan(0.3);
  });

  it("meets the pass feel targets (docs/specs/10 §8: short ≤ 1 s, long ≤ 2 s)", () => {
    const travelTime = (d: number) => {
      const s = setup();
      s.ball.pos = { x: -18, y: DEFAULT_PARAMS.ball.radius, z: 0 };
      s.ball.owner = -1;
      const v = groundPassSpeed(d, s, DEFAULT_PARAMS);
      s.ball.vel = { x: v, y: 0, z: 0 };
      let t = 0;
      while (s.ball.pos.x < -18 + d && t < 600) {
        run(s, 1);
        t++;
      }
      return t / 60;
    };
    expect(travelTime(10)).toBeLessThanOrEqual(1);
    expect(travelTime(20)).toBeLessThanOrEqual(2);
  });

  it("hits the pass hard enough for the distance and the weather", () => {
    const s = setup();
    const p = DEFAULT_PARAMS;
    const near = groundPassSpeed(6, s, p);
    const far = groundPassSpeed(20, s, p);
    expect(far).toBeGreaterThan(near);
    s.weather = "snow";
    expect(groundPassSpeed(20, s, p)).toBeGreaterThan(far);
  });

  it("a back pass to the keeper does not hand the human the keeper", () => {
    const s = setup();
    onBall(s, 4, -6, 0, -1, 0);
    s.players[0].pos = { x: -16, z: 0 };
    tap(s, intent({ pass: true, moveX: -1 }));
    expect(s.ball.intendedReceiver).toBe(0);
    run(s, 120);
    expect(s.controllers[0].player).not.toBe(0);
  });

  it("follows the pass with control (auto-switch)", () => {
    const s = setup();
    onBall(s, 4, -6, 0);
    s.players[3].pos = { x: 6, z: 0 };
    tap(s, intent({ pass: true, moveX: 1 }));
    run(s, 1);
    expect(s.controllers[0].player).toBe(3);
  });
});

describe("shooting", () => {
  function shotFrom(x: number, holdTicks: number, move: Partial<Intent> = {}): MatchState {
    const s = setup();
    onBall(s, 4, x, 0);
    tap(s, intent({ shoot: true, ...move }), holdTicks);
    return s;
  }

  it("scores into an empty goal", () => {
    const s = shotFrom(L - 10, 30);
    run(s, 90);
    expect(isInGoal(s.ball, s.pitch, DEFAULT_PARAMS.ball.radius)).toBe(1);
  });

  it("holding longer shoots harder", () => {
    const soft = shotFrom(0, 3);
    const hard = shotFrom(0, 45);
    expect(Math.hypot(hard.ball.vel.x, hard.ball.vel.z)).toBeGreaterThan(
      Math.hypot(soft.ball.vel.x, soft.ball.vel.z) + 8,
    );
  });

  const heightAtGoalLine = (s: MatchState) => {
    let height = -1;
    for (let t = 0; t < 120 && height < 0; t++) {
      run(s, 1);
      if (s.ball.pos.x >= L) height = s.ball.pos.y;
    }
    return height;
  };

  it("an overpowered shot from 8 m or further flies over the bar", () => {
    expect(heightAtGoalLine(shotFrom(L - 8, 60))).toBeGreaterThan(PITCH_5_A_SIDE.goalHeight);
    expect(heightAtGoalLine(shotFrom(L - 16, 60))).toBeGreaterThan(PITCH_5_A_SIDE.goalHeight);
  });

  it("a hard shot just short of overpower rises but stays under the bar from 12 m", () => {
    const ticks = Math.floor(DEFAULT_PARAMS.action.shotChargeTicks * 0.85);
    const h = heightAtGoalLine(shotFrom(L - 12, ticks));
    expect(h).toBeGreaterThan(0.3);
    expect(h).toBeLessThan(PITCH_5_A_SIDE.goalHeight);
  });

  it("steering at the moment of the shot curls it the opposite ways", () => {
    const left = shotFrom(L - 12, 20, { moveX: 1, moveZ: -1 });
    const right = shotFrom(L - 12, 20, { moveX: 1, moveZ: 1 });
    expect(Math.sign(left.ball.spin.y)).toBe(-Math.sign(right.ball.spin.y));
    run(left, 25);
    run(right, 25);
    expect(left.ball.pos.z).toBeLessThan(right.ball.pos.z);
  });

  it("heads a high ball towards goal", () => {
    const s = setup();
    s.controllers[0].player = 4;
    s.players[4].pos = { x: L - 6, z: 0 };
    s.ball.pos = { x: L - 5.4, y: 1.8, z: 0 };
    s.ball.vel = { x: 0, y: 0, z: 0 };
    s.ball.owner = -1;
    tap(s, intent({ shoot: true }));
    expect(s.players[4].action.kind).toBe("header");
    expect(s.ball.vel.x).toBeGreaterThan(5);
  });

  it("does a bicycle kick when facing away from goal", () => {
    const s = setup();
    s.controllers[0].player = 4;
    s.players[4].pos = { x: L - 6, z: 0 };
    s.players[4].facing = { x: -1, z: 0 };
    s.ball.pos = { x: L - 6.5, y: 1.0, z: 0 };
    s.ball.vel = { x: 0, y: 0, z: 0 };
    s.ball.owner = -1;
    tap(s, intent({ shoot: true }));
    expect(s.players[4].action.kind).toBe("bicycle");
    expect(s.ball.vel.x).toBeGreaterThan(5);
  });
});

describe("lob, cross and first-time balls", () => {
  it("lobs the ball into the air", () => {
    const s = setup();
    onBall(s, 4, -8, 0);
    tap(s, intent({ lob: true, moveX: 1 }));
    let top = 0;
    for (let t = 0; t < 60; t++) {
      run(s, 1);
      top = Math.max(top, s.ball.pos.y);
    }
    expect(top).toBeGreaterThan(2.5);
  });

  it("crosses from a wide attacking position into the box", () => {
    const s = setup();
    onBall(s, 4, L - 5, W - 2);
    tap(s, intent({ lob: true }));
    let landed: { x: number; z: number } | null = null;
    for (let t = 0; t < 120 && !landed; t++) {
      const wasHigh = s.ball.pos.y > 0.5;
      run(s, 1);
      if (wasHigh && s.ball.pos.y <= 0.5) landed = { x: s.ball.pos.x, z: s.ball.pos.z };
    }
    expect(landed).not.toBeNull();
    expect(Math.abs(landed!.z)).toBeLessThan(5);
    expect(landed!.x).toBeGreaterThan(L - 9);
  });

  it("plays a first-time pass when pass is pressed just before the ball arrives", () => {
    const s = setup();
    onBall(s, 4, -6, 0);
    s.players[3].pos = { x: 4, z: 0 };
    s.players[2].pos = { x: 4, z: 8 };
    tap(s, intent({ pass: true, moveX: 1 }));
    // Wait until the ball is about to arrive at player 3 (now controlled), then press pass towards player 2.
    while (Math.abs(s.ball.pos.x - s.players[3].pos.x) > 1.5) run(s, 1);
    expect(s.controllers[0].player).toBe(3);
    run(s, 1, intent({ pass: true, moveZ: 1 }));
    let firstTime = false;
    for (let t = 0; t < 30 && !firstTime; t++) {
      run(s, 1);
      firstTime = s.ball.lastTouch === 3 && s.ball.owner === -1 && s.ball.intendedReceiver === 2;
    }
    expect(firstTime).toBe(true);
  });

  it("plays a one-two when pass is pressed twice", () => {
    const s = setup();
    onBall(s, 4, -6, 0);
    s.players[3].pos = { x: 2, z: 4 };
    tap(s, intent({ pass: true, moveX: 1, moveZ: 0.6 }));
    run(s, 3);
    tap(s, intent({ pass: true }));
    expect(s.oneTwo).not.toBeNull();
    let returned = false;
    for (let t = 0; t < 240 && !returned; t++) {
      run(s, 1);
      returned = s.ball.owner === 4 || s.ball.intendedReceiver === 4;
    }
    expect(returned).toBe(true);
  });
});

describe("defending", () => {
  function duel(success: number): { s: MatchState; p: SimParams } {
    const p = cloneParams(DEFAULT_PARAMS);
    p.action.tackleSuccess = success;
    const s = setup();
    // Opponent 9 dribbles towards our player 1.
    s.players[9].pos = { x: 1, z: 0 };
    s.players[9].facing = { x: -1, z: 0 };
    s.ball.pos = { x: 0.5, y: DEFAULT_PARAMS.ball.radius, z: 0 };
    s.ball.owner = 9;
    s.players[1].pos = { x: -0.3, z: 0 };
    s.players[1].facing = { x: 1, z: 0 };
    s.controllers[0].player = 1;
    s.controllers[0].assists.autoSwitch = false;
    return { s, p };
  }

  it("a successful standing tackle wins the ball and unbalances the dribbler", () => {
    const { s, p } = duel(1);
    tap(s, intent({ shoot: true }), 1, p);
    expect(s.ball.owner).not.toBe(9);
    expect(s.ball.lastTouch === 1 || s.ball.owner === 1).toBe(true);
    expect(s.players[9].action.kind).toBe("stumble");
  });

  it("a failed standing tackle costs the tackler their balance", () => {
    const { s, p } = duel(0);
    tap(s, intent({ shoot: true }), 1, p);
    expect(s.ball.owner).toBe(9);
    expect(s.players[1].action.kind).toBe("stumble");
  });

  it("a slide tackle knocks the ball away, then the slider gets up", () => {
    const { s, p } = duel(1);
    s.players[1].pos = { x: -1.5, z: 0 };
    tap(s, intent({ lob: true, moveX: 1 }), 1, p);
    expect(s.players[1].action.kind).toBe("slide");
    let knocked = false;
    for (let t = 0; t < 30 && !knocked; t++) {
      run(s, 1, intent(), p);
      knocked = s.ball.lastTouch === 1 && s.ball.owner !== 9;
    }
    expect(knocked).toBe(true);
    run(s, p.action.slideTicks, intent(), p);
    expect(s.players[1].action.kind).toBe("recover");
    run(s, p.action.slideRecoveryTicks, intent(), p);
    expect(s.players[1].action.kind).toBe("none");
  });

  it("pass while defending switches to the teammate nearest the ball (never the keeper)", () => {
    const s = setup();
    s.players[9].pos = { x: 0, z: 0 };
    s.ball.owner = 9;
    s.ball.pos = { x: 0.5, y: DEFAULT_PARAMS.ball.radius, z: 0 };
    s.players[0].pos = { x: 1, z: 1 }; // our keeper, closest of all
    s.players[2].pos = { x: 3, z: 0 };
    s.players[4].pos = { x: -10, z: 0 };
    s.controllers[0].player = 4;
    s.controllers[0].assists.autoSwitch = false;
    tap(s, intent({ pass: true }));
    expect(s.controllers[0].player).toBe(2);
  });
});

describe("aftertouch (docs/specs/10 §3)", () => {
  /** A shot from 14 m straight at goal, then `after` held on the stick for `ticks`. */
  function shotThen(after: Partial<Intent>, p: SimParams = DEFAULT_PARAMS, ticks = 30): MatchState {
    const s = setup();
    onBall(s, 4, L - 14, 0);
    s.controllers[0].assists.aimHelp = false;
    tap(s, intent({ shoot: true }), 20, p);
    run(s, ticks, intent(after), p);
    return s;
  }

  it("steering sideways after the shot bends it", () => {
    const left = shotThen({ moveZ: -1 });
    const straight = shotThen({});
    const right = shotThen({ moveZ: 1 });
    expect(left.ball.pos.z).toBeLessThan(straight.ball.pos.z - 0.3);
    expect(right.ball.pos.z).toBeGreaterThan(straight.ball.pos.z + 0.3);
  });

  it("pulling back lifts the ball, pushing on keeps it down", () => {
    /** Highest point of the shot while `after` is held. */
    const peak = (after: Partial<Intent>) => {
      const s = shotThen({}, DEFAULT_PARAMS, 0);
      let top = 0;
      for (let t = 0; t < 30; t++) {
        run(s, 1, intent(after));
        top = Math.max(top, s.ball.pos.y);
      }
      return top;
    };
    const straight = peak({});
    expect(peak({ moveX: -1 })).toBeGreaterThan(straight + 0.3);
    expect(peak({ moveX: 1 })).toBeLessThan(straight - 0.1);
  });

  it("leaves the shot alone if you keep running at goal", () => {
    const shot = (after: Partial<Intent>) => {
      const s = setup();
      onBall(s, 4, L - 14, 0);
      s.controllers[0].assists.aimHelp = false;
      tap(s, intent({ shoot: true, moveX: 1 }), 20);
      run(s, 30, intent(after));
      return s.ball.pos;
    };
    expect(shot({ moveX: 1 })).toEqual(shot({}));
  });

  it("is for shots only: steering the receiver doesn't bend a pass", () => {
    const passThen = (after: Partial<Intent>) => {
      const s = setup();
      onBall(s, 4, 0, 0);
      s.players[3].pos = { x: 12, z: 0 };
      tap(s, intent({ pass: true, moveX: 1 }));
      run(s, 15, intent(after));
      return s.ball.pos;
    };
    expect(passThen({ moveZ: 1 })).toEqual(passThen({ moveZ: -1 }));
  });

  it("does nothing when switched off", () => {
    const p = cloneParams(DEFAULT_PARAMS);
    p.action.aftertouch = 0;
    expect(shotThen({ moveZ: -1 }, p).ball.pos).toEqual(shotThen({ moveZ: 1 }, p).ball.pos);
  });

  it("only lasts a moment after the kick", () => {
    const late = (after: Partial<Intent>) => {
      const s = shotThen({}, DEFAULT_PARAMS, DEFAULT_PARAMS.action.aftertouchTicks + 1);
      run(s, 10, intent(after));
      return s.ball.pos;
    };
    expect(late({ moveZ: -1 })).toEqual(late({ moveZ: 1 }));
  });
});

describe("looser dribbling (docs/specs/10 §5)", () => {
  /** Dribble player 4 forward for 1.5 s; returns the biggest gap to the ball and who has it at the end. */
  function dribble(looseness: number): { maxGap: number; owner: number } {
    const p = cloneParams(DEFAULT_PARAMS);
    p.dribble.looseness = looseness;
    const s = setup();
    onBall(s, 4, -10, 0);
    let maxGap = 0;
    for (let t = 0; t < 90; t++) {
      run(s, 1, intent({ moveX: 1 }), p);
      const pl = s.players[4];
      maxGap = Math.max(maxGap, Math.hypot(s.ball.pos.x - pl.pos.x, s.ball.pos.z - pl.pos.z));
    }
    return { maxGap, owner: s.ball.owner };
  }

  it("keeps the ball at the feet by default", () => {
    const { maxGap, owner } = dribble(0);
    expect(maxGap).toBeLessThan(DEFAULT_PARAMS.dribble.distance + 0.3);
    expect(owner).toBe(4);
  });

  it("pushes the ball ahead in touches when loose, and the dribbler runs onto it", () => {
    const { maxGap, owner } = dribble(1);
    expect(maxGap).toBeGreaterThan(1.2);
    expect(maxGap).toBeLessThan(DEFAULT_PARAMS.dribble.loseDistance + 1.5);
    // Either at the feet again or just touched ahead: never lost to anyone else.
    expect([4, -1]).toContain(owner);
  });
});

describe("responsive controls (docs/specs/10 §8: button to kick ≤ 50 ms)", () => {
  // At 60 ticks per second, 50 ms is 3 ticks. Input is read every tick, so a key press waits at most one tick
  // before the simulation sees it; the kick itself must then follow within the remaining budget.
  const BUDGET = 2;

  function ticksUntil(s: MatchState, held: Intent, done: (s: MatchState) => boolean): number {
    for (let t = 1; t <= 10; t++) {
      run(s, 1, held);
      if (done(s)) return t;
    }
    return Infinity;
  }
  const kicked = (s: MatchState) => s.ball.owner === -1 && Math.hypot(s.ball.vel.x, s.ball.vel.z) > 1;

  it("pass", () => {
    const s = setup();
    onBall(s, 4, 0, 0);
    s.players[3].pos = { x: 8, z: 0 };
    expect(ticksUntil(s, intent({ pass: true }), kicked)).toBeLessThanOrEqual(BUDGET);
  });

  it("shot, from releasing Shoot", () => {
    const s = setup();
    onBall(s, 4, L - 12, 0);
    run(s, 20, intent({ shoot: true }));
    expect(ticksUntil(s, intent(), kicked)).toBeLessThanOrEqual(BUDGET);
  });

  it("lob", () => {
    const s = setup();
    onBall(s, 4, 0, 0);
    s.players[3].pos = { x: 12, z: 0 };
    expect(ticksUntil(s, intent({ lob: true }), kicked)).toBeLessThanOrEqual(BUDGET);
  });

  it("standing and slide tackles", () => {
    for (const [button, kind] of [
      ["shoot", "tackle"],
      ["lob", "slide"],
    ] as const) {
      const s = setup();
      s.players[9].pos = { x: 1.5, z: 0 };
      s.players[9].facing = { x: -1, z: 0 };
      s.ball.pos = { x: 1, y: DEFAULT_PARAMS.ball.radius, z: 0 };
      s.ball.owner = 9;
      s.players[1].pos = { x: -0.5, z: 0 };
      s.players[1].facing = { x: 1, z: 0 };
      s.controllers[0].player = 1;
      s.controllers[0].assists.autoSwitch = false;
      const started = (m: MatchState) => m.players[1].action.kind === kind;
      expect(ticksUntil(s, intent({ [button]: true }), started), kind).toBeLessThanOrEqual(BUDGET);
    }
  });
});

describe("determinism with controls", () => {
  it("identical inputs give identical matches", () => {
    const play = () => {
      const s = createMatch({ seed: 9, pitch: PITCH_5_A_SIDE, teamSize: 5 });
      const rng = new Rng(77);
      let i = intent();
      for (let t = 0; t < 3000; t++) {
        if (t % 15 === 0) {
          i = intent({
            moveX: rng.range(-1, 1),
            moveZ: rng.range(-1, 1),
            sprint: rng.next() < 0.3,
            pass: rng.next() < 0.2,
            shoot: rng.next() < 0.2,
            lob: rng.next() < 0.1,
          });
        }
        stepMatch(s, [i], DEFAULT_PARAMS);
      }
      return s;
    };
    expect(play()).toEqual(play());
  });
});

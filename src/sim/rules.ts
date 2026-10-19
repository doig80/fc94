import type { Intent } from "./intent";
import { DEFAULT_PARAMS, type SimParams } from "./params";
import { isInGoal } from "./physics/goal";
import { inOwnBox } from "./physics/keeper";
import { inOffsidePosition, offsideLine } from "./offside";
import {
  attackSign,
  placeForKickoff,
  type Foul,
  type MatchState,
  type RestartKind,
  type Shootout,
} from "./state";
import type { Vec2 } from "./vec";

/**
 * The referee (docs/specs/10 §1 and §6), for matches created with `rules`: kick-offs, kick-ins, corners,
 * goal kicks, fouls with advantage, free kicks and penalties, cards, offside, halves, extra time, a penalty
 * shoot-out and full time. Pure arithmetic on the match state, so it stays deterministic.
 */

/**
 * Goal celebrations, half-time, the pauses of a shoot-out and full time: the match stands still. Returns true
 * while paused (`stepMatch` then only counts the tick).
 */
export function pauseTick(state: MatchState): boolean {
  const phase = state.phase;
  if (phase.kind === "fulltime") return true;
  if (phase.kind !== "goal" && phase.kind !== "halftime" && phase.kind !== "break") return false;
  if (state.tick + 1 < phase.until) return true;
  if (phase.kind === "goal") {
    // The team that conceded kicks off.
    placeForKickoff(state, phase.team === 0 ? 1 : 0);
  } else if (phase.kind === "halftime") {
    // The next half (extra time after the second): ends change, and the kick-off alternates.
    state.half = state.half === 1 ? 2 : state.half === 2 ? 3 : 4;
    state.clock = 0;
    const other = state.firstKickoff === 0 ? 1 : 0;
    placeForKickoff(state, state.half % 2 === 1 ? state.firstKickoff : other);
  } else if (state.shootout && shootoutWinner(state.shootout) === null) {
    nextShootoutKick(state);
  } else {
    state.lastEvent = { kind: "fulltime", team: 0, tick: state.tick };
    state.phase = { kind: "fulltime" };
  }
  return true;
}

/**
 * Before the actions: the taker of a restart can turn and aim but not run, the aiming marker follows the
 * stick, and a human who waits too long has the restart taken for them.
 */
export function holdRestart(state: MatchState, intents: Intent[], params: SimParams): void {
  if (state.phase.kind !== "restart") return;
  const r = state.phase.restart;
  const taker = state.players[r.taker];
  const intent = intents[r.taker];
  if (!intent) return;
  const mx = intent.moveX;
  const mz = intent.moveZ;
  const len = Math.sqrt(mx * mx + mz * mz);
  if (r.aim && r.kind === "corner") {
    // Corner: the stick moves the marker around the box, the taker faces it.
    const s = attackSign(state, r.team);
    const halfL = state.pitch.length / 2;
    const step = params.referee.cornerAimSpeed / 60;
    const front = halfL - state.pitch.penaltyAreaDepth;
    const x = r.aim.x * s + mx * s * step;
    const z = r.aim.z + mz * step;
    const halfBox = state.pitch.penaltyAreaWidth / 2;
    r.aim.x = s * (x < front ? front : x > halfL - 1 ? halfL - 1 : x);
    r.aim.z = z < -halfBox ? -halfBox : z > halfBox ? halfBox : z;
    const dx = r.aim.x - r.spot.x;
    const dz = r.aim.z - r.spot.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    taker.facing = { x: dx / d, z: dz / d };
  } else if (r.aim) {
    // Free kick or penalty: the stick slides the marker along the goal, the taker faces it.
    const s = attackSign(state, r.team);
    const across = mz * s;
    const limit = state.pitch.goalWidth / 2 + 1;
    const z = r.aim.z + across * params.referee.aimSpeed * (1 / 60);
    r.aim.z = z < -limit ? -limit : z > limit ? limit : z;
    const dx = r.aim.x - r.spot.x;
    const dz = r.aim.z - r.spot.z;
    const d = Math.sqrt(dx * dx + dz * dz) || 1;
    taker.facing = { x: dx / d, z: dz / d };
  } else if (len > 0.2) {
    taker.facing = { x: mx / len, z: mz / len };
  }
  const human = state.controllers.some((c) => c.player === r.taker);
  const wait = human ? params.referee.autoRestartTicks : params.referee.cpuRestartTicks * 3;
  if (state.tick - r.since >= wait && taker.held === 0) {
    // Taken for them: a short pass the way they face.
    intent.pass = true;
    intent.moveX = taker.facing.x;
    intent.moveZ = taker.facing.z;
  }
}

/**
 * After the physics, while the restart hasn't been taken: the ball stays on its spot, the taker behind it,
 * and everyone else where the laws say (own half at a kick-off, back from the ball, out of the area at a
 * penalty with the keeper on the line).
 */
export function holdDeadBall(state: MatchState, params: SimParams): void {
  if (state.phase.kind !== "restart") return;
  const r = state.phase.restart;
  const ball = state.ball;
  if (ball.owner !== r.taker) return; // just taken
  const taker = state.players[r.taker];
  ball.pos = { x: r.spot.x, y: params.ball.radius, z: r.spot.z };
  ball.vel = { x: 0, y: 0, z: 0 };
  ball.spin = { x: 0, y: 0, z: 0 };
  taker.pos = { x: r.spot.x - taker.facing.x * 0.5, z: r.spot.z - taker.facing.z * 0.5 };
  taker.vel = { x: 0, z: 0 };

  const distance = state.pitch.centreCircle;
  const halfL = state.pitch.length / 2;
  state.players.forEach((pl, i) => {
    if (i === r.taker) return;
    const s = attackSign(state, pl.team);
    if (r.kind === "kickoff") {
      // Everyone in their own half; the defending team outside the circle.
      if (pl.pos.x * s > -0.3) pl.pos.x = -0.3 * s;
      if (pl.team !== r.team) keepAway(pl.pos, r.spot, distance + 0.5);
      return;
    }
    if (r.kind === "penalty") {
      const defending = pl.team !== r.team;
      if (defending && pl.role === "gk") {
        // On the line until the kick.
        pl.pos.x = -s * (halfL - 0.3);
        const hw = state.pitch.goalWidth / 2;
        if (pl.pos.z > hw) pl.pos.z = hw;
        if (pl.pos.z < -hw) pl.pos.z = -hw;
        return;
      }
      const box = state.pitch.penaltyAreaDepth + 0.5;
      const goalX = attackSign(state, r.team) * halfL;
      if (Math.abs(pl.pos.x - goalX) < box) pl.pos.x = goalX - attackSign(state, r.team) * box;
      return;
    }
    if (pl.team !== r.team) keepAway(pl.pos, r.spot, distance);
  });
}

function keepAway(p: Vec2, from: Vec2, d: number): void {
  const dx = p.x - from.x;
  const dz = p.z - from.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len >= d) return;
  const k = len > 1e-6 ? d / len : 1;
  p.x = from.x + (len > 1e-6 ? dx * k : d);
  p.z = from.z + dz * (len > 1e-6 ? k : 0);
}

/** After the tick: was the restart taken, is time up, was there a foul, offside, a goal, or did the ball go out? */
export function referee(state: MatchState, params: SimParams): void {
  const rules = state.rules;
  if (!rules) return;
  if (state.shootout) return shootoutReferee(state, params);
  const ball = state.ball;
  const phase = state.phase;
  if (phase.kind === "restart" && ball.owner !== phase.restart.taker) {
    state.phase = { kind: "play" };
    // No offside straight from a kick-in, corner or goal kick.
    const k = phase.restart.kind;
    if (k === "kickin" || k === "corner" || k === "goalkick") {
      state.kickSeen = ball.kickedAt;
      state.offside = null;
    }
  }
  if (state.phase.kind !== "play" && state.phase.kind !== "restart") return;

  state.clock++;
  if (state.clock >= halfTicks(state, params)) return endOfHalf(state, params);
  if (state.phase.kind !== "play") return;

  const foul = state.foul;
  state.foul = null;
  if (foul && rules.fouls && callFoul(state, foul, params)) return;
  if (rules.offside && judgeOffside(state, params)) return;

  const goal = isInGoal(ball, state.pitch, params.ball.radius);
  if (goal !== 0) {
    // The goal at +x is attacked by the team with attack sign +1.
    const scorer: 0 | 1 = attackSign(state, 0) === goal ? 0 : 1;
    state.score[scorer]++;
    state.lastEvent = { kind: "goal", team: scorer, tick: state.tick };
    state.phase = { kind: "goal", team: scorer, until: state.tick + params.referee.goalPauseTicks };
    return;
  }

  const halfL = state.pitch.length / 2;
  const halfW = state.pitch.width / 2;
  const r = params.ball.radius;
  const last = ball.lastTouch >= 0 ? state.players[ball.lastTouch].team : 0;
  const other: 0 | 1 = last === 0 ? 1 : 0;
  if (Math.abs(ball.pos.z) > halfW + r) {
    const x = clampAbs(ball.pos.x, halfL - 0.5);
    startRestart(state, "kickin", other, { x, z: Math.sign(ball.pos.z) * (halfW - 0.1) }, -1);
  } else if (Math.abs(ball.pos.x) > halfL + r) {
    const side = ball.pos.x > 0 ? 1 : -1;
    // The team defending this goal: its own goal is at −(attack sign).
    const defending: 0 | 1 = attackSign(state, 0) === -side ? 0 : 1;
    if (last === defending) {
      const z = ball.pos.z >= 0 ? 1 : -1;
      startRestart(
        state,
        "corner",
        defending === 0 ? 1 : 0,
        { x: side * (halfL - 0.3), z: z * (halfW - 0.3) },
        -1,
      );
    } else {
      const keeper = state.players.findIndex((p) => p.team === defending && p.role === "gk");
      const spot = { x: side * (halfL - state.pitch.goalAreaDepth * 0.6), z: 0 };
      startRestart(state, "goalkick", defending, spot, keeper);
    }
  }
}

/** Length of the current half: extra time is a share of a normal half. */
function halfTicks(state: MatchState, params: SimParams): number {
  const ticks = state.rules?.halfTicks ?? 1;
  return state.half <= 2 ? ticks : Math.max(1, Math.round(ticks * params.referee.extraTimeShare));
}

/**
 * The whistle at the end of a half: half-time; or after the second half full time, unless the match must have a
 * winner and is level, then extra time; and if it's still level after that, a penalty shoot-out.
 */
function endOfHalf(state: MatchState, params: SimParams): void {
  const tick = state.tick;
  const level = state.score[0] === state.score[1];
  if (state.half === 1 || state.half === 3) {
    state.lastEvent = { kind: "halftime", team: 0, tick };
    state.phase = { kind: "halftime", until: tick + params.referee.halftimeTicks };
  } else if (state.half === 2 && level && state.rules?.winner) {
    state.lastEvent = { kind: "extratime", team: 0, tick };
    state.phase = { kind: "halftime", until: tick + params.referee.halftimeTicks };
  } else if (state.half === 4 && level) {
    startShootout(state, params);
  } else {
    state.lastEvent = { kind: "fulltime", team: 0, tick };
    state.phase = { kind: "fulltime" };
  }
}

// --- Fouls and cards --------------------------------------------------------------------------------

/**
 * Rule on a foul: advantage if the fouled team keeps the ball, otherwise a penalty in the offender's area or a
 * free kick; and a card for the worst fouls. Returns true when play stopped.
 */
function callFoul(state: MatchState, foul: Foul, params: SimParams): boolean {
  const ball = state.ball;
  const victimTeam = state.players[foul.victim].team;
  const offender = state.players[foul.by].team;
  const inBox = inOwnBox(state, offender, foul.spot.x, foul.spot.z);
  const card = state.rules?.cards ? cardFor(state, foul, inBox, params) : null;
  // Advantage only if the fouled team still has the ball and isn't on the floor.
  const holder = ball.owner >= 0 ? state.players[ball.owner] : null;
  let stopped = true;
  if (holder && holder.team === victimTeam && holder.action.kind !== "stumble") {
    state.lastEvent = { kind: "advantage", team: victimTeam, tick: state.tick };
    stopped = false;
  } else if (inBox) {
    const s = attackSign(state, victimTeam);
    const spot = { x: s * (state.pitch.length / 2 - state.pitch.penaltySpot), z: 0 };
    startRestart(state, "penalty", victimTeam, spot, penaltyTaker(state, victimTeam, foul.victim));
  } else {
    startRestart(state, "freekick", victimTeam, onPitch(state, foul.spot), -1);
  }
  if (card) book(state, foul.by, card === "red");
  return stopped;
}

/**
 * Cards (docs/specs/10 §6), the same every time for the same foul, never random: a foul that stops a player
 * through on goal is a red card (a yellow if it gives away a penalty), a slide from behind is a yellow, and other
 * fouls get no card.
 */
function cardFor(state: MatchState, foul: Foul, inBox: boolean, params: SimParams): "yellow" | "red" | null {
  if (state.players[foul.by].role === "gk") return null;
  if (throughOnGoal(state, foul, params)) return inBox ? "yellow" : "red";
  return foul.slide && foul.fromBehind ? "yellow" : null;
}

/** Was the fouled player through on goal: on the ball, close to goal, and no defender but the keeper goal side? */
function throughOnGoal(state: MatchState, foul: Foul, params: SimParams): boolean {
  const v = state.players[foul.victim];
  const b = state.ball.pos;
  if ((b.x - v.pos.x) * (b.x - v.pos.x) + (b.z - v.pos.z) * (b.z - v.pos.z) > 3 * 3) return false;
  const s = attackSign(state, v.team);
  const x = v.pos.x * s;
  const toGoal = state.pitch.length / 2 - x;
  if (toGoal > params.referee.clearRunDistance || Math.abs(v.pos.z) > state.pitch.penaltyAreaWidth / 2)
    return false;
  return !state.players.some(
    (p, i) => p.team !== v.team && i !== foul.by && p.role !== "gk" && !p.sentOff && p.pos.x * s > x,
  );
}

/** Show player `i` a card (a second yellow is a red); a red sends them off. The card rides on the latest call. */
function book(state: MatchState, i: number, red: boolean): void {
  const pl = state.players[i];
  if (!red) pl.yellows++;
  const off = red || pl.yellows >= 2;
  if (state.lastEvent) state.lastEvent.card = { player: i, red: off };
  if (off) sendOff(state, i);
}

/**
 * A sent-off player leaves the pitch for the rest of the match (no substitutes in v1): they wait off the pitch by
 * the halfway line, out of play, and a human controlling them moves to a teammate.
 */
export function sendOff(state: MatchState, i: number): void {
  const pl = state.players[i];
  const off = state.players.filter((p) => p.sentOff).length;
  pl.sentOff = true;
  pl.pos = { x: (pl.team === 0 ? -2 : 2) - off * 0.8, z: state.pitch.width / 2 + 4 };
  pl.vel = { x: 0, z: 0 };
  pl.charge = -1;
  pl.queued = null;
  pl.held = 0;
  pl.action = { kind: "none", ticks: 0, total: 0, dir: pl.facing };
  const mem = state.ai[i];
  mem.plan = null;
  mem.target = null;
  if (state.ball.owner === i) state.ball.owner = -1;
  if (state.ball.intendedReceiver === i) state.ball.intendedReceiver = -1;
  for (const c of state.controllers) {
    if (c.player === i) c.player = nearestOutfield(state, pl.team, state.ball.pos);
  }
}

// --- Offside --------------------------------------------------------------------------------------------

/**
 * Offside (docs/specs/10 §6), judged when the ball is played: the kicker's teammates in an offside position then
 * are offside if one of them is the next to touch it; a touch by anyone else ends it. An indirect free kick to
 * the defending team where the offside player was. Returns true when offside was called.
 */
function judgeOffside(state: MatchState, params: SimParams): boolean {
  const ball = state.ball;
  const watch = state.offside;
  const toucher = ball.owner >= 0 ? ball.owner : ball.lastTouch;
  if (watch && toucher >= 0 && toucher !== watch.kicker) {
    if (watch.players.includes(toucher)) {
      const other: 0 | 1 = watch.team === 0 ? 1 : 0;
      startRestart(state, "freekick", other, onPitch(state, state.players[toucher].pos), -1);
      state.lastEvent = { kind: "offside", team: other, tick: state.tick, line: watch.line };
      state.offside = null;
      state.kickSeen = ball.kickedAt;
      return true;
    }
    state.offside = null;
  }
  if (ball.kickedAt !== state.kickSeen && ball.owner < 0 && ball.lastTouch >= 0) {
    // A new kick: who is offside as it's played?
    state.kickSeen = ball.kickedAt;
    const kicker = ball.lastTouch;
    const team = state.players[kicker].team;
    const players = state.players
      .map((_, j) => j)
      .filter(
        (j) =>
          j !== kicker &&
          state.players[j].team === team &&
          !state.players[j].sentOff &&
          inOffsidePosition(state, j, params),
      );
    state.offside = {
      kickedAt: ball.kickedAt,
      kicker,
      team,
      players,
      line: offsideLine(state, team) * attackSign(state, team),
    };
  }
  return false;
}

// --- Penalty shoot-out ----------------------------------------------------------------------------------

/** Go to a penalty shoot-out: a pause, then the first kick (`?shootout=1` starts a match here for playtests). */
export function startShootout(state: MatchState, params: SimParams): void {
  state.lastEvent = { kind: "shootout", team: 0, tick: state.tick };
  state.phase = { kind: "break", until: state.tick + params.referee.halftimeTicks };
  state.shootout = { kicks: [[], []], next: state.firstKickoff, taker: -1, struck: -1 };
}

/** The shoot-out winner once it can't change any more, else null: best of five kicks each, then sudden death. */
export function shootoutWinner(so: Shootout): 0 | 1 | null {
  const [a, b] = so.kicks;
  const goals = (k: boolean[]) => k.filter(Boolean).length;
  const ga = goals(a);
  const gb = goals(b);
  if (a.length <= 5 && b.length <= 5) {
    if (ga > gb + (5 - b.length)) return 0;
    if (gb > ga + (5 - a.length)) return 1;
    return null;
  }
  return a.length === b.length && ga !== gb ? (ga > gb ? 0 : 1) : null;
}

/** A team's penalty takers in order: forwards first, back through the team, the keeper last. */
function shootoutTakers(state: MatchState, team: 0 | 1): number[] {
  const teamSize = state.players.length / 2;
  const order: number[] = [];
  for (let k = teamSize - 1; k >= 0; k--) {
    const i = team * teamSize + k;
    if (!state.players[i].sentOff) order.push(i);
  }
  return order;
}

/** Line up the next shoot-out kick: everyone else waits at halfway, the other keeper on the line. */
function nextShootoutKick(state: MatchState): void {
  const so = state.shootout!;
  const team = so.next;
  const takers = shootoutTakers(state, team);
  so.taker = takers[so.kicks[team].length % takers.length];
  so.struck = -1;
  const teamSize = state.players.length / 2;
  state.players.forEach((pl, i) => {
    if (pl.sentOff) return;
    pl.pos = { x: pl.team === 0 ? -1.5 : 1.5, z: ((i % teamSize) - (teamSize - 1) / 2) * 1.6 };
    pl.vel = { x: 0, z: 0 };
    pl.facing = { x: 1, z: 0 };
    pl.held = 0;
    pl.charge = -1;
    pl.queued = null;
    pl.action = { kind: "none", ticks: 0, total: 0, dir: pl.facing };
  });
  state.ai.forEach((m) => {
    m.plan = null;
    m.target = null;
    m.move = { x: 0, z: 0 };
  });
  state.offside = null;
  const spot = { x: state.pitch.length / 2 - state.pitch.penaltySpot, z: 0 };
  startRestart(state, "penalty", team, spot, so.taker);
}

/**
 * During a shoot-out: the kick is taken, then it's in, or it's missed (saved, wide, stopped, or played again by
 * the taker, which doesn't count). Then a pause before the next kick or the end.
 */
function shootoutReferee(state: MatchState, params: SimParams): void {
  const so = state.shootout!;
  const ball = state.ball;
  const phase = state.phase;
  if (phase.kind === "restart") {
    if (ball.owner !== phase.restart.taker) {
      state.phase = { kind: "play" };
      so.struck = ball.kickedAt;
    }
    return;
  }
  if (phase.kind !== "play") return;
  const replayed = ball.kickedAt !== so.struck && ball.lastTouch === so.taker;
  const scored = !replayed && isInGoal(ball, state.pitch, params.ball.radius) === 1;
  const halfL = state.pitch.length / 2;
  const halfW = state.pitch.width / 2;
  const out = Math.abs(ball.pos.x) > halfL + params.ball.radius || Math.abs(ball.pos.z) > halfW;
  const over = state.tick - so.struck > params.referee.shootoutKickTicks;
  if (!scored && !replayed && !out && !over && ball.owner < 0) return;
  so.kicks[so.next].push(scored);
  state.lastEvent = { kind: scored ? "scored" : "missed", team: so.next, tick: state.tick };
  so.next = so.next === 0 ? 1 : 0;
  state.phase = { kind: "break", until: state.tick + params.referee.shootoutBreakTicks };
}

/**
 * During a shoot-out only the taker and the keeper facing the kick play; everyone else stands and watches,
 * whoever controls them.
 */
export function holdShootout(state: MatchState, intents: Intent[]): void {
  const so = state.shootout;
  if (!so) return;
  const keeper = state.players.findIndex((p) => p.team !== so.next && p.role === "gk");
  intents.forEach((intent, i) => {
    if (i === so.taker || i === keeper) return;
    intent.moveX = 0;
    intent.moveZ = 0;
    intent.pass = false;
    intent.shoot = false;
    intent.lob = false;
    intent.sprint = false;
  });
}

/** Stop play for a restart: ball on the spot, the taker on it, humans of that team control the taker. */
export function startRestart(
  state: MatchState,
  kind: RestartKind,
  team: 0 | 1,
  spot: Vec2,
  taker: number,
): void {
  const who = taker >= 0 ? taker : nearestOutfield(state, team, spot);
  const s = attackSign(state, team);
  const pl = state.players[who];
  // The aiming marker: on the goal line for a free kick or penalty, on the penalty spot to start with for a corner.
  const halfL = state.pitch.length / 2;
  const aim =
    kind === "freekick" || kind === "penalty"
      ? { x: s * halfL, z: 0 }
      : kind === "corner"
        ? { x: s * (halfL - state.pitch.penaltySpot), z: 0 }
        : null;
  // Face the goal at a free kick or penalty, otherwise up the pitch.
  const fx = aim ? aim.x - spot.x : s;
  const fz = aim ? aim.z - spot.z : 0;
  const fl = Math.sqrt(fx * fx + fz * fz) || 1;
  pl.facing = { x: fx / fl, z: fz / fl };
  pl.pos = { x: spot.x - pl.facing.x * 0.5, z: spot.z - pl.facing.z * 0.5 };
  pl.vel = { x: 0, z: 0 };
  pl.charge = -1;
  pl.held = 0;
  pl.action = { kind: "none", ticks: 0, total: 0, dir: pl.facing };
  const ball = state.ball;
  ball.pos = { x: spot.x, y: ball.pos.y > 0 ? ball.pos.y : 0, z: spot.z };
  ball.vel = { x: 0, y: 0, z: 0 };
  ball.spin = { x: 0, y: 0, z: 0 };
  ball.owner = who;
  ball.lastTouch = who;
  ball.intendedReceiver = -1;
  ball.aftertouchUntil = 0;
  state.oneTwo = null;
  // A restart starts afresh: nobody is offside from the play before it.
  state.offside = null;
  state.phase = { kind: "restart", restart: { kind, team, spot, taker: who, since: state.tick, aim } };
  state.lastEvent = { kind, team, tick: state.tick };
  for (const c of state.controllers) {
    if (c.team === team && pl.role !== "gk") c.player = who;
  }
}

/** The fouled player takes the penalty, unless it was the keeper; then the most advanced outfield player does. */
function penaltyTaker(state: MatchState, team: 0 | 1, victim: number): number {
  if (state.players[victim].role !== "gk") return victim;
  const goal = { x: attackSign(state, team) * (state.pitch.length / 2), z: 0 };
  return nearestOutfield(state, team, goal);
}

function nearestOutfield(state: MatchState, team: 0 | 1, spot: Vec2): number {
  let best = -1;
  let bestDist = Infinity;
  state.players.forEach((p, i) => {
    if (p.team !== team || p.role === "gk" || p.sentOff) return;
    const dx = p.pos.x - spot.x;
    const dz = p.pos.z - spot.z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

function onPitch(state: MatchState, p: Vec2): Vec2 {
  return { x: clampAbs(p.x, state.pitch.length / 2 - 0.3), z: clampAbs(p.z, state.pitch.width / 2 - 0.3) };
}

function clampAbs(v: number, max: number): number {
  return v > max ? max : v < -max ? -max : v;
}

/**
 * The match clock as the scoreboard shows it: 45 minutes per half and 15 per half of extra time, however long a
 * half really is.
 */
export function matchMinute(state: MatchState, params: SimParams = DEFAULT_PARAMS): number {
  if (state.shootout) return 120;
  const minutes = state.half <= 2 ? 45 : 15;
  const inHalf = Math.min(minutes, Math.floor((state.clock / halfTicks(state, params)) * minutes));
  return inHalf + [0, 0, 45, 90, 105][state.half];
}

import type { Intent } from "./intent";
import type { SimParams } from "./params";
import { kickBall } from "./physics/dribble";
import { Rng } from "./rng";
import { Button, type ActionKind, type Assists, type MatchState, type PlayerState } from "./state";
import { normalize2, type Vec2 } from "./vec";

/**
 * What the three buttons do (docs/specs/10 §3). Everything here is plain arithmetic on the match state,
 * so humans and AI get identical, deterministic results.
 *
 * | Button | With the ball / ball nearby          | Defending        |
 * |--------|--------------------------------------|------------------|
 * | Pass   | ground pass (first time if early)    | switch player*   |
 * | Shoot  | hold for power, steer to curl        | standing tackle  |
 * | Lob    | cross / through ball / lob           | slide tackle     |
 * (*switching lives in control.ts; it only applies to humans.)
 */

/** +1 if `team` attacks the goal at +x in the current half, else −1. */
export function attackSign(state: MatchState, team: 0 | 1): 1 | -1 {
  return (team === 0) === (state.half === 1) ? 1 : -1;
}

export function bits(intent: Intent | undefined): number {
  if (!intent) return 0;
  return (intent.pass ? Button.pass : 0) | (intent.shoot ? Button.shoot : 0) | (intent.lob ? Button.lob : 0);
}

/** Does `i`'s team have the ball, or is it loose and close enough to play? */
export function attackingContext(state: MatchState, i: number, params: SimParams): boolean {
  const ball = state.ball;
  const pl = state.players[i];
  if (ball.owner >= 0) return state.players[ball.owner].team === pl.team;
  if (ball.intendedReceiver >= 0 && state.players[ball.intendedReceiver].team === pl.team) return true;
  const dx = ball.pos.x - pl.pos.x;
  const dz = ball.pos.z - pl.pos.z;
  const r = params.action.attackContextRadius;
  return dx * dx + dz * dz < r * r;
}

/** Apply every player's button presses and releases for this tick. */
export function applyActions(
  state: MatchState,
  intents: readonly Intent[],
  params: SimParams,
  assistsFor: (i: number) => Assists | null,
): void {
  const rng = new Rng(state.rng);
  state.players.forEach((pl, i) => {
    const intent = intents[i];
    const now = bits(intent);
    const pressed = now & ~pl.held;
    const released = pl.held & ~now;
    pl.held = now;
    if (pl.action.kind === "slide" || pl.action.kind === "stumble") {
      pl.charge = -1;
      return;
    }
    const owns = state.ball.owner === i;
    const attacking = attackingContext(state, i, params);
    const move = moveDir(intent);
    const assists = assistsFor(i);

    // Shoot: charge while held, fire on release.
    if (owns && pl.charge >= 0) {
      if (now & Button.shoot) pl.charge = Math.min(pl.charge + 1, params.action.shotChargeTicks);
      if (released & Button.shoot) {
        shoot(state, i, pl.charge / params.action.shotChargeTicks, move, params, assists);
        pl.charge = -1;
        return;
      }
    } else if (!owns) {
      pl.charge = -1;
    }

    if (owns) {
      if (pressed & Button.pass) pass(state, i, move, params, assists, false);
      else if (pressed & Button.lob) lob(state, i, move, params, assists);
      else if (pressed & Button.shoot) pl.charge = 0;
      return;
    }
    if (attacking) {
      if (pressed & Button.shoot) {
        if (!contactShot(state, i, move, params, assists)) queue(state, pl, "shoot", move, params);
      }
      if (pressed & Button.pass && !startOneTwo(state, i, params)) queue(state, pl, "pass", move, params);
      return;
    }
    // Defending.
    if (pressed & Button.shoot) tackle(state, i, rng, params);
    else if (pressed & Button.lob) startAction(pl, "slide", params.action.slideTicks, move ?? pl.facing);
  });
  state.rng = rng.state;
}

/** Count down action timers; resolve slides touching the ball or an opponent. */
export function tickActions(state: MatchState, params: SimParams): void {
  const a = params.action;
  state.players.forEach((pl, i) => {
    const act = pl.action;
    if (act.kind === "none") return;
    if (act.kind === "slide") slideContact(state, i, params);
    act.ticks--;
    if (act.ticks > 0) return;
    if (act.kind === "slide") startAction(pl, "stumble", a.slideRecoveryTicks, act.dir);
    else act.kind = "none";
  });
}

/** Play a first-time pass or shot that was asked for just before the ball arrived. */
export function playQueued(
  state: MatchState,
  params: SimParams,
  assistsFor: (i: number) => Assists | null,
): void {
  const owner = state.ball.owner;
  if (owner < 0) return;
  const pl = state.players[owner];
  const q = pl.queued;
  pl.queued = null;
  if (!q || state.tick > q.until) return;
  const dir = q.dir ?? { ...pl.facing };
  if (q.kind === "pass") pass(state, owner, dir, params, assistsFor(owner), false);
  else shoot(state, owner, params.action.contextShotPower, q.dir, params, assistsFor(owner));
}

// --- Passing -------------------------------------------------------------------------------------

/** Best teammate for a pass in direction `dir` (closer and better aligned is better), or −1. */
export function choosePassTarget(
  state: MatchState,
  i: number,
  dir: Vec2,
  params: SimParams,
  forwardOnly = false,
): number {
  const pl = state.players[i];
  const s = attackSign(state, pl.team);
  let best = -1;
  let bestScore = -Infinity;
  state.players.forEach((t, j) => {
    if (j === i || t.team !== pl.team) return;
    const dx = t.pos.x - pl.pos.x;
    const dz = t.pos.z - pl.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < 2) return;
    const cos = (dx * dir.x + dz * dir.z) / dist;
    if (cos < params.action.passConeCos) return;
    if (forwardOnly && t.vel.x * s < 1.5) return;
    const score = cos * 2 - dist / 25;
    if (score > bestScore) {
      best = j;
      bestScore = score;
    }
  });
  return best;
}

/** Where to play the ball to reach `target`, leading a running receiver (pass-lead assist). */
function leadPoint(state: MatchState, from: Vec2, target: PlayerState, speed: number, lead: number): Vec2 {
  const dx = target.pos.x - from.x;
  const dz = target.pos.z - from.z;
  const t = Math.sqrt(dx * dx + dz * dz) / speed;
  const halfL = state.pitch.length / 2;
  const halfW = state.pitch.width / 2;
  return {
    x: clampAbs(target.pos.x + target.vel.x * t * lead, halfL - 0.5),
    z: clampAbs(target.pos.z + target.vel.z * t * lead, halfW - 0.5),
  };
}

export function pass(
  state: MatchState,
  i: number,
  move: Vec2 | null,
  params: SimParams,
  assists: Assists | null,
  through: boolean,
): void {
  const pl = state.players[i];
  const a = params.action;
  const dir = move ?? pl.facing;
  const target = choosePassTarget(state, i, dir, params, through);
  const from = { x: state.ball.pos.x, z: state.ball.pos.z };
  if (target < 0) {
    // No one there: a firm pass into space.
    groundKick(state, i, from, { x: from.x + dir.x * 12, z: from.z + dir.z * 12 }, params, -1);
    return;
  }
  const t = state.players[target];
  const lead = through ? a.throughLead : assists?.passLead === false ? 0 : a.passLead;
  // Estimate the travel time with a typical pass speed, then aim at where the receiver will be.
  const aim = leadPoint(state, from, t, 14, lead);
  groundKick(state, i, from, aim, params, target);
}

function groundKick(
  state: MatchState,
  i: number,
  from: Vec2,
  to: Vec2,
  params: SimParams,
  receiver: number,
): void {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const dir = normalize2({ x: dx, z: dz }, state.players[i].facing);
  const speed = groundPassSpeed(dist, state, params);
  face(state.players[i], dir);
  kickBall(state, i, { x: dir.x * speed, y: 0, z: dir.z * speed }, undefined, {
    blockTicks: params.dribble.kickCooldownTicks,
    receiver,
  });
}

/**
 * Kick speed so a rolling ball covers `distance` and still has `passArrivalSpeed` left. Found by simulating
 * the same rolling friction the ball uses, so it stays right in rain and snow.
 */
export function groundPassSpeed(distance: number, state: MatchState, params: SimParams): number {
  const a = params.action;
  const w = params.weather;
  const factor =
    state.weather === "rain" ? w.rainRollingFactor : state.weather === "snow" ? w.snowRollingFactor : 1;
  const decel = params.ball.rollingDecel * factor;
  const damping = params.ball.rollingDamping;
  const dt = 1 / 60;
  const travel = (v0: number) => {
    let v = v0;
    let d = 0;
    for (let n = 0; n < 900 && v > a.passArrivalSpeed; n++) {
      v -= (decel + damping * v) * dt;
      d += v * dt;
    }
    return d;
  };
  let lo = a.passMinSpeed;
  let hi = a.passMaxSpeed;
  if (travel(lo) >= distance) return lo;
  if (travel(hi) <= distance) return hi;
  for (let n = 0; n < 16; n++) {
    const mid = (lo + hi) / 2;
    if (travel(mid) < distance) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Lob button with the ball: cross from a wide attacking position, through ball to a runner, or a lob. */
export function lob(
  state: MatchState,
  i: number,
  move: Vec2 | null,
  params: SimParams,
  assists: Assists | null,
): void {
  const pl = state.players[i];
  const a = params.action;
  const s = attackSign(state, pl.team);
  const halfL = state.pitch.length / 2;
  const halfW = state.pitch.width / 2;
  const from = { x: state.ball.pos.x, z: state.ball.pos.z };
  const dir = move ?? pl.facing;

  const inFinalThird = pl.pos.x * s > halfL / 3;
  const wide = Math.abs(pl.pos.z) > halfW * 0.4;
  if (inFinalThird && wide) {
    // Cross: to the middle of the box, just beyond the near post.
    const spot = { x: s * (halfL - Math.min(6, halfL * 0.3)), z: pl.pos.z > 0 ? -1 : 1 };
    loftedKick(state, i, from, spot, a.crossLift, params);
    return;
  }
  const runner = choosePassTarget(state, i, dir, params, true);
  if (runner >= 0) {
    pass(state, i, dir, params, assists, true);
    return;
  }
  const target = choosePassTarget(state, i, dir, params);
  const to =
    target >= 0
      ? leadPoint(state, from, state.players[target], 14, assists?.passLead === false ? 0 : a.passLead)
      : { x: from.x + dir.x * 15, z: from.z + dir.z * 15 };
  loftedKick(state, i, from, to, a.lobLift, params, target);
}

/** A ball in the air that comes down at `to` (drag is made up for by `loftDragComp`). */
function loftedKick(
  state: MatchState,
  i: number,
  from: Vec2,
  to: Vec2,
  lift: number,
  params: SimParams,
  receiver = -1,
): void {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const dir = normalize2({ x: dx, z: dz }, state.players[i].facing);
  const flight = (2 * lift) / params.ball.gravity;
  const speed = Math.min((dist / flight) * params.action.loftDragComp, 28);
  face(state.players[i], dir);
  kickBall(state, i, { x: dir.x * speed, y: lift, z: dir.z * speed }, undefined, {
    blockTicks: params.dribble.kickCooldownTicks,
    receiver,
  });
}

// --- Shooting -----------------------------------------------------------------------------------

/**
 * Shot at the goal being attacked. `power` 0..1 sets speed and rise (too much and it flies over).
 * Steering sideways at release picks a corner and curls the ball into it.
 */
export function shoot(
  state: MatchState,
  i: number,
  power: number,
  move: Vec2 | null,
  params: SimParams,
  assists: Assists | null,
  lift?: number,
): void {
  const pl = state.players[i];
  const a = params.action;
  const s = attackSign(state, pl.team);
  const goalX = (s * state.pitch.length) / 2;
  const ball = state.ball;
  const toGoal = normalize2({ x: goalX - ball.pos.x, z: -ball.pos.z });
  // Sideways part of the stick, relative to the shot: + means towards `side`.
  const side = { x: -toGoal.z, z: toGoal.x };
  const lateral = move ? toGoal.x * move.z - toGoal.z * move.x : 0;
  const gw = state.pitch.goalWidth;
  let aimZ = side.z * lateral * gw * 0.35 - side.z * lateral * a.curlAimOffset;
  if (assists?.aimHelp && Math.abs(lateral) < 0.2) {
    // Aim help: the side of the goal away from the keeper.
    const keeper = state.players.find((p) => p.team !== pl.team && p.role === "gk");
    aimZ = (keeper && keeper.pos.z >= 0 ? -1 : 1) * gw * 0.32;
  }
  const dir = normalize2({ x: goalX - ball.pos.x, z: aimZ - ball.pos.z });
  const p = power < 0 ? 0 : power > 1 ? 1 : power;
  const speed = a.shotMinSpeed + (a.shotMaxSpeed - a.shotMinSpeed) * p;
  const rise =
    lift ?? a.shotMinLift + (a.shotMaxLift - a.shotMinLift) * p + (p > a.overpowerAt ? a.overpowerLift : 0);
  face(pl, dir);
  kickBall(
    state,
    i,
    { x: dir.x * speed, y: rise, z: dir.z * speed },
    { x: 0, y: -lateral * a.curlSpin, z: 0 },
    { blockTicks: params.dribble.kickCooldownTicks },
  );
}

/** Shoot at a loose ball in the air: volley, header (diving if stretched), or a bicycle kick facing away. */
function contactShot(
  state: MatchState,
  i: number,
  move: Vec2 | null,
  params: SimParams,
  assists: Assists | null,
): boolean {
  const pl = state.players[i];
  const ball = state.ball;
  const a = params.action;
  if (ball.owner >= 0) return false;
  const dx = ball.pos.x - pl.pos.x;
  const dz = ball.pos.z - pl.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const h = ball.pos.y;
  if (dist > a.contactReach || h < a.volleyMinHeight || h > a.headerMaxHeight) return false;
  const s = attackSign(state, pl.team);
  const facingAway = pl.facing.x * s < -0.2;
  let kind: ActionKind;
  let lift: number;
  if (h >= a.headerMinHeight) {
    kind = "header";
    lift = h > 1.6 ? -1 : 0.5;
  } else if (facingAway) {
    kind = "bicycle";
    lift = 2.5;
  } else {
    kind = "volley";
    lift = 1.5;
  }
  startAction(pl, kind, 20, normalize2({ x: dx, z: dz }, pl.facing));
  if (kind === "header" && dist > 0.6) {
    // Diving header: launch towards the ball.
    pl.vel.x = (dx / dist) * 5;
    pl.vel.z = (dz / dist) * 5;
  }
  shoot(state, i, a.contextShotPower, move, params, assists, lift);
  return true;
}

// --- Defending ----------------------------------------------------------------------------------

/** Standing tackle on the dribbler in front of `i`. Wins the ball some of the time; a miss costs balance. */
export function tackle(state: MatchState, i: number, rng: Rng, params: SimParams): void {
  const pl = state.players[i];
  const a = params.action;
  startAction(pl, "tackle", a.tackleTicks, pl.facing);
  const owner = state.ball.owner;
  if (owner < 0 || state.players[owner].team === pl.team) return;
  const o = state.players[owner];
  const dx = o.pos.x - pl.pos.x;
  const dz = o.pos.z - pl.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const inFront = dist < 1e-6 || (dx * pl.facing.x + dz * pl.facing.z) / dist > 0;
  if (dist > a.tackleRange || !inFront) return;
  if (rng.next() < a.tackleSuccess) {
    // Poke the ball back towards the tackler; the dribbler is knocked off balance.
    const back = normalize2({ x: pl.pos.x - state.ball.pos.x, z: pl.pos.z - state.ball.pos.z }, pl.facing);
    kickBall(state, i, { x: back.x * a.tacklePokeSpeed, y: 0, z: back.z * a.tacklePokeSpeed }, undefined, {
      blockTicks: 0,
    });
    startAction(o, "stumble", Math.round(a.stumbleTicks / 2), o.facing);
  } else {
    startAction(pl, "stumble", a.stumbleTicks, pl.facing);
  }
}

/** A sliding player knocks away a low ball near their feet and trips opponents they hit. */
function slideContact(state: MatchState, i: number, params: SimParams): void {
  const pl = state.players[i];
  const a = params.action;
  const ball = state.ball;
  const foot = { x: pl.pos.x + pl.action.dir.x * 0.5, z: pl.pos.z + pl.action.dir.z * 0.5 };
  const bdx = ball.pos.x - foot.x;
  const bdz = ball.pos.z - foot.z;
  const ownedByTeammate = ball.owner >= 0 && state.players[ball.owner].team === pl.team;
  if (!ownedByTeammate && ball.pos.y < 0.5 && bdx * bdx + bdz * bdz < a.slideReach * a.slideReach) {
    const d = pl.action.dir;
    kickBall(state, i, { x: d.x * a.slideKnockSpeed, y: 0.5, z: d.z * a.slideKnockSpeed }, undefined, {
      blockTicks: a.slideTicks,
    });
  }
  state.players.forEach((o) => {
    if (o.team === pl.team || o.action.kind === "stumble") return;
    const dx = o.pos.x - foot.x;
    const dz = o.pos.z - foot.z;
    if (dx * dx + dz * dz < 0.8 * 0.8) startAction(o, "stumble", a.stumbleTicks, o.facing);
  });
}

/**
 * Pass pressed again just after a pass (by the passer or the receiver): a one-two. The passer runs on and
 * the receiver returns the ball first time into the run.
 */
function startOneTwo(state: MatchState, i: number, params: SimParams): boolean {
  const ball = state.ball;
  const passer = ball.lastTouch;
  const receiver = ball.intendedReceiver;
  if (ball.owner >= 0 || receiver < 0 || passer < 0 || passer === receiver) return false;
  if (i !== passer && i !== receiver) return false;
  if (state.players[passer].team !== state.players[receiver].team) return false;
  const passTick = ball.touchBlockUntil - params.dribble.kickCooldownTicks;
  if (state.tick > passTick + params.action.oneTwoWindowTicks) return false;
  state.oneTwo = { passer, receiver, until: state.tick + params.action.oneTwoRunTicks };
  return true;
}

// --- Helpers ------------------------------------------------------------------------------------

function queue(
  state: MatchState,
  pl: PlayerState,
  kind: "pass" | "shoot",
  dir: Vec2 | null,
  params: SimParams,
): void {
  pl.queued = { kind, until: state.tick + params.action.bufferTicks, dir };
}

export function startAction(pl: PlayerState, kind: ActionKind, ticks: number, dir: Vec2): void {
  pl.action = { kind, ticks, total: ticks, dir: normalize2(dir, pl.facing) };
}

function moveDir(intent: Intent | undefined): Vec2 | null {
  if (!intent) return null;
  const l = Math.sqrt(intent.moveX * intent.moveX + intent.moveZ * intent.moveZ);
  return l > 0.2 ? { x: intent.moveX / l, z: intent.moveZ / l } : null;
}

function face(pl: PlayerState, dir: Vec2): void {
  pl.facing = { x: dir.x, z: dir.z };
}

function clampAbs(v: number, max: number): number {
  return v > max ? max : v < -max ? -max : v;
}

import { IDLE, type Intent } from "../intent";
import type { SimParams } from "../params";
import { inOwnBox } from "../physics/keeper";
import { Rng } from "../rng";
import { attackSign, type AiPlan, type MatchState, type PlayerState, type ShotRead } from "../state";
import { clamp, normalize2, type Vec2 } from "../vec";
import { inOffsidePosition, offsideOn } from "../offside";
import { isWide, keepOnside, lineOf, shapeSpot } from "./shape";

/**
 * Intents for every player the AI runs (docs/specs/11): everyone a human doesn't control, keepers always.
 * A CPU player decides every `reactionTicks` (its reaction time) and keeps doing what it decided in between.
 * It presses the same buttons a human would, so it plays by exactly the same rules: no speed boosts and no
 * peeking at a human's input (docs/specs/11 §4: fair play).
 */
export function aiIntents(state: MatchState, params: SimParams): Intent[] {
  const rng = new Rng(state.rng);
  const humans = new Set(state.controllers.map((c) => c.player));
  // Each team thinks with its own difficulty.
  const teams = [0, 1].map((t) => (params.teamSkill?.[t] ? { ...params, ...params.teamSkill[t] } : params));
  const intents = state.players.map((pl, i) => {
    if (humans.has(i) || pl.sentOff) return { ...IDLE };
    const mem = state.ai[i];
    if (state.tick >= mem.nextThink) {
      const p = teams[pl.team];
      if (pl.role === "gk") thinkKeeper(state, i, p, rng);
      else thinkOutfield(state, i, p, rng);
      // Keepers watch all the time; their reaction time applies to shots (see incomingShot).
      mem.nextThink = state.tick + (pl.role === "gk" ? 2 : p.ai.reactionTicks);
    }
    return toIntent(state, i);
  });
  state.rng = rng.state;
  return intents;
}

// --- Turning decisions into buttons ---------------------------------------------------------------

const BUTTON: Record<AiPlan["kind"], "pass" | "shoot" | "lob"> = {
  pass: "pass",
  shot: "shoot",
  lob: "lob",
  volley: "shoot",
  tackle: "shoot",
  slide: "lob",
  dive: "lob",
};

function toIntent(state: MatchState, i: number): Intent {
  const mem = state.ai[i];
  // Running to a spot is steered every tick; only the choice of spot waits for the next decision.
  const move = mem.target ? toward(state.players[i].pos, mem.target, mem.slow) : mem.move;
  const intent: Intent = { ...IDLE, moveX: move.x, moveZ: move.z, sprint: mem.sprint };
  const plan = mem.plan;
  if (!plan) return intent;
  if (state.tick >= plan.releaseAt || !stillMakesSense(state, i, plan)) {
    mem.plan = null;
    return intent;
  }
  if (state.tick >= plan.pressAt) intent[BUTTON[plan.kind]] = true;
  return intent;
}

/** A plan made a moment ago may no longer fit: the ball has moved on. Never press a button in the wrong context. */
function stillMakesSense(state: MatchState, i: number, plan: AiPlan): boolean {
  const owner = state.ball.owner;
  const pl = state.players[i];
  switch (plan.kind) {
    case "pass":
    case "shot":
    case "lob":
      return owner === i;
    case "volley":
      return owner < 0 && state.ball.intendedReceiver === i;
    case "tackle":
    case "slide":
      return owner >= 0 && state.players[owner].team !== pl.team;
    case "dive":
      return owner < 0;
  }
}

/** Run to `spot`, slowing down over the last `slow` metres. */
function goTo(state: MatchState, i: number, spot: Vec2, slow: number): void {
  const mem = state.ai[i];
  mem.target = spot;
  mem.slow = slow;
}

/** Push the stick in direction `dir` (no target). */
function steer(state: MatchState, i: number, dir: Vec2): void {
  const mem = state.ai[i];
  mem.target = null;
  mem.move = dir;
}

function plan(state: MatchState, i: number, kind: AiPlan["kind"], delay: number, hold: number): void {
  state.ai[i].plan = { kind, pressAt: state.tick + delay, releaseAt: state.tick + delay + hold };
}

// --- Outfield players --------------------------------------------------------------------------------

function thinkOutfield(state: MatchState, i: number, params: SimParams, rng: Rng): void {
  const mem = state.ai[i];
  const pl = state.players[i];
  const ball = state.ball;
  // A shot being wound up, or a tackle being telegraphed, is a commitment.
  if (mem.plan && state.tick <= mem.plan.releaseAt) return;
  mem.plan = null;
  mem.sprint = false;
  if (takingRestart(state, i)) return takeRestart(state, i, params, rng);
  const owner = ball.owner;
  if (owner === i) return carry(state, i, params, rng);

  const receiver = ball.intendedReceiver;
  if (receiver === i) {
    // Meet the pass; a ball in the air in its path. A cross in the box is met first time with a header or volley.
    const high = ball.pos.y > params.action.volleyMinHeight || ball.vel.y > 1;
    goTo(state, i, high ? meetInFlight(state, i, params) : ahead(state, 0.25), 1);
    attackCross(state, i, params);
    return;
  }
  const ours =
    owner >= 0
      ? state.players[owner].team === pl.team
      : receiver >= 0 && state.players[receiver].team === pl.team;
  const theirs = owner >= 0 && !ours;
  if (theirs) return defend(state, i, params, rng);
  const nearest = closestToBall(state, pl.team);
  // A loose ball in our own box is dangerous: the two nearest defenders go for it, not just one.
  const danger =
    !ours &&
    inOwnBox(state, pl.team, ball.pos.x, ball.pos.z) &&
    closestTo(state, pl.team, ball.pos, nearest) === i;
  if (!ours && (nearest === i || danger)) {
    // Loose ball: the nearest player goes for it. A cross or lob for an opponent is attacked in the air.
    const high = ball.pos.y > params.action.volleyMinHeight || ball.vel.y > 1;
    const forThem = receiver >= 0 && state.players[receiver].team !== pl.team;
    goTo(
      state,
      i,
      high && forThem
        ? meetInFlight(state, i, params)
        : ahead(state, Math.min(0.6, dist(pl.pos, ball.pos) / 7)),
      1,
    );
    mem.sprint = (danger || dist(pl.pos, ball.pos) > 3) && pl.stamina > 0.3;
    return;
  }
  // Get into shape: in possession, offer the carrier an option or attack the box; out of it, hold the line.
  const spot = ours ? keepOnside(state, pl.team, supportSpot(state, i)) : shapeSpot(state, i, false);
  goTo(state, i, spot, 0.5);
  mem.sprint = dist(pl.pos, spot) > 8 && pl.stamina > 0.6;
}

/**
 * A teammate of the ball carrier: when the ball is out wide in the opponents' half, the forwards attack the near
 * and far post and the nearest midfielder the penalty spot, ready for the cross; otherwise each player moves to the
 * most open spot near its place in the shape, where the carrier can find them.
 */
function supportSpot(state: MatchState, i: number): Vec2 {
  const pl = state.players[i];
  const carrier = state.ball.owner >= 0 ? state.players[state.ball.owner] : null;
  const home = shapeSpot(state, i, true);
  if (!carrier) return home;
  const s = attackSign(state, pl.team);
  const goalX = (s * state.pitch.length) / 2;
  const halfW = state.pitch.width / 2;
  const toGoal = Math.abs(goalX - carrier.pos.x);
  const side = carrier.pos.z >= 0 ? 1 : -1;
  if (toGoal < 45 && Math.abs(carrier.pos.z) > halfW * 0.45) {
    const line = lineOf(state, i);
    const box = state.pitch.penaltyAreaDepth;
    const gw = state.pitch.goalWidth;
    const attackers = state.players
      .map((_, j) => j)
      .filter(
        (j) =>
          state.players[j].team === pl.team &&
          !state.players[j].sentOff &&
          j !== state.ball.owner &&
          lineOf(state, j) === "attack",
      );
    if (line === "attack") {
      // The forward on the ball's side to the near post, the other to the far post.
      const near = attackers.every((j) => j === i || state.players[j].pos.z * side <= pl.pos.z * side);
      return near
        ? { x: goalX - s * box * 0.35, z: side * gw * 0.4 }
        : { x: goalX - s * box * 0.45, z: -side * gw * 0.6 };
    }
    if (
      line === "midfield" &&
      closestTo(state, pl.team, { x: goalX - s * box * 0.7, z: 0 }, state.ball.owner) === i
    )
      return { x: goalX - s * box * 0.7, z: 0 };
  }
  if (dist(home, carrier.pos) > 30) return home;
  // The most open of a few spots around home: space from defenders, and a lane the carrier can pass along.
  let best = home;
  let bestScore = -Infinity;
  for (const [dx, dz] of [
    [0, 0],
    [4, 0],
    [-4, 0],
    [0, 4],
    [0, -4],
  ]) {
    const spot = { x: home.x + dx * s, z: clamp(home.z + dz, -halfW * 0.92, halfW * 0.92) };
    let space = 8;
    let blocked = false;
    for (const o of state.players) {
      if (o.team === pl.team) continue;
      space = Math.min(space, dist(o.pos, spot));
      if (distToSegment(o.pos, carrier.pos, spot) < 1.5) blocked = true;
    }
    const score = space - (blocked ? 5 : 0) + dx * 0.1;
    if (score > bestScore) {
      best = spot;
      bestScore = score;
    }
  }
  return best;
}

/** Meeting a cross in the opponents' box: press shoot just before the ball arrives, for a header or volley. */
function attackCross(state: MatchState, i: number, params: SimParams): void {
  const pl = state.players[i];
  const ball = state.ball;
  const other = pl.team === 0 ? 1 : 0;
  if (ball.pos.y < 0.5 || !inOwnBox(state, other, pl.pos.x, pl.pos.z)) return;
  const speed = Math.sqrt(ball.vel.x * ball.vel.x + ball.vel.z * ball.vel.z);
  const ticks = speed > 1 ? (dist(pl.pos, ball.pos) / speed) * 60 : 99;
  if (ticks > params.action.bufferTicks) return;
  const s = attackSign(state, pl.team);
  steer(state, i, normalize2({ x: (s * state.pitch.length) / 2 - pl.pos.x, z: -pl.pos.z }));
  // Pressed early, the shot waits (up to `bufferTicks`) until the ball is in reach.
  plan(state, i, "volley", 0, 2);
}

/** On the ball: shoot when in range, pass when pressed or a teammate is better placed, otherwise dribble. */
function carry(state: MatchState, i: number, params: SimParams, rng: Rng): void {
  const mem = state.ai[i];
  const pl = state.players[i];
  const ai = params.ai;
  const s = attackSign(state, pl.team);
  const halfL = state.pitch.length / 2;
  const halfW = state.pitch.width / 2;
  const goal = { x: s * halfL, z: 0 };
  const toGoal = normalize2({ x: goal.x - pl.pos.x, z: goal.z - pl.pos.z });
  const goalDist = dist(pl.pos, goal);
  const range = ai.shootRange;

  if (goalDist < range && (Math.abs(pl.pos.z) < halfW * 0.6 || goalDist < range * 0.6)) {
    // Shoot across the keeper, curled towards the far post; never hard enough to balloon it.
    const far = pl.pos.z > 0.3 ? -1 : pl.pos.z < -0.3 ? 1 : rng.next() < 0.5 ? -1 : 1;
    // Sideways stick at release picks the corner and curls the ball (see shoot()); better CPUs go tighter.
    const lateral = clamp(far * s * (0.75 + 0.25 * ai.shotCurl) + (rng.next() * 2 - 1) * ai.aimError, -1, 1);
    const straight = Math.sqrt(1 - lateral * lateral);
    steer(state, i, {
      x: toGoal.x * straight - toGoal.z * lateral,
      z: toGoal.z * straight + toGoal.x * lateral,
    });
    const power = clamp(0.45 + goalDist / (state.pitch.length * 1.2), 0.5, 0.86);
    plan(state, i, "shot", 0, Math.round(power * params.action.shotChargeTicks));
    return;
  }

  // Wide in the final third with a teammate in the box: cross (the lob button crosses from out wide).
  if (goalDist < 30 && Math.abs(pl.pos.z) > halfW * 0.5) {
    const other = pl.team === 0 ? 1 : 0;
    const offside = offsideOn(state);
    const waiting = state.players.some(
      (t, j) =>
        t.team === pl.team &&
        t !== pl &&
        !t.sentOff &&
        inOwnBox(state, other, t.pos.x, t.pos.z) &&
        !(offside && inOffsidePosition(state, j, params)),
    );
    if (waiting && rng.next() < 0.6) {
      steer(state, i, toGoal);
      plan(state, i, "lob", 0, 1);
      return;
    }
  }

  const nearest = nearestOpponent(state, i);
  // Under pressure: closed down from the front.
  const pressure =
    nearest.player !== null &&
    nearest.dist < 2.2 &&
    (nearest.player.pos.x - pl.pos.x) * toGoal.x + (nearest.player.pos.z - pl.pos.z) * toGoal.z > 0;
  const target = bestPassTarget(state, i, pressure, params);
  // `passWillingness` is a chance per second; the CPU decides several times a second.
  const passChance = (ai.passWillingness * params.ai.reactionTicks) / 60;
  if (target && ((pressure && target.score > 0) || (target.score > 1.5 && rng.next() < passChance))) {
    const t = state.players[target.index];
    const dir = normalize2({ x: t.pos.x - pl.pos.x, z: t.pos.z - pl.pos.z });
    const e = (rng.next() * 2 - 1) * ai.aimError;
    steer(state, i, normalize2({ x: dir.x - dir.z * e, z: dir.z + dir.x * e }));
    const wide = Math.abs(pl.pos.z) > halfW * 0.55 && goalDist < halfL * 0.6;
    const inBox = inOwnBox(state, pl.team === 0 ? 1 : 0, t.pos.x, t.pos.z);
    plan(state, i, wide && inBox ? "lob" : "pass", 0, 1);
    return;
  }

  // Dribble at goal, around the nearest defender in the way. A wide player out on the wing goes down the line
  // instead, towards the byline, to cross.
  const downTheLine = isWide(state, i) && Math.abs(pl.pos.z) > halfW * 0.45 && (goal.x - pl.pos.x) * s > 14;
  const aim = downTheLine
    ? normalize2({ x: s * (halfL - 12) - pl.pos.x, z: (pl.pos.z > 0 ? 1 : -1) * halfW * 0.8 - pl.pos.z })
    : toGoal;
  let move = aim;
  if (nearest.player && nearest.dist < 4) {
    const ox = nearest.player.pos.x - pl.pos.x;
    const oz = nearest.player.pos.z - pl.pos.z;
    if (ox * aim.x + oz * aim.z > 0) {
      const away = aim.x * oz - aim.z * ox > 0 ? -1 : 1;
      const k = ((4 - nearest.dist) / 4) * 1.2;
      move = normalize2({ x: aim.x - aim.z * away * k, z: aim.z + aim.x * away * k });
    }
  }
  // Don't dribble out of play.
  if (Math.abs(pl.pos.z) > halfW - 2 && move.z * pl.pos.z > 0) move = normalize2({ x: move.x, z: 0 });
  steer(state, i, move);
  mem.sprint = pl.stamina > 0.4 && nearest.dist > 3 && goalDist > 6;
}

/** Defending: the nearest player presses (and tackles, after a short wind-up); the others hold their shape. */
function defend(state: MatchState, i: number, params: SimParams, rng: Rng): void {
  const mem = state.ai[i];
  const pl = state.players[i];
  const carrier = state.players[state.ball.owner];
  const s = attackSign(state, pl.team);
  const ownGoal = { x: (-s * state.pitch.length) / 2, z: 0 };
  if (presser(state, pl.team, carrier) === i) {
    const d = dist(pl.pos, carrier.pos);
    const toCarrier = normalize2({ x: carrier.pos.x - pl.pos.x, z: carrier.pos.z - pl.pos.z });
    const facing = toCarrier.x * pl.facing.x + toCarrier.z * pl.facing.z;
    // A sensible defender doesn't tackle from behind: that's a foul (docs/specs/10 §6).
    const behind = toCarrier.x * carrier.facing.x + toCarrier.z * carrier.facing.z > 0.3;
    if (d < params.action.tackleRange * 0.9 && facing > 0.5 && !behind) {
      const r = rng.next();
      const ai = params.ai;
      if (r < ai.slideChance) plan(state, i, "slide", ai.telegraphTicks, 1);
      else if (r < ai.slideChance + ai.tackleChance) plan(state, i, "tackle", ai.telegraphTicks, 1);
      steer(state, i, toCarrier);
      return;
    }
    // Close down from the goal side.
    const goalSide = normalize2({ x: ownGoal.x - carrier.pos.x, z: ownGoal.z - carrier.pos.z });
    const spot = { x: carrier.pos.x + goalSide.x * 0.8, z: carrier.pos.z + goalSide.z * 0.8 };
    goTo(state, i, spot, 1);
    mem.sprint = d > 3 && pl.stamina > 0.3;
    return;
  }
  // Mark the attacker nearest my position in the shape, in the passing lane from the ball; fall back to the shape.
  const spot = shapeSpot(state, i, false);
  let mark: PlayerState | null = null;
  let best = 10;
  for (const o of state.players) {
    if (o.team === pl.team || o.role === "gk" || o.sentOff || o === carrier) continue;
    const d = dist(o.pos, spot);
    if (d < best) {
      best = d;
      mark = o;
    }
  }
  if (mark) {
    const goalSide = normalize2({ x: ownGoal.x - mark.pos.x, z: ownGoal.z - mark.pos.z });
    if (dist(mark.pos, ownGoal) < state.pitch.penaltyAreaDepth + 6) {
      // Near our goal: tight, goal side of my man.
      goTo(state, i, { x: mark.pos.x + goalSide.x * 1.2, z: mark.pos.z + goalSide.z * 1.2 }, 0.5);
      mem.sprint = dist(pl.pos, mark.pos) > 4 && pl.stamina > 0.3;
      return;
    }
    // Further out: between the ball and my man, nearer him, and a step goal side: cuts out the pass.
    const lane = {
      x: carrier.pos.x + (mark.pos.x - carrier.pos.x) * 0.75 + goalSide.x,
      z: carrier.pos.z + (mark.pos.z - carrier.pos.z) * 0.75 + goalSide.z,
    };
    goTo(state, i, { x: lane.x * 0.7 + spot.x * 0.3, z: lane.z * 0.7 + spot.z * 0.3 }, 0.5);
  } else {
    goTo(state, i, spot, 0.5);
  }
}

/**
 * Who closes down the ball carrier: the nearest defender, but one who is goal side counts as much closer than one
 * chasing from behind (who can't tackle without fouling), so the carrier always meets someone in front.
 */
function presser(state: MatchState, team: 0 | 1, carrier: PlayerState): number {
  const s = attackSign(state, team);
  let best = -1;
  let bestScore = Infinity;
  state.players.forEach((pl, j) => {
    if (pl.team !== team || pl.role === "gk" || pl.sentOff) return;
    const behind = (pl.pos.x - carrier.pos.x) * s > 0; // further up the pitch than the carrier
    const score = dist(pl.pos, carrier.pos) + (behind ? 6 : 0);
    if (score < bestScore) {
      best = j;
      bestScore = score;
    }
  });
  return best;
}

/** Score the teammates as pass targets: forward progress and space count, a blocked lane rules one out. */
function bestPassTarget(
  state: MatchState,
  i: number,
  pressure: boolean,
  params: SimParams,
): { index: number; score: number } | null {
  const pl = state.players[i];
  const s = attackSign(state, pl.team);
  let best: { index: number; score: number } | null = null;
  const offside = offsideOn(state);
  state.players.forEach((t, j) => {
    if (j === i || t.team !== pl.team || t.sentOff) return;
    if (t.role === "gk" && !(pressure && (pl.pos.x - t.pos.x) * s > 0)) return;
    // Never to a teammate standing offside.
    if (offside && inOffsidePosition(state, j, params)) return;
    const d = dist(pl.pos, t.pos);
    if (d < 4 || d > 25) return;
    let space = 6;
    let blocked = false;
    for (const o of state.players) {
      if (o.team === pl.team) continue;
      space = Math.min(space, dist(o.pos, t.pos));
      if (distToSegment(o.pos, pl.pos, t.pos) < 1.2) blocked = true;
    }
    const progress = (t.pos.x - pl.pos.x) * s;
    const score = progress * 0.25 + space * 0.5 - d * 0.05 - (blocked ? 3 : 0);
    if (!best || score > best.score) best = { index: j, score };
  });
  return best;
}

// --- Restarts -------------------------------------------------------------------------------------

function takingRestart(state: MatchState, i: number): boolean {
  return state.phase.kind === "restart" && state.phase.restart.taker === i;
}

/**
 * A CPU restart (docs/specs/10 §1): set up for a moment, then shoot a penalty or a free kick in range at a
 * corner, cross a corner into the box, and play anything else to the best-placed teammate.
 */
function takeRestart(state: MatchState, i: number, params: SimParams, rng: Rng): void {
  if (state.phase.kind !== "restart") return;
  const r = state.phase.restart;
  const pl = state.players[i];
  steer(state, i, { x: 0, z: 0 });
  if (state.tick - r.since < params.referee.cpuRestartTicks) return;
  const s = attackSign(state, pl.team);
  const halfL = state.pitch.length / 2;
  const goal = { x: s * halfL, z: 0 };
  const range = params.ai.shootRange;
  if (r.aim && (r.kind === "penalty" || (dist(r.spot, goal) < range && Math.abs(r.spot.z) < 4))) {
    // Pick a corner for the aiming marker, then shoot at it.
    const side = rng.next() < 0.5 ? -1 : 1;
    const inside = 0.35 + rng.next() * params.ai.aimError;
    r.aim = { x: goal.x, z: side * (state.pitch.goalWidth / 2 - inside) };
    // Stick centred: it would slide the marker, and the shot goes where the marker is anyway.
    steer(state, i, { x: 0, z: 0 });
    plan(state, i, "shot", 0, Math.round(0.75 * params.action.shotChargeTicks));
    return;
  }
  if (r.kind === "corner") {
    // Cross towards the penalty spot.
    const spot = { x: s * (halfL - state.pitch.penaltySpot), z: 0 };
    steer(state, i, normalize2({ x: spot.x - pl.pos.x, z: spot.z - pl.pos.z }));
    plan(state, i, "lob", 0, 1);
    return;
  }
  const target = bestPassTarget(state, i, false, params);
  const t = target ? state.players[target.index] : null;
  const dir = t ? normalize2({ x: t.pos.x - pl.pos.x, z: t.pos.z - pl.pos.z }) : { x: s, z: 0 };
  steer(state, i, dir);
  plan(state, i, t && dist(pl.pos, t.pos) > 15 ? "lob" : "pass", 0, 1);
}

// --- Goalkeepers ------------------------------------------------------------------------------------

function thinkKeeper(state: MatchState, i: number, params: SimParams, rng: Rng): void {
  const mem = state.ai[i];
  const gk = state.players[i];
  const ball = state.ball;
  const s = attackSign(state, gk.team);
  const goal = { x: (-s * state.pitch.length) / 2, z: 0 };
  const k = params.keeper;
  mem.sprint = false;
  if (mem.plan && state.tick <= mem.plan.releaseAt) return;
  mem.plan = null;
  if (takingRestart(state, i)) return takeRestart(state, i, params, rng);

  if (ball.owner === i) {
    steer(state, i, { x: 0, z: 0 });
    if (state.tick - ball.ownedSince < k.holdTicks) return;
    // Play it out to the most open teammate.
    const target = bestPassTarget(state, i, false, params);
    const t = target ? state.players[target.index] : null;
    const e = (rng.next() * 2 - 1) * params.ai.aimError;
    const dir = t ? normalize2({ x: t.pos.x - gk.pos.x, z: t.pos.z - gk.pos.z }) : { x: s, z: 0 };
    steer(state, i, normalize2({ x: dir.x - dir.z * e, z: dir.z + dir.x * e }));
    plan(state, i, t && dist(gk.pos, t.pos) > 15 ? "lob" : "pass", 0, 1);
    return;
  }

  const shot = incomingShot(state, gk, readShot(state, i, params, rng), params);
  if (shot) {
    const dz = shot.z - gk.pos.z;
    const reachable = Math.abs(dz) <= k.reach * 0.8;
    // Shuffle across first; dive only in the last moment, when running won't get there in time.
    if (!reachable && shot.t * 60 <= k.diveLeadTicks && ball.owner < 0) {
      steer(state, i, { x: 0, z: dz > 0 ? 1 : -1 });
      plan(state, i, "dive", 0, 1);
    } else {
      goTo(state, i, { x: gk.pos.x, z: shot.z }, 0.3);
      mem.sprint = !reachable;
    }
    return;
  }

  // Come and claim a loose ball in the area when nobody else is closer.
  if (ball.owner < 0 && ball.pos.y < 2 && inOwnBox(state, gk.team, ball.pos.x, ball.pos.z)) {
    const mine = dist(gk.pos, ball.pos);
    const others = state.players.some(
      (p, j) => j !== i && p.role !== "gk" && dist(p.pos, ball.pos) < mine * 0.8,
    );
    if (!others) {
      goTo(state, i, ahead(state, 0.2), 1);
      mem.sprint = true;
      return;
    }
  }

  // Narrow the angle: stand on the line from the middle of the goal to the ball, off the line a little.
  const bx = ball.pos.x - goal.x;
  const bz = ball.pos.z - goal.z;
  const bd = Math.sqrt(bx * bx + bz * bz) || 1;
  const off = clamp(bd * 0.12, 0.6, Math.min(2.5, state.pitch.goalAreaDepth));
  const hw = state.pitch.goalWidth / 2 - 0.2;
  const spot = { x: goal.x + (bx / bd) * off, z: clamp(goal.z + (bz / bd) * off, -hw, hw) };
  goTo(state, i, spot, 0.35);
}

/**
 * How keeper `i` reads the latest shot: decided once per shot, varying like a human keeper does (docs/specs/11 §4),
 * so the same shot from the same spot doesn't always end the same way.
 */
function readShot(state: MatchState, i: number, params: SimParams, rng: Rng): ShotRead {
  const mem = state.ai[i];
  const kickedAt = state.ball.kickedAt;
  if (mem.read?.kickedAt !== kickedAt) {
    const v = params.ai.keeperVariation;
    mem.read = {
      kickedAt,
      delay: params.ai.keeperReactionTicks * (1 + (rng.next() * 2 - 1) * v),
      error: (rng.next() * 2 - 1) * v * 1.5,
    };
  }
  return mem.read;
}

/** A loose ball heading for the keeper's goal: when it reaches the keeper, and where (z, height). */
function incomingShot(
  state: MatchState,
  gk: PlayerState,
  read: ShotRead,
  params: SimParams,
): { t: number; z: number; y: number } | null {
  const ball = state.ball;
  if (ball.owner >= 0 || state.tick - ball.kickedAt < read.delay) return null;
  const s = attackSign(state, gk.team);
  const vIn = -ball.vel.x * s; // speed towards this keeper's goal
  if (vIn < 4) return null;
  const t = ((ball.pos.x - gk.pos.x) * s) / vIn;
  if (t <= 0 || t > 1.5) return null;
  // Read the curl, as a keeper watching the ball would: sideways acceleration = magnus × (spin × velocity).
  const curl = params.ball.magnus * (ball.spin.x * ball.vel.y - ball.spin.y * ball.vel.x);
  const z = ball.pos.z + ball.vel.z * t + 0.5 * curl * t * t + read.error;
  const y = ball.pos.y + ball.vel.y * t - 0.5 * params.ball.gravity * t * t;
  if (Math.abs(z) > state.pitch.goalWidth / 2 + 1.5 || y > params.keeper.handHeight + 0.5) return null;
  return { t, z, y };
}

// --- Helpers --------------------------------------------------------------------------------------

/** Where the ball will be in `seconds`, kept on the pitch. */
function ahead(state: MatchState, seconds: number): Vec2 {
  const b = state.ball;
  return {
    x: clamp(b.pos.x + b.vel.x * seconds, -state.pitch.length / 2, state.pitch.length / 2),
    z: clamp(b.pos.z + b.vel.z * seconds, -state.pitch.width / 2, state.pitch.width / 2),
  };
}

/**
 * Where player `i` meets a ball in the air: the point of its path nearest them, while it's still high enough to
 * volley (drag ignored), kept on the pitch.
 */
function meetInFlight(state: MatchState, i: number, params: SimParams): Vec2 {
  const b = state.ball;
  const p = state.players[i].pos;
  const g = params.ball.gravity;
  const disc = b.vel.y * b.vel.y + 2 * g * (b.pos.y - params.action.volleyMinHeight);
  const landing = disc > 0 ? (b.vel.y + Math.sqrt(disc)) / g : 0;
  const v2 = b.vel.x * b.vel.x + b.vel.z * b.vel.z;
  const nearest = v2 > 0 ? ((p.x - b.pos.x) * b.vel.x + (p.z - b.pos.z) * b.vel.z) / v2 : 0;
  const t = clamp(nearest, 0, landing);
  return {
    x: clamp(b.pos.x + b.vel.x * t, -state.pitch.length / 2, state.pitch.length / 2),
    z: clamp(b.pos.z + b.vel.z * t, -state.pitch.width / 2, state.pitch.width / 2),
  };
}

/** Stick direction towards `to`; slows down over the last `slowWithin` metres so players don't overshoot. */
function toward(from: Vec2, to: Vec2, slowWithin: number): Vec2 {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d < 0.15) return { x: 0, z: 0 };
  const k = d < slowWithin ? d / slowWithin : 1;
  return { x: (dx / d) * k, z: (dz / d) * k };
}

function closestToBall(state: MatchState, team: 0 | 1): number {
  return closestTo(state, team, state.ball.pos);
}

/** The outfield player of `team` closest to `p`; humans' players count too, so the CPU doesn't double up. */
function closestTo(state: MatchState, team: 0 | 1, p: Vec2, exclude = -1): number {
  let best = -1;
  let bestDist = Infinity;
  state.players.forEach((pl, j) => {
    if (pl.team !== team || pl.role === "gk" || pl.sentOff || j === exclude) return;
    const d = dist(pl.pos, p);
    if (d < bestDist) {
      best = j;
      bestDist = d;
    }
  });
  return best;
}

function nearestOpponent(state: MatchState, i: number): { player: PlayerState | null; dist: number } {
  const pl = state.players[i];
  let player: PlayerState | null = null;
  let best = Infinity;
  for (const o of state.players) {
    if (o.team === pl.team || o.sentOff) continue;
    const d = dist(o.pos, pl.pos);
    if (d < best) {
      best = d;
      player = o;
    }
  }
  return { player, dist: best };
}

function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const abz = b.z - a.z;
  const lenSq = abx * abx + abz * abz;
  let t = lenSq > 1e-9 ? ((p.x - a.x) * abx + (p.z - a.z) * abz) / lenSq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return dist(p, { x: a.x + abx * t, z: a.z + abz * t });
}

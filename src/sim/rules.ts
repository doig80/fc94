import type { Intent } from "./intent";
import type { SimParams } from "./params";
import { isInGoal } from "./physics/goal";
import { inOwnBox } from "./physics/keeper";
import { placeForKickoff, type MatchState, type RestartKind } from "./state";
import type { Vec2 } from "./vec";

/**
 * The referee (docs/specs/10 §1 and §6), for matches created with `rules`: kick-offs, kick-ins, corners,
 * goal kicks, fouls with advantage, free kicks and penalties, halves and full time. Pure arithmetic on the
 * match state, so it stays deterministic.
 */

function attackSign(state: MatchState, team: 0 | 1): 1 | -1 {
  return (team === 0) === (state.half === 1) ? 1 : -1;
}

/**
 * Goal celebrations, half-time and full time: the match stands still. Returns true while paused
 * (`stepMatch` then only counts the tick).
 */
export function pauseTick(state: MatchState): boolean {
  const phase = state.phase;
  if (phase.kind === "fulltime") return true;
  if (phase.kind !== "goal" && phase.kind !== "halftime") return false;
  if (state.tick + 1 < phase.until) return true;
  if (phase.kind === "goal") {
    // The team that conceded kicks off.
    placeForKickoff(state, phase.team === 0 ? 1 : 0);
  } else {
    state.half = 2;
    state.clock = 0;
    placeForKickoff(state, state.firstKickoff === 0 ? 1 : 0);
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
  if (r.aim) {
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

/** After the tick: was the restart taken, is time up, was there a foul, a goal, or did the ball go out? */
export function referee(state: MatchState, params: SimParams): void {
  const rules = state.rules;
  if (!rules) return;
  const ball = state.ball;
  const phase = state.phase;
  if (phase.kind === "restart" && ball.owner !== phase.restart.taker) state.phase = { kind: "play" };
  if (state.phase.kind !== "play" && state.phase.kind !== "restart") return;

  state.clock++;
  if (state.clock >= rules.halfTicks) {
    const event = state.half === 1 ? "halftime" : "fulltime";
    state.lastEvent = { kind: event, team: 0, tick: state.tick };
    state.phase =
      state.half === 1
        ? { kind: "halftime", until: state.tick + params.referee.halftimeTicks }
        : { kind: "fulltime" };
    return;
  }
  if (state.phase.kind !== "play") return;

  const foul = state.foul;
  state.foul = null;
  if (foul && rules.fouls) {
    const victimTeam = state.players[foul.victim].team;
    const offender = state.players[foul.by].team;
    // Advantage only if the fouled team still has the ball and isn't on the floor.
    const holder = ball.owner >= 0 ? state.players[ball.owner] : null;
    if (holder && holder.team === victimTeam && holder.action.kind !== "stumble") {
      state.lastEvent = { kind: "advantage", team: victimTeam, tick: state.tick };
    } else if (inOwnBox(state, offender, foul.spot.x, foul.spot.z)) {
      const s = attackSign(state, victimTeam);
      const spot = { x: s * (state.pitch.length / 2 - state.pitch.penaltySpot), z: 0 };
      startRestart(state, "penalty", victimTeam, spot, penaltyTaker(state, victimTeam, foul.victim));
      return;
    } else {
      startRestart(state, "freekick", victimTeam, onPitch(state, foul.spot), -1);
      return;
    }
  }

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
  const aim = kind === "freekick" || kind === "penalty" ? { x: s * (state.pitch.length / 2), z: 0 } : null;
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
  state.phase = { kind: "restart", restart: { kind, team, spot, taker: who, since: state.tick, aim } };
  state.lastEvent = { kind, team, tick: state.tick };
  for (const c of state.controllers) {
    if (c.team === team && pl.role !== "gk") c.player = who;
  }
}

/** The fouled player takes the penalty, unless it was the keeper; then the forward does. */
function penaltyTaker(state: MatchState, team: 0 | 1, victim: number): number {
  if (state.players[victim].role !== "gk") return victim;
  const teamSize = state.players.length / 2;
  return team * teamSize + teamSize - 1;
}

function nearestOutfield(state: MatchState, team: 0 | 1, spot: Vec2): number {
  let best = -1;
  let bestDist = Infinity;
  state.players.forEach((p, i) => {
    if (p.team !== team || p.role === "gk") return;
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

/** The match clock as the scoreboard shows it: 45 minutes per half, however long a half really is. */
export function matchMinute(state: MatchState): number {
  const halfTicks = state.rules?.halfTicks ?? 1;
  const inHalf = Math.min(45, Math.floor((state.clock / halfTicks) * 45));
  return inHalf + (state.half === 2 ? 45 : 0);
}

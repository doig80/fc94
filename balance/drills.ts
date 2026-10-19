import {
  aiIntents,
  createMatch,
  IDLE,
  isInGoal,
  Rng,
  stepMatch,
  type Intent,
  type MatchState,
  type SimParams,
} from "../src/sim";
import { PITCH, TEAM_SIZE } from "./match";

/**
 * Exploit bots (docs/specs/11 §4, §6): scripted attackers that try known cheese against the CPU keeper, over and
 * over from slightly different starts. A bot is a script for one player; it presses the same buttons a human would.
 */
export type Bot = (s: MatchState) => Intent;

const L = PITCH.length / 2;
/** Team 0 attacks the goal at +x; the CPU keeper defending it. */
const SHOOTER = TEAM_SIZE - 1;
const PARTNER = TEAM_SIZE - 2;
export const KEEPER = TEAM_SIZE;

/** Team 0's shooter on the ball at `at`, alone with the keeper; everyone else waits out of the way. */
function drill(seed: number, at: { x: number; z: number }, partner?: { x: number; z: number }): MatchState {
  const s = createMatch({ seed, pitch: PITCH, teamSize: TEAM_SIZE, humans: [] });
  s.players.forEach((pl, i) => {
    if (i !== SHOOTER && i !== KEEPER) pl.pos = { x: -L + 2 + i * 1.5, z: PITCH.width / 2 + 1 };
  });
  const sh = s.players[SHOOTER];
  sh.pos = { ...at };
  const to = norm(L - at.x, -at.z);
  sh.facing = to;
  s.ball.pos = { x: at.x + to.x * 0.4, y: s.ball.pos.y, z: at.z + to.z * 0.4 };
  s.ball.owner = SHOOTER;
  s.ball.lastTouch = SHOOTER;
  if (partner) s.players[PARTNER].pos = { ...partner };
  return s;
}

/** How a drill ended: in (straight in, or in after the keeper touched it), saved, or off target. */
export type Outcome = "goal" | "rebound goal" | "saved" | "off target" | "blocked";

/** Run a drill until a goal, the keeper holding the ball, or `ticks` ticks. Bots override the CPU for their player. */
function play(s: MatchState, params: SimParams, bots: Record<number, Bot>, ticks: number): Outcome {
  let keeperTouched = false;
  const cpu = (m: MatchState) => {
    const intents = aiIntents(m, params);
    for (const [i, bot] of Object.entries(bots)) intents[Number(i)] = bot(m);
    return intents;
  };
  for (let t = 0; t < ticks; t++) {
    stepMatch(s, [], params, cpu);
    if (s.ball.lastTouch === KEEPER) keeperTouched = true;
    if (isInGoal(s.ball, s.pitch, params.ball.radius) === 1) return keeperTouched ? "rebound goal" : "goal";
    if (s.ball.owner === KEEPER) return "saved";
    const out = Math.abs(s.ball.pos.x) > L + 0.5 || Math.abs(s.ball.pos.z) > PITCH.width / 2 + 0.5;
    if (out) return keeperTouched ? "saved" : "off target";
  }
  return keeperTouched ? "saved" : "blocked";
}

/** A fixed shot: from `spot`, stick `lateral` (−1 left .. 1 right of the goal) and `power` (0..1). */
export interface Shot {
  spot: { x: number; z: number };
  lateral: number;
  power: number;
}

/**
 * Runs up from a few metres back, gets to the spot and plays exactly the same shot every time: the "golden
 * shot" cheese (FIFA '94 had a diagonal run that nearly always scored). `rng` varies the run-up only.
 */
export function sameShot(shot: Shot, params: SimParams, trials: number, seed = 1): Record<Outcome, number> {
  const rng = new Rng(seed);
  const outcomes: Record<Outcome, number> = {
    goal: 0,
    "rebound goal": 0,
    saved: 0,
    "off target": 0,
    blocked: 0,
  };
  for (let k = 0; k < trials; k++) {
    const back = rng.range(3, 6);
    const angle = rng.range(-0.6, 0.6);
    const start = { x: shot.spot.x - back, z: shot.spot.z + back * angle };
    const s = drill(seed * 1000 + k, start);
    const charge = Math.round(shot.power * params.action.shotChargeTicks);
    let held = -1;
    const bot: Bot = (m) => {
      const pl = m.players[SHOOTER];
      if (m.ball.owner !== SHOOTER && held < 0) return { ...IDLE };
      const to = norm(L - pl.pos.x, -pl.pos.z);
      // Stick: towards goal, turned by `lateral` (positive = towards +z from the shooter's view).
      const aim = { x: to.x - to.z * shot.lateral, z: to.z + to.x * shot.lateral };
      if (held < 0) {
        const dx = shot.spot.x - pl.pos.x;
        const dz = shot.spot.z - pl.pos.z;
        if (dx * dx + dz * dz > 0.25) return { ...IDLE, ...move(norm(dx, dz)) };
        held = 0;
      }
      held++;
      return { ...IDLE, ...move(aim), shoot: held <= charge };
    };
    outcomes[play(s, params, { [SHOOTER]: bot }, 300)]++;
  }
  return outcomes;
}

/**
 * Standing in front of the keeper so a save rebounds in (FIFA '94's famous one): the shooter hits it at the
 * keeper from `dist` metres, the partner waits at `camp` and buries anything that comes loose.
 * Returns the share of shots that went in off the keeper.
 */
export function reboundCamper(
  camp: { x: number; z: number },
  dist: number,
  params: SimParams,
  trials: number,
  seed = 1,
): { rebounds: number; direct: number } {
  const rng = new Rng(seed);
  let rebounds = 0;
  let direct = 0;
  for (let k = 0; k < trials; k++) {
    const at = { x: L - dist - rng.range(0, 2), z: rng.range(-3, 3) };
    const s = drill(seed * 1000 + k, at, { x: L - camp.x, z: camp.z + rng.range(-0.3, 0.3) });
    const power = rng.range(0.6, 0.9);
    const charge = Math.round(power * params.action.shotChargeTicks);
    let held = 0;
    const shooter: Bot = (m) => {
      if (m.ball.owner !== SHOOTER && held === 0) return { ...IDLE };
      held++;
      const pl = m.players[SHOOTER];
      return { ...IDLE, ...move(norm(L - pl.pos.x, -pl.pos.z)), shoot: held <= charge };
    };
    let shooting = 0;
    const partner: Bot = (m) => {
      const pl = m.players[PARTNER];
      const b = m.ball;
      const gk = m.players[KEEPER];
      // Shoot for the side of the goal away from the keeper.
      const side = gk.pos.z > 0 ? -1 : 1;
      const aim = norm(L - pl.pos.x, side * 1.1 - pl.pos.z);
      if (b.owner === PARTNER || shooting > 0) {
        shooting++;
        return { ...IDLE, ...move(aim), shoot: shooting <= 25 };
      }
      const dx = b.pos.x - pl.pos.x;
      const dz = b.pos.z - pl.pos.z;
      const loose = b.owner < 0 && b.lastTouch === KEEPER;
      if (loose && dx * dx + dz * dz < 25) {
        // Go for it; a ball in the air gets a volley or header (shoot as it arrives).
        const near = dx * dx + dz * dz < 2.5 && b.pos.y > 0.4;
        return { ...IDLE, ...move(norm(dx, dz)), sprint: true, shoot: near };
      }
      return { ...IDLE };
    };
    const outcome = play(s, params, { [SHOOTER]: shooter, [PARTNER]: partner }, 300);
    if (outcome === "rebound goal") rebounds++;
    if (outcome === "goal") direct++;
  }
  return { rebounds: rebounds / trials, direct: direct / trials };
}

function norm(x: number, z: number): { x: number; z: number } {
  const d = Math.sqrt(x * x + z * z) || 1;
  return { x: x / d, z: z / d };
}

function move(dir: { x: number; z: number }): Pick<Intent, "moveX" | "moveZ"> {
  return { moveX: dir.x, moveZ: dir.z };
}

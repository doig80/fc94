import { DEFAULT_PARAMS, type PitchSpec, type SimParams } from "./params";
import type { Vec2, Vec3 } from "./vec";

export type Weather = "clear" | "rain" | "snow";
export type Role = "gk" | "outfield";

export interface PlayerState {
  team: 0 | 1;
  role: Role;
  pos: Vec2;
  vel: Vec2;
  /** Unit vector the player is facing. */
  facing: Vec2;
  /** 0..1; sprinting uses it up. */
  stamina: number;
}

export interface BallState {
  pos: Vec3;
  vel: Vec3;
  /** Angular velocity (rad/s); makes the ball curve in the air. */
  spin: Vec3;
  /** Index of the player dribbling the ball, or -1 when it is loose. */
  owner: number;
  /** Index of the last player to touch the ball, or -1. */
  lastTouch: number;
  /** Tick of the last kick (for the kicker's cooldown). */
  lastKickTick: number;
}

/**
 * Everything about a match, as plain data: it can be copied, saved, compared and sent over a network.
 * Team 0 attacks towards +x in the first half.
 */
export interface MatchState {
  tick: number;
  /** Seeded RNG state (see rng.ts). */
  rng: number;
  pitch: PitchSpec;
  weather: Weather;
  score: [number, number];
  half: 1 | 2;
  players: PlayerState[];
  ball: BallState;
}

export interface MatchConfig {
  seed: number;
  pitch: PitchSpec;
  /** Players per team including the goalkeeper. */
  teamSize: number;
  weather?: Weather;
}

/** Kick-off formation for one team, as fractions of the half-length (x) and half-width (z), attacking +x. */
const FORMATIONS: Record<number, [number, number][]> = {
  // 5-a-side: keeper, defender, two wide players, forward.
  5: [
    [-0.95, 0],
    [-0.55, 0],
    [-0.3, -0.5],
    [-0.3, 0.5],
    [-0.08, 0],
  ],
};

export function createMatch(config: MatchConfig, params: SimParams = DEFAULT_PARAMS): MatchState {
  const formation = FORMATIONS[config.teamSize];
  if (!formation) throw new Error(`No formation for ${config.teamSize} players per team`);
  const halfL = config.pitch.length / 2;
  const halfW = config.pitch.width / 2;
  const players: PlayerState[] = [];
  for (const team of [0, 1] as const) {
    const dir = team === 0 ? 1 : -1;
    formation.forEach(([fx, fz], i) => {
      players.push({
        team,
        role: i === 0 ? "gk" : "outfield",
        pos: { x: fx * halfL * dir, z: fz * halfW * dir },
        vel: { x: 0, z: 0 },
        facing: { x: dir, z: 0 },
        stamina: 1,
      });
    });
  }
  return {
    tick: 0,
    rng: config.seed >>> 0,
    pitch: { ...config.pitch },
    weather: config.weather ?? "clear",
    score: [0, 0],
    half: 1,
    players,
    ball: {
      pos: { x: 0, y: params.ball.radius, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      spin: { x: 0, y: 0, z: 0 },
      owner: -1,
      lastTouch: -1,
      lastKickTick: -1000,
    },
  };
}

/** Independent deep copy (snapshots for replays and rollback). */
export function cloneState(state: MatchState): MatchState {
  return structuredClone(state);
}

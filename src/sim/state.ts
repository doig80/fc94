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
  /** Buttons held last tick (bit flags, see `Button`), to detect presses and releases. */
  held: number;
  /** Ticks the shoot button has been held while on the ball, or -1. */
  charge: number;
  /** What the player is busy with; most actions stop normal running for a moment. */
  action: PlayerAction;
  /** A pass or shot asked for just before the ball arrived: played first time on the next touch. */
  queued: QueuedAction | null;
}

/** `recover` is getting up after a slide; `stumble` is losing balance (failed tackle, being tackled). */
export type ActionKind =
  "none" | "tackle" | "slide" | "recover" | "stumble" | "header" | "bicycle" | "volley";

export interface PlayerAction {
  kind: ActionKind;
  /** Ticks left. */
  ticks: number;
  /** Ticks the action lasts in total. */
  total: number;
  /** Direction of a slide or dive. */
  dir: Vec2;
}

export interface QueuedAction {
  kind: "pass" | "shoot";
  /** Tick after which the request expires. */
  until: number;
  /** Stick direction when the button was pressed (aims the pass or shot), or null. */
  dir: Vec2 | null;
}

/** Button bit flags for `PlayerState.held`. */
export const Button = { pass: 1, shoot: 2, lob: 4 } as const;

/** A human player and the footballer they currently control. */
export interface Controller {
  team: 0 | 1;
  player: number;
  /** No automatic switch before this tick (stops the ring jumping around). */
  switchLockUntil: number;
  assists: Assists;
}

/** Help options (docs/specs/11 §3). */
export interface Assists {
  autoSwitch: boolean;
  aimHelp: boolean;
  passLead: boolean;
  autoSprint: boolean;
}

/** Defaults for Normal difficulty (docs/specs/11 §2). */
export const NORMAL_ASSISTS: Assists = {
  autoSwitch: true,
  aimHelp: false,
  passLead: true,
  autoSprint: false,
};

/** A give-and-go in progress: the receiver plays the ball straight back into the passer's run. */
export interface OneTwo {
  passer: number;
  receiver: number;
  until: number;
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
  /** `lastTouch` cannot touch the ball again before this tick (stops a kicker re-trapping their own kick). */
  touchBlockUntil: number;
  /** The teammate a pass is meant for, or -1. */
  intendedReceiver: number;
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
  /** Human players (keyboard, gamepad, touch). Everyone else is run by the AI. */
  controllers: Controller[];
  oneTwo: OneTwo | null;
}

export interface MatchConfig {
  seed: number;
  pitch: PitchSpec;
  /** Players per team including the goalkeeper. */
  teamSize: number;
  weather?: Weather;
  /** Which team each human plays for (default: one human on team 0). */
  humans?: (0 | 1)[];
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
        held: 0,
        charge: -1,
        action: { kind: "none", ticks: 0, total: 0, dir: { x: dir, z: 0 } },
        queued: null,
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
      touchBlockUntil: 0,
      intendedReceiver: -1,
    },
    controllers: (config.humans ?? [0]).map((team) => ({
      team,
      // Start on the most advanced outfield player.
      player: team * formation.length + formation.length - 1,
      switchLockUntil: 0,
      assists: { ...NORMAL_ASSISTS },
    })),
    oneTwo: null,
  };
}

/** Independent deep copy (snapshots for replays and rollback). */
export function cloneState(state: MatchState): MatchState {
  return structuredClone(state);
}

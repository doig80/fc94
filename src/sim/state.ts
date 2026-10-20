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

/**
 * `recover` is getting up after a slide or dive; `stumble` is losing balance (failed tackle, being tackled);
 * `dive` is a goalkeeper diving for a shot.
 */
export type ActionKind =
  "none" | "tackle" | "slide" | "recover" | "stumble" | "header" | "bicycle" | "volley" | "dive";

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

/** What a CPU player is doing between decisions (its reaction time, docs/specs/11 §2). */
export interface AiMemory {
  /** A spot to run to (steered towards every tick), or null to follow `move`. */
  target: Vec2 | null;
  /** Slow down within this distance of `target`. */
  slow: number;
  /** Stick direction when there is no target (dribbling, aiming, diving). */
  move: Vec2;
  sprint: boolean;
  /** Tick of the next decision. */
  nextThink: number;
  /** A button the CPU will press at `pressAt` and let go at `releaseAt` (a tap, a held shot, a wound-up tackle). */
  plan: AiPlan | null;
  /** Keepers: how they read the current shot (`kickedAt` identifies it); it varies from shot to shot. */
  read: ShotRead | null;
}

export interface ShotRead {
  kickedAt: number;
  /** Ticks after the kick before the keeper reacts. */
  delay: number;
  /** How far off (m, across the goal) the keeper's guess of where the shot is going is. */
  error: number;
}

export interface AiPlan {
  /** `volley`: shoot at a ball in the air as it arrives (a volley or header). */
  kind: "pass" | "shot" | "lob" | "volley" | "tackle" | "slide" | "dive";
  pressAt: number;
  releaseAt: number;
}

export type RestartKind = "kickoff" | "kickin" | "corner" | "goalkick" | "freekick" | "penalty";

/** A dead ball waiting to be played (docs/specs/10 §1). */
export interface Restart {
  kind: RestartKind;
  /** The team taking it. */
  team: 0 | 1;
  /** Where the ball sits. */
  spot: Vec2;
  /** The player taking it; they can turn to aim but not run off with the ball. */
  taker: number;
  /** Tick the restart began. */
  since: number;
  /** Free kicks and penalties: the aiming marker on the goal line, moved with the stick (M7). */
  aim: Vec2 | null;
}

/** What the referee says is happening. */
export type Phase =
  | { kind: "play" }
  | { kind: "restart"; restart: Restart }
  | { kind: "goal"; team: 0 | 1; until: number }
  | { kind: "halftime"; until: number }
  | { kind: "fulltime" };

/** The latest thing the referee called, for banners and the HUD. */
export interface MatchEvent {
  kind: RestartKind | "goal" | "foul" | "advantage" | "halftime" | "fulltime";
  /** The team it is for (the scorer, or the team awarded the restart). */
  team: 0 | 1;
  tick: number;
}

/** A foul spotted during this tick's actions, for the referee to rule on. */
export interface Foul {
  by: number;
  victim: number;
  spot: Vec2;
}

export interface Rules {
  /** Ticks in each half (the clock shows 45 minutes per half). */
  halfTicks: number;
  /** Fouls, free kicks and penalties ("no ref" turns them off, docs/specs/10 §6). */
  fouls: boolean;
}

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
  /** Until this tick the kicker's stick still bends, lifts or dips the ball (aftertouch, docs/specs/10 §3). */
  aftertouchUntil: number;
  /** The human controller (index into `controllers`) whose stick steers the ball, or -1. */
  aftertouchBy: number;
  /** That stick at the moment of the kick: pushing on only dips the ball if it's pushed further than this. */
  aftertouchStick: Vec2;
  /** Tick when `owner` took the ball; looser dribbling pushes it ahead a few ticks later. */
  ownedSince: number;
  /** Tick of the last kick (pass, shot, clearance); keepers react to a shot this long after it's struck. */
  kickedAt: number;
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
  /** One per player; used only for players the AI runs. */
  ai: AiMemory[];
  /** The referee: null for free play (the physics tests and sandbox). */
  rules: Rules | null;
  phase: Phase;
  /** Ticks played in the current half. */
  clock: number;
  /** The team that kicked off the first half (the other one kicks off the second). */
  firstKickoff: 0 | 1;
  lastEvent: MatchEvent | null;
  foul: Foul | null;
}

export interface MatchConfig {
  seed: number;
  pitch: PitchSpec;
  /** Players per team including the goalkeeper. */
  teamSize: number;
  weather?: Weather;
  /** Which team each human plays for (default: one human on team 0). */
  humans?: (0 | 1)[];
  /** Play with a referee (restarts, fouls, halves). Off by default: free play for tests and the sandbox. */
  rules?: Rules;
}

/** Kick-off formation for one team, as fractions of the half-length (x) and half-width (z), attacking +x. */
export const FORMATIONS: Record<number, [number, number][]> = {
  // 5-a-side: keeper, defender, two wide players, forward.
  5: [
    [-0.95, 0],
    [-0.55, 0],
    [-0.3, -0.5],
    [-0.3, 0.5],
    [-0.08, 0],
  ],
  // 4-4-2 (docs/specs/10 §1): keeper, back four, midfield four, two forwards. The last one kicks off.
  11: [
    [-0.95, 0],
    [-0.62, -0.62],
    [-0.66, -0.2],
    [-0.66, 0.2],
    [-0.62, 0.62],
    [-0.32, -0.66],
    [-0.36, -0.2],
    [-0.36, 0.2],
    [-0.32, 0.66],
    [-0.1, -0.22],
    [-0.08, 0.12],
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
  const state: MatchState = {
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
      aftertouchUntil: 0,
      aftertouchBy: -1,
      aftertouchStick: { x: 0, z: 0 },
      ownedSince: 0,
      kickedAt: 0,
    },
    controllers: (config.humans ?? [0]).map((team) => ({
      team,
      // Start on the most advanced outfield player.
      player: team * formation.length + formation.length - 1,
      switchLockUntil: 0,
      assists: { ...NORMAL_ASSISTS },
    })),
    oneTwo: null,
    ai: players.map((_, i) => ({
      target: null,
      slow: 1,
      move: { x: 0, z: 0 },
      sprint: false,
      // Teammates spread their first decisions over a few ticks. Both teams use the same schedule: otherwise
      // one side always decides a tick after its opponents and wins more often (found by the balance runs).
      nextThink: i % formation.length,
      plan: null,
      read: null,
    })),
    rules: config.rules ?? null,
    phase: { kind: "play" },
    clock: 0,
    firstKickoff: 0,
    lastEvent: null,
    foul: null,
  };
  if (state.rules) placeForKickoff(state, 0);
  return state;
}

/**
 * Line both teams up for a kick-off by `team` (docs/specs/10 §1): everyone in their own half, the opponents
 * outside the centre circle, and the kicking team's forward on the ball.
 */
export function placeForKickoff(state: MatchState, team: 0 | 1): void {
  const teamSize = state.players.length / 2;
  const formation = FORMATIONS[teamSize];
  const halfL = state.pitch.length / 2;
  const halfW = state.pitch.width / 2;
  const circle = state.pitch.centreCircle + 0.5;
  const taker = team * teamSize + teamSize - 1;
  state.players.forEach((pl, i) => {
    const s = (pl.team === 0) === (state.half === 1) ? 1 : -1;
    const [fx, fz] = formation[i % teamSize];
    let x = fx * halfL * s;
    let z = fz * halfW * s;
    if (pl.team !== team) {
      // Outside the circle.
      const d = Math.sqrt(x * x + z * z);
      if (d < circle) {
        const k = d > 1e-6 ? circle / d : 1;
        x = d > 1e-6 ? x * k : -s * circle;
        z *= k;
      }
    }
    if (i === taker) {
      x = -s * 0.5;
      z = 0;
    }
    pl.pos = { x, z };
    pl.vel = { x: 0, z: 0 };
    pl.facing = { x: s, z: 0 };
    pl.held = 0;
    pl.charge = -1;
    pl.queued = null;
    pl.action = { kind: "none", ticks: 0, total: 0, dir: { x: s, z: 0 } };
  });
  state.ai.forEach((m) => {
    m.plan = null;
    m.target = null;
    m.move = { x: 0, z: 0 };
  });
  const ball = state.ball;
  ball.pos = { x: 0, y: DEFAULT_PARAMS.ball.radius, z: 0 };
  ball.vel = { x: 0, y: 0, z: 0 };
  ball.spin = { x: 0, y: 0, z: 0 };
  ball.owner = taker;
  ball.lastTouch = taker;
  ball.intendedReceiver = -1;
  ball.aftertouchUntil = 0;
  state.oneTwo = null;
  state.phase = {
    kind: "restart",
    restart: { kind: "kickoff", team, spot: { x: 0, z: 0 }, taker, since: state.tick, aim: null },
  };
  state.lastEvent = { kind: "kickoff", team, tick: state.tick };
  for (const c of state.controllers) if (c.team === team) c.player = taker;
}

/** Independent deep copy (snapshots for replays and rollback). */
export function cloneState(state: MatchState): MatchState {
  return structuredClone(state);
}

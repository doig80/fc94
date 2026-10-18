/**
 * Every gameplay constant lives here, so the tuning panel can edit them live (docs/specs/02, Tuning panel).
 * Units: metres, seconds, m/s, m/s², rad/s.
 */
export interface PitchSpec {
  length: number;
  width: number;
  goalWidth: number;
  goalHeight: number;
  goalDepth: number;
}

/** Vertical-slice pitch: 5-a-side (docs/specs/30 §1). */
export const PITCH_5_A_SIDE: PitchSpec = {
  length: 40,
  width: 25,
  goalWidth: 3,
  goalHeight: 2,
  goalDepth: 1.2,
};
/** Full-size pitch for 11 v 11 (docs/specs/10 §1). */
export const PITCH_FULL: PitchSpec = {
  length: 105,
  width: 68,
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalDepth: 2,
};

export interface BallParams {
  /** Collision radius (the ball is drawn larger, see docs/specs/10 §5). */
  radius: number;
  gravity: number;
  /** Quadratic air drag: deceleration = airDrag × speed². */
  airDrag: number;
  /** Curve strength: acceleration = magnus × (spin × velocity). */
  magnus: number;
  /** Fraction of spin lost per second in the air. */
  spinDecay: number;
  /** Fraction of spin lost per second while rolling. */
  groundSpinDecay: number;
  /** Vertical speed kept after a bounce. */
  restitution: number;
  /** Horizontal speed kept after a bounce. */
  bounceFriction: number;
  /** Below this vertical speed the ball stops bouncing and rolls. */
  rollThreshold: number;
  /** Constant rolling deceleration on dry grass. */
  rollingDecel: number;
  /** Extra rolling deceleration proportional to speed (per second). */
  rollingDamping: number;
  /** Speed kept after hitting a post or the crossbar. */
  postRestitution: number;
  /** Speed kept after hitting the net (the net absorbs the ball). */
  netDamping: number;
}

export interface PlayerParams {
  radius: number;
  runSpeed: number;
  sprintSpeed: number;
  /** Top-speed multiplier while dribbling. */
  dribbleSpeedFactor: number;
  accel: number;
  decel: number;
  /** How quickly a player turns to face the movement direction (per second). */
  turnRate: number;
  /** Stamina spent per second of sprinting (stamina runs 0..1). */
  staminaDrain: number;
  staminaRecovery: number;
  /** Players can only start a sprint above this stamina. */
  minSprintStamina: number;
  /** How far players may run beyond the touchlines. */
  boundsMargin: number;
}

export interface DribbleParams {
  /** A player can take the ball when it is this close to them. */
  controlRadius: number;
  /** ...and no higher than this. */
  controlMaxHeight: number;
  /** ...and not moving faster than this relative to them. */
  controlMaxRelSpeed: number;
  /** Distance the ball is kept ahead of the feet. */
  distance: number;
  /** Distance while sprinting (easier to steal). */
  sprintDistance: number;
  /** How firmly the ball follows the feet. */
  stiffness: number;
  /** The kicker cannot touch the ball again for this many ticks. */
  kickCooldownTicks: number;
  /** Control is lost when the ball gets further away than this. */
  loseDistance: number;
}

export interface WeatherParams {
  /** Rolling friction multipliers (docs/specs/10 §5: rain skids, snow slows). */
  rainRollingFactor: number;
  snowRollingFactor: number;
}

export interface SimParams {
  ball: BallParams;
  player: PlayerParams;
  dribble: DribbleParams;
  weather: WeatherParams;
}

export const DEFAULT_PARAMS: SimParams = {
  ball: {
    radius: 0.11,
    gravity: 9.81,
    airDrag: 0.012,
    magnus: 0.025,
    spinDecay: 0.6,
    groundSpinDecay: 4,
    restitution: 0.6,
    bounceFriction: 0.85,
    rollThreshold: 0.6,
    rollingDecel: 2.5,
    rollingDamping: 0.3,
    postRestitution: 0.7,
    netDamping: 0.15,
  },
  player: {
    radius: 0.35,
    runSpeed: 6.5,
    sprintSpeed: 8.5,
    dribbleSpeedFactor: 0.92,
    accel: 18,
    decel: 22,
    turnRate: 10,
    staminaDrain: 0.25,
    staminaRecovery: 0.12,
    minSprintStamina: 0.1,
    boundsMargin: 2,
  },
  dribble: {
    controlRadius: 0.7,
    controlMaxHeight: 0.6,
    controlMaxRelSpeed: 9,
    distance: 0.55,
    sprintDistance: 1.1,
    stiffness: 12,
    kickCooldownTicks: 15,
    loseDistance: 1.6,
  },
  weather: {
    rainRollingFactor: 0.65,
    snowRollingFactor: 1.5,
  },
};

/** Deep copy, so tuning edits never change the defaults. */
export function cloneParams(p: SimParams): SimParams {
  return JSON.parse(JSON.stringify(p)) as SimParams;
}

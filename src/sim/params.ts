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
  /** Penalty area, measured from the goal line (depth) and across the pitch (total width). */
  penaltyAreaDepth: number;
  penaltyAreaWidth: number;
  /** Goal area ("six-yard box"). */
  goalAreaDepth: number;
  goalAreaWidth: number;
  /** Penalty spot distance from the goal line. */
  penaltySpot: number;
  /** Radius of the centre circle; also the radius of the arc ("D") at the edge of the penalty area. */
  centreCircle: number;
}

/**
 * Vertical-slice pitch: 5-a-side (docs/specs/30 §1). The markings are a miniature of the full-size layout,
 * so the penalty spot sits inside the box with a "D" beyond it.
 */
export const PITCH_5_A_SIDE: PitchSpec = {
  length: 40,
  width: 25,
  goalWidth: 3,
  goalHeight: 2,
  goalDepth: 1.2,
  penaltyAreaDepth: 6.5,
  penaltyAreaWidth: 14,
  goalAreaDepth: 2.2,
  goalAreaWidth: 6.5,
  penaltySpot: 4.5,
  centreCircle: 3.5,
};
/** Full-size pitch for 11 v 11 (docs/specs/10 §1), standard markings. */
export const PITCH_FULL: PitchSpec = {
  length: 105,
  width: 68,
  goalWidth: 7.32,
  goalHeight: 2.44,
  goalDepth: 2,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  penaltySpot: 11,
  centreCircle: 9.15,
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

export interface ActionParams {
  /** A ground pass is hit so it still has this speed when it reaches the receiver. */
  passArrivalSpeed: number;
  passMinSpeed: number;
  passMaxSpeed: number;
  /** Teammates within this cone (cosine of the half-angle) of the aim direction are pass candidates. */
  passConeCos: number;
  /** Pass-lead assist: how far ahead of a running receiver to aim (1 = exactly where they'll be). */
  passLead: number;
  /** Through balls lead the receiver this much more. */
  throughLead: number;
  /** Upward speed of a lob and of a cross. */
  lobLift: number;
  crossLift: number;
  /** Lofted balls are hit a bit harder to make up for air drag. */
  loftDragComp: number;
  /** Shoot button: ticks to reach full power. */
  shotChargeTicks: number;
  shotMinSpeed: number;
  shotMaxSpeed: number;
  shotMinLift: number;
  shotMaxLift: number;
  /** Above this power the shot rises extra (risk of going over the bar). */
  overpowerAt: number;
  overpowerLift: number;
  /** Spin from steering sideways at the moment of the shot. */
  curlSpin: number;
  /** A curled shot is aimed this far outside the target so the curl brings it back. */
  curlAimOffset: number;
  /** Power of first-time shots, volleys and headers. */
  contextShotPower: number;
  /** A ball this close and this high can be headed or volleyed. */
  contactReach: number;
  volleyMinHeight: number;
  headerMinHeight: number;
  headerMaxHeight: number;
  /** How long buttons pressed just before the ball arrives are remembered (first-time passes and shots). */
  bufferTicks: number;
  /** A second pass press within this many ticks starts a one-two. */
  oneTwoWindowTicks: number;
  oneTwoRunTicks: number;
  /** Standing tackle. */
  tackleRange: number;
  tackleSuccess: number;
  tackleTicks: number;
  /** Ball speed when a tackle pokes it away. */
  tacklePokeSpeed: number;
  stumbleTicks: number;
  /** Slide tackle. */
  slideTicks: number;
  slideSpeed: number;
  slideReach: number;
  slideKnockSpeed: number;
  slideRecoveryTicks: number;
  /** Buttons act as attacking buttons when the ball is loose and this close. */
  attackContextRadius: number;
  /** Auto-switch only when another teammate is this much closer to the ball. */
  switchHysteresis: number;
  switchLockTicks: number;
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
  action: ActionParams;
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
  action: {
    // 8 m/s meets the feel target in docs/specs/10 §8: 10 m in ≤ 1 s, 20 m in ≤ 2 s.
    passArrivalSpeed: 8,
    passMinSpeed: 7,
    passMaxSpeed: 24,
    passConeCos: 0.45,
    passLead: 0.8,
    throughLead: 1.4,
    lobLift: 8,
    crossLift: 6.5,
    loftDragComp: 1.12,
    shotChargeTicks: 45,
    shotMinSpeed: 17,
    shotMaxSpeed: 31,
    shotMinLift: 1,
    shotMaxLift: 4,
    overpowerAt: 0.92,
    // With the 2 m small-sided goals, an overpowered shot from 8 m or further clears the bar.
    overpowerLift: 5.5,
    curlSpin: 14,
    curlAimOffset: 1.2,
    contextShotPower: 0.6,
    contactReach: 1.4,
    volleyMinHeight: 0.45,
    headerMinHeight: 1.2,
    headerMaxHeight: 2.6,
    bufferTicks: 18,
    oneTwoWindowTicks: 20,
    oneTwoRunTicks: 120,
    tackleRange: 1.4,
    tackleSuccess: 0.6,
    tackleTicks: 18,
    tacklePokeSpeed: 4,
    stumbleTicks: 24,
    slideTicks: 30,
    slideSpeed: 9,
    slideReach: 0.9,
    slideKnockSpeed: 8,
    slideRecoveryTicks: 24,
    attackContextRadius: 3.5,
    switchHysteresis: 2.5,
    switchLockTicks: 20,
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

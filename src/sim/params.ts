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
  /**
   * Radius the ball is drawn with: larger than life so it is easy to follow. The goal frame collides with
   * the ball as drawn, so a shot that looks like it clips the post does hit it.
   */
  drawRadius: number;
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
  /** An opponent in a pass's path can cut it out at this many times `controlMaxRelSpeed` (passes only). */
  interceptFactor: number;
  /** A defender in their own area heads a high ball clear when it comes this close (see physics/clearance.ts). */
  clearReach: number;
  /** Speed and upward speed of that clearance. */
  clearSpeed: number;
  clearLift: number;
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
  /**
   * 0 = the ball sticks to the feet; up to 1 = it is pushed ahead in touches and has to be run onto
   * (Kick Off style, docs/specs/10 §5). Loose touches are easier to steal.
   */
  looseness: number;
  /** Extra speed of a touch ahead at full looseness. */
  touchBoost: number;
  /** Ticks of carrying the ball before the next touch ahead. */
  touchDelayTicks: number;
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
  /** A cross to a teammate comes down this far beyond them, so it reaches them at volley height. */
  crossBeyond: number;
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
  /** Full-power shots are harder to place: a random miss of up to this many metres at the goal line, from 60% up. */
  powerShotSpread: number;
  /** Spin from steering sideways at the moment of the shot. */
  curlSpin: number;
  /** A curled shot is aimed outside its target by this many times the curl it will pick up, so it bends back in. */
  curlAimOffset: number;
  /** Power of first-time shots, volleys and headers. */
  contextShotPower: number;
  /**
   * A first-time shot, volley or header struck within this many ticks of pressing Shoot is "Perfect" (M4): it
   * gets `perfectBonus` more power.
   */
  perfectTicks: number;
  perfectBonus: number;
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
  /** Aftertouch on (1) or off (0): just after a shot the stick still bends, lifts or dips the ball. */
  aftertouch: number;
  /** How long aftertouch lasts after the kick. */
  aftertouchTicks: number;
  /** Spin added per second by steering sideways at full stick. */
  aftertouchSwerve: number;
  /** Upward (pull back) or downward (push on) acceleration at full stick. */
  aftertouchLift: number;
}

export interface KeeperParams {
  /** How far a keeper's hands reach from the body, standing. */
  reach: number;
  /** Highest ball a keeper can reach with a jump. */
  handHeight: number;
  /** Fastest shot a keeper can hold; harder ones are parried or tipped over. */
  catchSpeed: number;
  /** Speed at the start of a dive. */
  diveSpeed: number;
  diveTicks: number;
  /** A keeper dives when the shot is this close to arriving; before that they move across on their feet. */
  diveLeadTicks: number;
  /** Getting up after a dive. */
  recoverTicks: number;
  /** Speed kept by a parried ball (it always goes wide, never back towards the goal). */
  parryKeep: number;
  /** How much a parry pushes the ball out in front as well as wide (0 = along the goal line). */
  parryOut: number;
  /** How long the keeper holds a caught ball before playing it. */
  holdTicks: number;
}

/** CPU behaviour (docs/specs/11). Defaults are Normal; Easy and Hard override some (ai/difficulty.ts). */
export interface AiParams {
  /** Ticks between decisions: the CPU's reaction time. */
  reactionTicks: number;
  /** How long after a shot is struck the keeper reacts to it. */
  keeperReactionTicks: number;
  /**
   * How much a keeper varies from shot to shot, like a human (0 = a robot): the reaction time changes by up to
   * this share, and the read of where the shot is going is off by up to 1.5 m times this.
   */
  keeperVariation: number;
  /** Random error in CPU passes and shots (0 = perfect). */
  aimError: number;
  /** Chance per decision that a CPU defender in range goes for a standing tackle. */
  tackleChance: number;
  /** Chance per decision of a slide tackle instead. */
  slideChance: number;
  /** Ticks a CPU defender winds up before tackling, so humans can react (docs/specs/11 §4: readable). */
  telegraphTicks: number;
  /** The CPU shoots from closer than this to the goal (m). */
  shootRange: number;
  /** How tightly the CPU places curled shots into the far corner (0..1). */
  shotCurl: number;
  /** How willing the CPU is to pass to a better-placed teammate rather than keep dribbling (chance per second). */
  passWillingness: number;
  /**
   * How far (m) a CPU player can misjudge the offside line, running and passing (0 = always reads it right). Each
   * player's read of the line is off by up to this much either way, and changes every
   * `lineReadTicks`: a forward who reads it too far forward runs offside, a passer who does plays him in.
   */
  lineMisread: number;
  lineReadTicks: number;
}

/** The referee's timings (docs/specs/10 §1, §6). */
export interface RefereeParams {
  /** A human's restart is taken for them (a short pass) after this long. */
  autoRestartTicks: number;
  /** The CPU takes its restarts after this long. */
  cpuRestartTicks: number;
  /** Pause after a goal before the kick-off. */
  goalPauseTicks: number;
  /** Pause at half-time. */
  halftimeTicks: number;
  /** Chance that a missed standing tackle is a foul (a tackle from behind always is). */
  foulOnMiss: number;
  /** How fast the stick moves the free-kick and penalty aiming marker. */
  aimSpeed: number;
  /** How fast the stick moves the corner's aiming marker around the box. */
  cornerAimSpeed: number;
  /** Offside only when this far beyond the line: level, or nearly, is onside (the benefit of the doubt). */
  offsideMargin: number;
  /**
   * A foul on a player through on goal (on the ball, this close to goal, no defender goal side but the keeper) is
   * a red card, or a yellow if it gives away a penalty.
   */
  clearRunDistance: number;
  /** Each half of extra time, as a share of a normal half (15 of 45 minutes). */
  extraTimeShare: number;
  /** Pause between the kicks of a penalty shoot-out. */
  shootoutBreakTicks: number;
  /** A shoot-out kick that hasn't gone in after this long has missed. */
  shootoutKickTicks: number;
}

/**
 * Game feel ("juice", docs/specs/10 §7): presentation only, the simulation never reads these. They live here so
 * the tuning panel can adjust them with everything else.
 */
export interface JuiceParams {
  /** A kick at least this fast counts as a power shot. */
  powerShotSpeed: number;
  /** The picture freezes for a moment on a power shot and on a goal (hit-stop). */
  hitStopShotTicks: number;
  hitStopGoalTicks: number;
  /** Camera kick strength (0 = off). */
  shake: number;
  /** How far the net bulges when the ball hits it (0 = off). */
  netRipple: number;
  /** Trail behind fast balls: on (1) or off (0). */
  trail: number;
  /**
   * How fast the whole game runs, players, ball and clock together (1 = normal). Like the game-speed option in
   * arcade football games; the simulation itself is unchanged, it just runs at a slower or faster real-time pace.
   */
  gameSpeed: number;
}

export interface WeatherParams {
  /** Rolling friction multipliers (docs/specs/10 §5: rain skids, snow slows). */
  rainRollingFactor: number;
  snowRollingFactor: number;
}

/** What difficulty changes (docs/specs/11 §2): how the AI decides and how sharp the keeper is. */
export interface Skill {
  ai: AiParams;
  keeper: KeeperParams;
}

export interface SimParams {
  ball: BallParams;
  player: PlayerParams;
  dribble: DribbleParams;
  action: ActionParams;
  keeper: KeeperParams;
  ai: AiParams;
  referee: RefereeParams;
  juice: JuiceParams;
  weather: WeatherParams;
  /**
   * A team's own AI and keeper values where they differ from `ai` and `keeper` (null: those). Difficulty is
   * the CPU team's, so the humans' teammates and keeper keep playing at Normal (see `applyDifficulty`).
   */
  teamSkill?: [Skill | null, Skill | null];
}

/** The AI and keeper values `team` plays with. */
export function skill(params: SimParams, team: 0 | 1): Skill {
  return params.teamSkill?.[team] ?? params;
}

export const DEFAULT_PARAMS: SimParams = {
  ball: {
    radius: 0.11,
    drawRadius: 0.18,
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
    interceptFactor: 1.6,
    clearReach: 1.4,
    clearSpeed: 16,
    clearLift: 6,
    distance: 0.55,
    sprintDistance: 1.1,
    stiffness: 12,
    kickCooldownTicks: 15,
    loseDistance: 1.6,
    looseness: 0,
    touchBoost: 4,
    touchDelayTicks: 8,
  },
  action: {
    // 9 m/s keeps 9 in 10 short passes in CPU matches under 1 s (docs/specs/10 §8: 10 m in ≤ 1 s, 20 m in ≤ 2 s).
    passArrivalSpeed: 9,
    passMinSpeed: 7,
    passMaxSpeed: 24,
    passConeCos: 0.45,
    passLead: 0.8,
    throughLead: 1.4,
    lobLift: 8,
    crossLift: 6.5,
    crossBeyond: 3,
    loftDragComp: 1.12,
    shotChargeTicks: 45,
    shotMinSpeed: 17,
    shotMaxSpeed: 31,
    shotMinLift: 1,
    shotMaxLift: 4,
    overpowerAt: 0.92,
    // With the 2 m small-sided goals, an overpowered shot from 8 m or further clears the bar (as drawn).
    overpowerLift: 6.5,
    powerShotSpread: 1.4,
    curlSpin: 14,
    curlAimOffset: 1,
    contextShotPower: 0.6,
    perfectTicks: 6,
    perfectBonus: 0.25,
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
    aftertouch: 1,
    aftertouchTicks: 15,
    aftertouchSwerve: 90,
    aftertouchLift: 20,
  },
  keeper: {
    reach: 0.66,
    handHeight: 2.5,
    catchSpeed: 18,
    diveSpeed: 7.5,
    diveTicks: 24,
    diveLeadTicks: 18,
    recoverTicks: 30,
    parryKeep: 0.35,
    parryOut: 0.45,
    holdTicks: 60,
  },
  ai: {
    reactionTicks: 10,
    keeperReactionTicks: 12,
    keeperVariation: 0.2,
    aimError: 0.15,
    tackleChance: 0.25,
    slideChance: 0.05,
    telegraphTicks: 6,
    shootRange: 22,
    shotCurl: 0.4,
    passWillingness: 0.35,
    lineMisread: 2.5,
    lineReadTicks: 120,
  },
  referee: {
    autoRestartTicks: 180,
    cpuRestartTicks: 45,
    goalPauseTicks: 180,
    halftimeTicks: 180,
    foulOnMiss: 0.3,
    aimSpeed: 2.5,
    cornerAimSpeed: 9,
    offsideMargin: 0.2,
    clearRunDistance: 30,
    extraTimeShare: 1 / 3,
    shootoutBreakTicks: 120,
    shootoutKickTicks: 150,
  },
  juice: {
    powerShotSpeed: 24,
    hitStopShotTicks: 4,
    hitStopGoalTicks: 6,
    shake: 1,
    netRipple: 1,
    trail: 1,
    gameSpeed: 1,
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

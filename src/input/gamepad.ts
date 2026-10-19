import { IDLE, type Intent } from "../sim";
import { screenToPitch } from "./keyboard";

/**
 * Gamepad controls (docs/specs/10 §3), for Xbox, PlayStation and most standard pads. Browsers report pads in the
 * W3C "standard" layout; these are its button numbers (Xbox names, PlayStation in the comments).
 */
export const PAD = {
  a: 0, // ✕
  b: 1, // ○
  x: 2, // □
  y: 3, // △
  lb: 4, // L1
  rb: 5, // R1
  lt: 6, // L2
  rt: 7, // R2
  back: 8, // Share / Create
  start: 9, // Options
  up: 12,
  down: 13,
  left: 14,
  right: 15,
} as const;

/** Stick travel ignored around the centre, so a worn stick doesn't drift the player. */
export const DEADZONE = 0.2;

/** What the mapping needs from a pad; a browser `Gamepad` fits. */
export interface PadState {
  readonly axes: readonly number[];
  readonly buttons: readonly { readonly pressed: boolean; readonly value: number }[];
}

function held(pad: PadState, i: number, threshold = 0.5): boolean {
  const b = pad.buttons[i];
  return b !== undefined && (b.pressed || b.value > threshold);
}

/**
 * One pad as an intent: left stick (or d-pad) to run, A pass, B shoot, X lob, RT sprint (RB too, for pads
 * without analogue triggers). The stick is analogue: a half tilt jogs, and its direction is exact, which gives
 * finer aiming and curl than the keyboard's eight directions.
 */
export function padIntent(pad: PadState, cameraYaw: number): Intent {
  let sx = pad.axes[0] ?? 0;
  let sy = -(pad.axes[1] ?? 0); // the stick's y axis points down
  const mag = Math.hypot(sx, sy);
  if (mag < DEADZONE) {
    sx = (held(pad, PAD.right) ? 1 : 0) - (held(pad, PAD.left) ? 1 : 0);
    sy = (held(pad, PAD.up) ? 1 : 0) - (held(pad, PAD.down) ? 1 : 0);
  } else {
    // Rescale so the stick still reaches full speed just past the deadzone's edge.
    const k = Math.min(1, (mag - DEADZONE) / (1 - DEADZONE)) / mag;
    sx *= k;
    sy *= k;
  }
  const move = sx === 0 && sy === 0 ? { x: 0, z: 0 } : screenToPitch(sx, sy, cameraYaw);
  return {
    ...IDLE,
    moveX: move.x,
    moveZ: move.z,
    sprint: held(pad, PAD.rt, 0.3) || held(pad, PAD.rb),
    pass: held(pad, PAD.a),
    shoot: held(pad, PAD.b),
    lob: held(pad, PAD.x),
  };
}

/** Keyboard and pad together: whichever is pushed further steers, and a button on either counts. */
export function combine(a: Intent, b: Intent): Intent {
  const steer = Math.hypot(b.moveX, b.moveZ) > Math.hypot(a.moveX, a.moveZ) ? b : a;
  return {
    moveX: steer.moveX,
    moveZ: steer.moveZ,
    sprint: a.sprint || b.sprint,
    pass: a.pass || b.pass,
    shoot: a.shoot || b.shoot,
    lob: a.lob || b.lob,
  };
}

/**
 * Reads the first connected pad. Browsers are polled each frame, so a pad can be plugged in or out at any time
 * (most only show a pad once one of its buttons has been pressed).
 */
export class GamepadInput {
  private before = new Set<number>();

  constructor(
    private readonly source: () => readonly (PadState | null)[] = () =>
      typeof navigator.getGamepads === "function" ? navigator.getGamepads() : [],
  ) {}

  private pad(): PadState | null {
    for (const p of this.source()) {
      if (p && (p as { connected?: boolean }).connected !== false) return p;
    }
    return null;
  }

  connected(): boolean {
    return this.pad() !== null;
  }

  /** The pad as an intent, or null with no pad. */
  read(cameraYaw: number): Intent | null {
    const pad = this.pad();
    return pad ? padIntent(pad, cameraYaw) : null;
  }

  /** Buttons that went down since the last call (Start to pause, and so on). Call once a frame. */
  pressed(): Set<number> {
    const pad = this.pad();
    const now = new Set<number>();
    pad?.buttons.forEach((_, i) => {
      if (held(pad, i)) now.add(i);
    });
    const fresh = new Set([...now].filter((i) => !this.before.has(i)));
    this.before = now;
    return fresh;
  }
}

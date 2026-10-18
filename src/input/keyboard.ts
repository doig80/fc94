import { IDLE, type Intent } from "../sim";

/** Key bindings (docs/specs/10 §3). Codes are physical keys, so they work on any keyboard layout. */
export interface KeyMap {
  up: string;
  down: string;
  left: string;
  right: string;
  pass: string;
  shoot: string;
  lob: string;
  sprint: string;
}

export const P1_KEYS: KeyMap = {
  up: "KeyW",
  down: "KeyS",
  left: "KeyA",
  right: "KeyD",
  pass: "KeyJ",
  shoot: "KeyK",
  lob: "KeyL",
  sprint: "Space",
};

/** Second keyboard player (local multiplayer, Alpha). */
export const P2_KEYS: KeyMap = {
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
  pass: "Numpad1",
  shoot: "Numpad2",
  lob: "Numpad3",
  sprint: "Numpad0",
};

/**
 * Turn a screen direction (right = +sx, up = +sy) into a pitch direction, for a camera looking along
 * `yaw` (radians, in the x–z plane). "Up" always means "away from the camera".
 */
export function screenToPitch(sx: number, sy: number, yaw: number): { x: number; z: number } {
  const fx = Math.cos(yaw);
  const fz = Math.sin(yaw);
  return { x: fx * sy + fz * sx, z: fz * sy - fx * sx };
}

/** Reads the keyboard into an intent each tick. */
export class KeyboardInput {
  private readonly down = new Set<string>();
  private readonly codes: Set<string>;
  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (!this.codes.has(e.code)) return;
    e.preventDefault();
    this.down.add(e.code);
  };
  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.down.delete(e.code);
  };
  // Releasing keys while the window is in the background would otherwise leave them stuck.
  private readonly onBlur = () => this.down.clear();

  constructor(
    private readonly target: Window,
    private readonly keys: KeyMap = P1_KEYS,
  ) {
    this.codes = new Set(Object.values(keys));
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  read(cameraYaw: number): Intent {
    const k = this.keys;
    const sx = (this.down.has(k.right) ? 1 : 0) - (this.down.has(k.left) ? 1 : 0);
    const sy = (this.down.has(k.up) ? 1 : 0) - (this.down.has(k.down) ? 1 : 0);
    const move = sx === 0 && sy === 0 ? { x: 0, z: 0 } : screenToPitch(sx, sy, cameraYaw);
    return {
      ...IDLE,
      moveX: move.x,
      moveZ: move.z,
      sprint: this.down.has(k.sprint),
      pass: this.down.has(k.pass),
      shoot: this.down.has(k.shoot),
      lob: this.down.has(k.lob),
    };
  }

  dispose(): void {
    this.target.removeEventListener("keydown", this.onKeyDown);
    this.target.removeEventListener("keyup", this.onKeyUp);
    this.target.removeEventListener("blur", this.onBlur);
  }
}

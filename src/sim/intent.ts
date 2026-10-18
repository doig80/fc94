/**
 * What one player wants to do this tick. Keyboard, gamepad, touch and AI all produce intents,
 * so the simulation treats humans and CPU players identically (docs/specs/11 §5).
 */
export interface Intent {
  /** Desired movement, each axis in -1..1 (x along the pitch, z across). */
  moveX: number;
  moveZ: number;
  sprint: boolean;
  /** Action buttons A / B / C (docs/specs/10 §3). Meaning depends on possession. */
  pass: boolean;
  shoot: boolean;
  lob: boolean;
}

export const IDLE: Readonly<Intent> = Object.freeze({
  moveX: 0,
  moveZ: 0,
  sprint: false,
  pass: false,
  shoot: false,
  lob: false,
});

export function idleIntents(count: number): Intent[] {
  return Array.from({ length: count }, () => ({ ...IDLE }));
}

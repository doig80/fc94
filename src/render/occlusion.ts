/** Plain-number geometry for deciding which parts of the stadium hide the play from the camera. */

export interface XYZ {
  x: number;
  y: number;
  z: number;
}

export interface Box {
  min: XYZ;
  max: XYZ;
}

export interface CameraView {
  eye: XYZ;
  target: XYZ;
  /** Vertical field of view in radians. */
  fov: number;
  /** Width / height of the canvas. */
  aspect: number;
}

/** Grid of sight lines across the screen (SAMPLES × SAMPLES). */
const SAMPLES = 9;
/** Sight lines aim at roughly head height, so a roof that hides a player's head counts. */
const AIM_HEIGHT = 1.5;

/**
 * Which boxes hide part of the playing area (|x| ≤ halfX, |z| ≤ halfZ) from the camera. Sight lines are cast
 * through a grid of points across the whole screen; a box hides the play when one of the lines that lands on
 * the playing area passes through it on the way.
 */
export function boxesHidingPlay(view: CameraView, boxes: Box[], halfX: number, halfZ: number): boolean[] {
  const hidden = boxes.map(() => false);
  const forward = normalize(sub(view.target, view.eye));
  let right = cross({ x: 0, y: 1, z: 0 }, forward);
  right = length(right) < 1e-6 ? { x: 1, y: 0, z: 0 } : normalize(right);
  const up = cross(forward, right);
  const ty = Math.tan(view.fov / 2);
  const tx = ty * view.aspect;
  for (let i = 0; i < SAMPLES; i++) {
    for (let j = 0; j < SAMPLES; j++) {
      const sx = (2 * i) / (SAMPLES - 1) - 1;
      const sy = (2 * j) / (SAMPLES - 1) - 1;
      const dir = {
        x: forward.x + right.x * sx * tx + up.x * sy * ty,
        y: forward.y + right.y * sx * tx + up.y * sy * ty,
        z: forward.z + right.z * sx * tx + up.z * sy * ty,
      };
      if (dir.y >= 0) continue; // above the horizon
      const t = (AIM_HEIGHT - view.eye.y) / dir.y;
      if (t <= 0) continue;
      const gx = view.eye.x + dir.x * t;
      const gz = view.eye.z + dir.z * t;
      if (Math.abs(gx) > halfX || Math.abs(gz) > halfZ) continue; // lands in the stands, not on the pitch
      boxes.forEach((box, k) => {
        if (!hidden[k] && segmentHitsBox(view.eye, dir, t, box)) hidden[k] = true;
      });
    }
  }
  return hidden;
}

/** Does the segment origin + dir·s, s ∈ [0, maxS], pass through the box? (Slab test.) */
export function segmentHitsBox(origin: XYZ, dir: XYZ, maxS: number, box: Box): boolean {
  let lo = 0;
  let hi = maxS;
  for (const axis of ["x", "y", "z"] as const) {
    const o = origin[axis];
    const d = dir[axis];
    if (Math.abs(d) < 1e-9) {
      if (o < box.min[axis] || o > box.max[axis]) return false;
      continue;
    }
    let s0 = (box.min[axis] - o) / d;
    let s1 = (box.max[axis] - o) / d;
    if (s0 > s1) [s0, s1] = [s1, s0];
    if (s0 > lo) lo = s0;
    if (s1 < hi) hi = s1;
    if (lo > hi) return false;
  }
  return true;
}

function sub(a: XYZ, b: XYZ): XYZ {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: XYZ, b: XYZ): XYZ {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function length(a: XYZ): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

function normalize(a: XYZ): XYZ {
  const l = length(a) || 1;
  return { x: a.x / l, y: a.y / l, z: a.z / l };
}

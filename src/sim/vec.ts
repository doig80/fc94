/** Pitch-plane vector: x runs along the pitch length, z across it. */
export interface Vec2 {
  x: number;
  z: number;
}

/** World vector: y is up. Same axes as the renderer. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export function length2(v: Vec2): number {
  return Math.sqrt(v.x * v.x + v.z * v.z);
}

export function length3(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/** Unit vector in the same direction, or `fallback` for a zero vector. */
export function normalize2(v: Vec2, fallback: Vec2 = { x: 1, z: 0 }): Vec2 {
  const l = length2(v);
  return l > 1e-9 ? { x: v.x / l, z: v.z / l } : { x: fallback.x, z: fallback.z };
}

export function cross3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

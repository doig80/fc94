import type { BallParams, PitchSpec } from "../params";
import type { BallState } from "../state";
import type { Vec3 } from "../vec";

const POST_RADIUS = 0.06;

type Axis = "x" | "y" | "z";

/** An axis-aligned rectangle of net: `axis` is its normal, the other two axes are bounded. */
interface NetPanel {
  axis: Axis;
  at: number;
  bounds: Partial<Record<Axis, [number, number]>>;
}

/** Posts, crossbar and net of both goals. Goals sit on the goal lines at x = ±length/2. */
export function collideGoals(ball: BallState, prev: Vec3, pitch: PitchSpec, p: BallParams): void {
  for (const side of [-1, 1]) {
    const gx = (side * pitch.length) / 2;
    const hw = pitch.goalWidth / 2;
    const h = pitch.goalHeight;
    // Posts (vertical) and crossbar (horizontal).
    collideSegment(ball, { x: gx, y: 0, z: -hw }, { x: gx, y: h, z: -hw }, p);
    collideSegment(ball, { x: gx, y: 0, z: hw }, { x: gx, y: h, z: hw }, p);
    collideSegment(ball, { x: gx, y: h, z: -hw }, { x: gx, y: h, z: hw }, p);

    const back = gx + side * pitch.goalDepth;
    const xr: [number, number] = side > 0 ? [gx, back] : [back, gx];
    const panels: NetPanel[] = [
      { axis: "x", at: back, bounds: { y: [0, h], z: [-hw, hw] } },
      { axis: "y", at: h, bounds: { x: xr, z: [-hw, hw] } },
      { axis: "z", at: -hw, bounds: { x: xr, y: [0, h] } },
      { axis: "z", at: hw, bounds: { x: xr, y: [0, h] } },
    ];
    for (const panel of panels) collideNet(ball, prev, panel, p);
  }
}

/** Bounce off a cylinder of radius POST_RADIUS around segment a-b. */
function collideSegment(ball: BallState, a: Vec3, b: Vec3, p: BallParams): void {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const ap = { x: ball.pos.x - a.x, y: ball.pos.y - a.y, z: ball.pos.z - a.z };
  const lenSq = ab.x * ab.x + ab.y * ab.y + ab.z * ab.z;
  let t = (ap.x * ab.x + ap.y * ab.y + ap.z * ab.z) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const d = { x: ap.x - ab.x * t, y: ap.y - ab.y * t, z: ap.z - ab.z * t };
  const dist = Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z);
  const minDist = p.radius + POST_RADIUS;
  if (dist >= minDist || dist < 1e-9) return;
  const n = { x: d.x / dist, y: d.y / dist, z: d.z / dist };
  // Push out of the post, then reflect the velocity component going into it.
  const push = minDist - dist;
  ball.pos.x += n.x * push;
  ball.pos.y += n.y * push;
  ball.pos.z += n.z * push;
  const vn = ball.vel.x * n.x + ball.vel.y * n.y + ball.vel.z * n.z;
  if (vn < 0) {
    const k = (1 + p.postRestitution) * vn;
    ball.vel.x -= k * n.x;
    ball.vel.y -= k * n.y;
    ball.vel.z -= k * n.z;
  }
}

/** The net is a thin wall from both sides: it stops the ball and soaks up most of its speed. */
function collideNet(ball: BallState, prev: Vec3, panel: NetPanel, p: BallParams): void {
  const offset = ball.pos[panel.axis] - panel.at;
  if (offset > p.radius || offset < -p.radius) return;
  for (const axis of ["x", "y", "z"] as const) {
    const range = panel.bounds[axis];
    if (range && (ball.pos[axis] < range[0] || ball.pos[axis] > range[1])) return;
  }
  const before = prev[panel.axis] - panel.at;
  const side = before !== 0 ? Math.sign(before) : -Math.sign(ball.vel[panel.axis]) || 1;
  ball.pos[panel.axis] = panel.at + side * p.radius;
  if (ball.vel[panel.axis] * side < 0) ball.vel[panel.axis] = 0;
  ball.vel.x *= p.netDamping;
  ball.vel.y *= p.netDamping;
  ball.vel.z *= p.netDamping;
  ball.spin.x = ball.spin.y = ball.spin.z = 0;
}

/**
 * Which goal the ball is inside: +1 (the goal at +x), -1, or 0. "Inside" means wholly over the goal line,
 * between the posts, under the bar and within the net; a ball lying behind the goal does not count.
 */
export function isInGoal(ball: BallState, pitch: PitchSpec, radius: number): -1 | 0 | 1 {
  const halfL = pitch.length / 2;
  const inMouth = Math.abs(ball.pos.z) < pitch.goalWidth / 2 && ball.pos.y < pitch.goalHeight;
  if (!inMouth) return 0;
  const depth = Math.abs(ball.pos.x) - halfL;
  if (depth <= radius || depth > pitch.goalDepth + radius) return 0;
  return ball.pos.x > 0 ? 1 : -1;
}

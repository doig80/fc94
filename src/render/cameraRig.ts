import { ArcRotateCamera, Scene, Vector3 } from "@babylonjs/core";
import type { PitchSpec } from "../sim/params";

export type MatchCamera = "classic" | "broadcast";

/**
 * Replay angles (docs/specs/10 §2: cinematic angles only in replays): low from the side, following the ball,
 * and from behind the goal the ball went into. `goalX` is that goal's position on the x axis.
 */
export interface CinematicShot {
  kind: "side" | "goal";
  goalX: number;
}

interface Framing {
  alpha: number;
  beta: number;
  radius: number;
  /** How far ahead of the ball (in seconds of its velocity) the camera looks. */
  lead: number;
  /** How much the camera follows the ball across the pitch (0 = stays on the centre line). */
  followZ: number;
}

/** Camera framings, scaled to the pitch size (docs/specs/10 §2). */
function framing(mode: MatchCamera, pitch: PitchSpec): Framing {
  const scale = pitch.length >= 90 ? 1 : 0.62;
  return mode === "classic"
    ? // The '94 look: high and diagonal, looking up the pitch towards the goal being attacked.
      { alpha: -Math.PI / 2 - 0.7, beta: 0.92, radius: 30 * scale, lead: 0.35, followZ: 0.85 }
    : { alpha: -Math.PI / 2, beta: 1.12, radius: 50 * scale, lead: 0.25, followZ: 0.35 };
}

/**
 * Follows the ball smoothly. Never cuts during play; it leads slightly in the direction the ball travels.
 */
export class CameraRig {
  readonly camera: ArcRotateCamera;
  private mode: MatchCamera;
  private readonly target = new Vector3();

  constructor(
    scene: Scene,
    private readonly pitch: PitchSpec,
    mode: MatchCamera,
  ) {
    this.mode = mode;
    const f = framing(mode, pitch);
    this.camera = new ArcRotateCamera("matchCamera", f.alpha, f.beta, f.radius, Vector3.Zero(), scene);
    this.camera.minZ = 0.3;
    this.camera.maxZ = 1500;
    this.camera.fov = 0.75;
  }

  setMode(mode: MatchCamera): void {
    this.mode = mode;
  }

  /** Ground-plane angle the camera looks along, for screen-relative controls. */
  get yaw(): number {
    // An ArcRotateCamera at angle alpha sits at (cos α, sin α) from the target, so it looks the opposite way.
    return this.camera.alpha + Math.PI;
  }

  /** Where the camera is this frame (camera.position only catches up when the frame is rendered). */
  get eye(): Vector3 {
    const c = this.camera;
    const flat = c.radius * Math.sin(c.beta);
    return new Vector3(
      c.target.x + flat * Math.cos(c.alpha),
      c.target.y + c.radius * Math.cos(c.beta),
      c.target.z + flat * Math.sin(c.alpha),
    );
  }

  /** Frame a replay shot; `cut` jumps straight to it (a camera change) instead of easing. */
  cinematic(shot: CinematicShot, ball: { x: number; y: number; z: number }, dt: number, cut: boolean): void {
    const scale = this.pitch.length >= 90 ? 1 : 0.62;
    const k = cut ? 1 : 1 - Math.exp(-dt * 4);
    const c = this.camera;
    let alpha: number;
    let beta: number;
    let radius: number;
    let tx: number;
    let tz: number;
    let ty: number;
    if (shot.kind === "side") {
      alpha = -Math.PI / 2;
      beta = 1.22;
      radius = 16 * scale;
      tx = ball.x;
      ty = 0.6;
      tz = ball.z * 0.6;
    } else {
      // High behind the goal and a little to one side, looking over the crossbar back up the pitch.
      const side = shot.goalX > 0 ? 1 : -1;
      alpha = (side > 0 ? 0 : Math.PI) + 0.55 * side;
      beta = 1.1;
      radius = 16 * scale;
      tx = shot.goalX - side * 8 * scale;
      ty = 0.9;
      tz = ball.z * 0.5;
    }
    this.target.x += (tx - this.target.x) * k;
    this.target.z += (tz - this.target.z) * k;
    c.alpha += (alpha - c.alpha) * k;
    c.beta += (beta - c.beta) * k;
    c.radius += (radius - c.radius) * k;
    c.target.set(this.target.x, ty, this.target.z);
  }

  /** @param snap jump straight to the framing (first frame, after a goal) instead of easing. */
  update(ball: { x: number; z: number; vx: number; vz: number }, dt: number, snap = false): void {
    const f = framing(this.mode, this.pitch);
    const halfL = this.pitch.length / 2;
    const halfW = this.pitch.width / 2;
    const tx = clamp(ball.x + ball.vx * f.lead, -halfL * 0.85, halfL * 0.85);
    const tz = clamp((ball.z + ball.vz * f.lead) * f.followZ, -halfW * 0.7, halfW * 0.7);
    const k = snap ? 1 : 1 - Math.exp(-dt * 3.5);
    this.target.x += (tx - this.target.x) * k;
    this.target.z += (tz - this.target.z) * k;
    const c = this.camera;
    c.alpha += (f.alpha - c.alpha) * k;
    c.beta += (f.beta - c.beta) * k;
    c.radius += (f.radius - c.radius) * k;
    // Move the target in place: setTarget() would keep the camera position and change the angles instead.
    this.target.y = 0;
    c.target.copyFrom(this.target);
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

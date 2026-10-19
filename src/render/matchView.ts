import {
  AbstractEngine,
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { DEFAULT_PARAMS, type MatchState } from "../sim";
import { Atmosphere } from "./atmosphere";
import { CameraRig, type MatchCamera } from "./cameraRig";
import { SurfaceLibrary } from "./materials";
import { buildPitch } from "./pitch";
import { buildBall, KITS, Player, type PoseAction } from "./players";
import { buildStadium, type Stadium } from "./stadium";
import type { Quality, TimeOfDay, Weather } from "./types";
import { WeatherFx } from "./weather";

export interface MatchViewOptions {
  time: TimeOfDay;
  weather: Weather;
  quality: Quality;
  camera: MatchCamera;
}

/** The ball is drawn larger than its collision size so it is easy to follow (docs/specs/10 §5). */
const BALL_VISUAL_RADIUS = DEFAULT_PARAMS.ball.drawRadius;
/** Length of the render-only kick swing. */
const KICK_SECONDS = 0.22;
/** Run-cycle phase per metre travelled. */
const STRIDE = 2.6;
/** Ring colours per human player (docs/specs/10 §4). */
export const PLAYER_COLOURS = ["#ffd23f", "#3ad6ff", "#ff4fd8", "#9cff3a"];

const SKINS = ["#f1c27d", "#8d5524", "#c68642", "#e0ac69", "#5c3a21"].map((h) => Color3.FromHexString(h));
const HAIR = ["#2b1d14", "#120c08", "#e8c872", "#6b3e1f", "#1c1c1c"].map((h) => Color3.FromHexString(h));

/**
 * Draws a match from simulation state. It only reads the state (docs/specs/01 §3): the simulation never
 * knows it is being drawn. Positions are blended between the last two ticks for smooth motion.
 */
export class MatchView {
  readonly scene: Scene;
  readonly rig: CameraRig;
  private readonly lib: SurfaceLibrary;
  private readonly players: Player[] = [];
  private readonly phases: number[] = [];
  /** Render-only kick swings: seconds left per player (kicks are instant in the simulation). */
  private readonly kickTimers: number[] = [];
  private readonly ball: Mesh;
  /** Soft dark spot on the grass under the ball: shows how high the ball is (classic arcade cue). */
  private readonly ballShadow: Mesh;
  private readonly rings: Mesh[] = [];
  private readonly atmosphere: Atmosphere;
  private readonly stadium: Stadium;
  private readonly weather: WeatherFx;
  private readonly aimMarker: Mesh;
  private first = true;

  constructor(engine: AbstractEngine, initial: MatchState, options: MatchViewOptions) {
    const scene = new Scene(engine);
    this.scene = scene;
    this.lib = new SurfaceLibrary(scene);
    this.rig = new CameraRig(scene, initial.pitch, options.camera);

    const pitch = buildPitch(scene, this.lib, initial.pitch);
    const stadium = buildStadium(scene, this.lib, options.quality, initial.pitch);
    this.stadium = stadium;

    initial.players.forEach((pl, i) => {
      const kit =
        pl.team === 0
          ? pl.role === "gk"
            ? KITS.keeper
            : KITS.home
          : pl.role === "gk"
            ? KITS.keeperAway
            : KITS.away;
      const player = new Player(
        scene,
        this.lib,
        `player${i}`,
        kit,
        SKINS[i % SKINS.length],
        HAIR[(i * 3) % HAIR.length],
      );
      this.players.push(player);
      this.phases.push(i * 0.7);
      this.kickTimers.push(0);
    });
    this.ball = buildBall(scene, this.lib);
    this.ballShadow = buildBallShadow(scene);
    this.aimMarker = buildAimMarker(scene);
    this.ball.rotationQuaternion = Quaternion.Identity();

    PLAYER_COLOURS.forEach((hex, i) => {
      const ring = MeshBuilder.CreateTorus(
        `ring${i}`,
        { diameter: 1.15, thickness: 0.09, tessellation: 32 },
        scene,
      );
      const mat = new StandardMaterial(`ringMat${i}`, scene);
      mat.disableLighting = true;
      mat.emissiveColor = Color3.FromHexString(hex);
      ring.material = mat;
      ring.isPickable = false;
      ring.setEnabled(false);
      this.rings.push(ring);
    });

    this.atmosphere = new Atmosphere(scene, this.rig.camera, stadium.lamps, options.quality);
    this.lib.syncPrePassExclusions();
    this.atmosphere.addShadowCasters([
      ...pitch.shadowCasters,
      ...stadium.shadowCasters,
      // Not the ball: its spot on the grass (ballShadow) shows its height; a second, sun-angled shadow confuses.
      ...this.players.flatMap((p) => p.meshes),
    ]);
    for (const m of [...pitch.receivers, ...stadium.receivers]) m.receiveShadows = true;
    for (const p of this.players) for (const m of p.meshes) m.receiveShadows = true;

    this.weather = new WeatherFx(scene, options.quality);
    this.lib.setLook("stylised");
    this.lib.setWetness(options.weather === "rain" ? 1 : options.weather === "snow" ? 0.35 : 0);
    this.atmosphere.apply(options.time, options.weather, "stylised");
    stadium.setLampPower(this.atmosphere.floodPower);
    this.weather.set(options.weather);
  }

  /**
   * Draw the match between two ticks.
   * @param alpha 0 = `prev`, 1 = `curr`
   * @param controlled player index per human (−1 = none); shown with a coloured ring
   */
  render(
    prev: MatchState,
    curr: MatchState,
    alpha: number,
    dt: number,
    controlled: readonly number[] = [],
  ): void {
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    // A kick happened this tick if the ball was released with a new touch block.
    const kicked = curr.ball.owner < 0 && curr.ball.touchBlockUntil !== prev.ball.touchBlockUntil;
    if (kicked && curr.ball.lastTouch >= 0) this.kickTimers[curr.ball.lastTouch] = KICK_SECONDS;
    curr.players.forEach((pl, i) => {
      const before = prev.players[i];
      const view = this.players[i];
      const x = lerp(before.pos.x, pl.pos.x);
      const z = lerp(before.pos.z, pl.pos.z);
      const moved = Math.hypot(x - view.root.position.x, z - view.root.position.z);
      view.root.position.set(x, 0, z);
      // A diving keeper faces the way they dive.
      const diving = pl.action.kind === "dive";
      const fx = diving ? pl.action.dir.x : lerp(before.facing.x, pl.facing.x);
      const fz = diving ? pl.action.dir.z : lerp(before.facing.z, pl.facing.z);
      view.root.rotation.y = Math.atan2(-fz, fx);
      const speed = Math.hypot(pl.vel.x, pl.vel.z);
      if (!this.first) this.phases[i] += moved * STRIDE;
      view.pose(this.phases[i], Math.min(1, speed / DEFAULT_PARAMS.player.sprintSpeed));
      const act = pl.action;
      if (act.kind !== "none") {
        view.poseAction(act.kind as PoseAction, 1 - act.ticks / act.total);
      } else if (this.kickTimers[i] > 0) {
        view.poseAction("kick", 1 - this.kickTimers[i] / KICK_SECONDS);
        this.kickTimers[i] -= dt;
      }
    });

    const b0 = prev.ball;
    const b1 = curr.ball;
    const bx = lerp(b0.pos.x, b1.pos.x);
    const by = lerp(b0.pos.y, b1.pos.y) + (BALL_VISUAL_RADIUS - DEFAULT_PARAMS.ball.radius);
    const bz = lerp(b0.pos.z, b1.pos.z);
    const dx = bx - this.ball.position.x;
    const dz = bz - this.ball.position.z;
    const dist = Math.hypot(dx, dz);
    if (!this.first && dist > 1e-5 && dist < 5) {
      // Roll: rotate around the horizontal axis perpendicular to the movement (up × direction).
      const roll = Quaternion.RotationAxis(new Vector3(dz / dist, 0, -dx / dist), dist / BALL_VISUAL_RADIUS);
      roll.multiplyToRef(this.ball.rotationQuaternion!, this.ball.rotationQuaternion!);
    }
    this.ball.position.set(bx, by, bz);
    // The spot stays on the grass and shrinks and fades as the ball climbs.
    const height = Math.max(0, by - BALL_VISUAL_RADIUS);
    this.ballShadow.position.set(bx, 0.02, bz);
    this.ballShadow.scaling.setAll(Math.max(0.45, 1 - height * 0.12));
    this.ballShadow.visibility = Math.max(0.25, 0.85 - height * 0.12);

    // Free kicks and penalties: where on the goal the shot will go (docs/specs/10 §1).
    const aim = curr.phase.kind === "restart" ? curr.phase.restart.aim : null;
    this.aimMarker.setEnabled(aim !== null);
    if (aim) this.aimMarker.position.set(aim.x, curr.pitch.goalHeight * 0.5, aim.z);

    this.rings.forEach((ring, slot) => {
      const index = controlled[slot] ?? -1;
      ring.setEnabled(index >= 0);
      if (index >= 0) {
        const p = this.players[index].root.position;
        ring.position.set(p.x, 0.04, p.z);
      }
    });

    this.weather.follow(new Vector3(bx, 0, bz));
    this.rig.update({ x: bx, z: bz, vx: b1.vel.x, vz: b1.vel.z }, dt, this.first);
    const cam = this.rig.camera;
    this.stadium.fadeOccluders(
      {
        eye: this.rig.eye,
        target: cam.target,
        fov: cam.fov,
        aspect: this.scene.getEngine().getAspectRatio(cam),
      },
      this.first ? 1 : dt,
    );
    this.first = false;
  }
}

/** A glowing ring that stands in the goal mouth, facing the pitch. */
function buildAimMarker(scene: Scene): Mesh {
  const ring = MeshBuilder.CreateTorus(
    "aimMarker",
    { diameter: 1, thickness: 0.14, tessellation: 24 },
    scene,
  );
  ring.rotation.z = Math.PI / 2;
  // Drawn over the net and the keeper, so it never hides.
  ring.renderingGroupId = 1;
  const mat = new StandardMaterial("aimMarkerMat", scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString("#ffd23f");
  ring.material = mat;
  ring.isPickable = false;
  ring.setEnabled(false);
  return ring;
}

function buildBallShadow(scene: Scene): Mesh {
  const size = 64;
  const tex = new DynamicTexture("ballShadowTex", { width: size, height: size }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.75)");
  g.addColorStop(0.55, "rgba(0,0,0,0.45)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  tex.hasAlpha = true;
  tex.update();
  const mat = new StandardMaterial("ballShadowMat", scene);
  mat.diffuseTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.disableLighting = true;
  mat.emissiveColor = Color3.Black();
  mat.zOffset = -2;
  const disc = MeshBuilder.CreateGround("ballShadow", { width: 0.6, height: 0.6 }, scene);
  disc.material = mat;
  disc.isPickable = false;
  return disc;
}

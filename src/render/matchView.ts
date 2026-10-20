import {
  AbstractEngine,
  Color3,
  DynamicTexture,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  TrailMesh,
  Vector3,
} from "@babylonjs/core";
import { DEFAULT_PARAMS, type JuiceParams, type MatchState } from "../sim";
import { Atmosphere } from "./atmosphere";
import { CameraRig, type CinematicShot, type MatchCamera } from "./cameraRig";
import { SurfaceLibrary } from "./materials";
import { Officials } from "./officials";
import { buildPitch } from "./pitch";
import { CharacterRig } from "./characterRig";
import { HAIRSTYLES, loadCharacterAssets } from "./character";
import { buildBall, KITS, type Kit, type PoseAction, type Rig } from "./players";
import { Squad } from "./squad";
import { buildStadium, type Stadium } from "./stadium";
import type { Quality, TimeOfDay, Weather } from "./types";
import { WeatherFx } from "./weather";

export interface MatchViewOptions {
  time: TimeOfDay;
  weather: Weather;
  quality: Quality;
  camera: MatchCamera;
  /** Game-feel strengths (read live, so the tuning panel applies at once). */
  juice: JuiceParams;
  /** The character test (issue #27): "new" swaps in the new player model once it has loaded. */
  players?: "old" | "new";
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
  /** Every player, drawn together; `squad.rigs[i]` is player i, then the referee and his assistants. */
  private readonly squad: Squad;
  /** Who is shown: the squad's placeholders, or the new model's rigs once loaded (same order). */
  private rigs: Rig[];
  private officials: Officials;
  /** Resolves once everything asked for is shown (the new players load separately). */
  readonly loaded: Promise<void>;
  /** Low quality: a soft spot under each player instead of shadow maps (docs/specs/01 §4). */
  private readonly blobs: Mesh | null;
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
  /** The burst around a player who struck a "Perfect" first-time shot. */
  private readonly perfectFlash: Mesh;
  /** Where the offside line was when offside was called, shown on the grass for a moment. */
  private readonly offsideLine: Mesh;
  /** The replay angle shown last frame, to cut (not pan) between angles. */
  private lastShot: CinematicShot["kind"] | null = null;
  private readonly juice: JuiceParams;
  private readonly trail: TrailMesh;
  /** Back nets of the goals at −x and +x, and how far each is into its bulge (seconds, −1 = still). */
  private readonly nets: Mesh[];
  private readonly netRest: number[];
  private readonly netTime = [-1, -1];
  private lastGoalTick = -1;
  private first = true;

  /** Every person on the pitch, in order: the players, then the referee and his two assistants. */
  private static people(initial: MatchState): { kit: Kit; skin: Color3; hair: Color3 }[] {
    return initial.players
      .map((pl, i) => ({
        kit:
          pl.team === 0
            ? pl.role === "gk"
              ? KITS.keeper
              : KITS.home
            : pl.role === "gk"
              ? KITS.keeperAway
              : KITS.away,
        skin: SKINS[i % SKINS.length],
        hair: HAIR[(i * 3) % HAIR.length],
      }))
      .concat(
        [0, 1, 2].map((k) => ({
          kit: KITS.referee,
          skin: SKINS[(k * 2 + 1) % SKINS.length],
          hair: HAIR[(k + 1) % HAIR.length],
        })),
      );
  }

  /**
   * The character test (issue #27): once the new model has loaded, it stands in for every player and official,
   * driven exactly as the placeholders are; the placeholders hide.
   */
  private async showNewPlayers(people: { kit: Kit; hair: Color3 }[]): Promise<void> {
    const assets = await loadCharacterAssets(this.scene);
    const rigs = people.map(
      (p, i) =>
        new CharacterRig(this.scene, assets, `person${i}`, p.kit, {
          hair: p.hair,
          hairstyle: HAIRSTYLES[i % HAIRSTYLES.length],
        }),
    );
    for (const m of this.squad.meshes) m.setEnabled(false);
    this.officials.dispose();
    this.officials = new Officials(this.scene, rigs.slice(rigs.length - 3));
    this.rigs = rigs;
    this.atmosphere.addShadowCasters(rigs.map((r) => r.shadowCaster));
    for (const m of rigs.flatMap((r) => r.meshes)) m.receiveShadows = true;
  }

  constructor(engine: AbstractEngine, initial: MatchState, options: MatchViewOptions) {
    const scene = new Scene(engine);
    this.scene = scene;
    this.lib = new SurfaceLibrary(scene);
    this.rig = new CameraRig(scene, initial.pitch, options.camera);

    const pitch = buildPitch(scene, this.lib, initial.pitch);
    this.nets = pitch.nets;
    this.netRest = pitch.nets.map((n) => n.position.x);
    this.juice = options.juice;
    const stadium = buildStadium(scene, this.lib, options.quality, initial.pitch);
    this.stadium = stadium;

    const people = MatchView.people(initial);
    this.squad = new Squad(scene, this.lib, people);
    this.rigs = this.squad.rigs;
    this.officials = new Officials(scene, this.squad.rigs.slice(initial.players.length));
    this.loaded = options.players === "new" ? this.showNewPlayers(people) : Promise.resolve();
    initial.players.forEach((_, i) => {
      this.phases.push(i * 0.7);
      this.kickTimers.push(0);
    });
    this.ball = buildBall(scene, this.lib);
    this.ballShadow = buildBallShadow(scene);
    this.aimMarker = buildAimMarker(scene);
    this.offsideLine = buildOffsideLine(scene, initial.pitch.width);
    this.perfectFlash = buildPerfectFlash(scene);
    this.trail = buildTrail(scene, this.ball);
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

    const shadowMaps = options.quality !== "low";
    this.atmosphere = new Atmosphere(scene, this.rig.camera, stadium.lamps, options.quality, shadowMaps);
    this.blobs = shadowMaps ? null : buildBlobShadows(scene, initial.players.length + 3);
    this.lib.syncPrePassExclusions();
    this.atmosphere.addShadowCasters([
      ...pitch.shadowCasters,
      ...stadium.shadowCasters,
      // Not the ball: its spot on the grass (ballShadow) shows its height; a second, sun-angled shadow confuses.
      ...this.squad.meshes,
    ]);
    for (const m of [...pitch.receivers, ...stadium.receivers, ...this.squad.meshes]) m.receiveShadows = true;

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
    shot: CinematicShot | null = null,
  ): void {
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    // A kick happened this tick if the ball was released with a new touch block.
    const kicked = curr.ball.owner < 0 && curr.ball.touchBlockUntil !== prev.ball.touchBlockUntil;
    if (kicked && curr.ball.lastTouch >= 0) this.kickTimers[curr.ball.lastTouch] = KICK_SECONDS;
    const j = this.juice;
    const kickSpeed = Math.hypot(curr.ball.vel.x, curr.ball.vel.y, curr.ball.vel.z);
    if (kicked && kickSpeed >= j.powerShotSpeed) this.rig.shake(0.12 * j.shake);
    const goal = curr.lastEvent?.kind === "goal" ? curr.lastEvent.tick : -1;
    if (goal >= 0 && goal !== this.lastGoalTick) {
      this.lastGoalTick = goal;
      if (!this.first) {
        this.rig.shake(0.3 * j.shake);
        this.netTime[curr.ball.pos.x > 0 ? 1 : 0] = 0;
      }
    }
    this.rippleNets(dt);
    curr.players.forEach((pl, i) => {
      const before = prev.players[i];
      const view = this.rigs[i];
      const x = lerp(before.pos.x, pl.pos.x);
      const z = lerp(before.pos.z, pl.pos.z);
      const moved = Math.hypot(x - view.root.position.x, z - view.root.position.z);
      // A sent-off player has left the pitch: out of sight.
      const gone = pl.sentOff ? -50 : 0;
      view.root.position.set(x, gone, z);
      // A diving keeper faces the way they dive.
      const diving = pl.action.kind === "dive";
      const fx = diving ? pl.action.dir.x : lerp(before.facing.x, pl.facing.x);
      const fz = diving ? pl.action.dir.z : lerp(before.facing.z, pl.facing.z);
      view.root.rotation.y = Math.atan2(-fz, fx);
      const speed = Math.hypot(pl.vel.x, pl.vel.z);
      if (!this.first) this.phases[i] += moved * STRIDE;
      view.pose(this.phases[i], Math.min(1, speed / DEFAULT_PARAMS.player.sprintSpeed), dt);
      const act = pl.action;
      if (act.kind !== "none") {
        view.poseAction(act.kind as PoseAction, 1 - act.ticks / act.total);
      } else if (this.kickTimers[i] > 0) {
        view.poseAction("kick", 1 - this.kickTimers[i] / KICK_SECONDS);
        this.kickTimers[i] -= dt;
      }
      this.blobs?.thinInstanceSetMatrixAt(i, Matrix.Translation(x, 0.015 + gone, z), false);
    });
    const ballX = lerp(prev.ball.pos.x, curr.ball.pos.x);
    const ballZ = lerp(prev.ball.pos.z, curr.ball.pos.z);
    this.officials.update(curr, ballX, ballZ, dt);
    const ref = curr.rules?.fouls ? 0 : -50;
    this.officials.positions().forEach((p, k) => {
      this.blobs?.thinInstanceSetMatrixAt(
        curr.players.length + k,
        Matrix.Translation(p.x, 0.015 + ref, p.z),
        false,
      );
    });
    this.blobs?.thinInstanceBufferUpdated("matrix");
    if (this.rigs === this.squad.rigs) this.squad.update();

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
    // A trail behind fast balls; cleared when the ball jumps (restarts, replays).
    if (Math.abs(dx) > 3 || Math.abs(dz) > 3) this.trail.reset();
    const speed = Math.hypot(b1.vel.x, b1.vel.y, b1.vel.z);
    const show = j.trail > 0 ? Math.min(0.55, Math.max(0, (speed - 15) / 15)) : 0;
    this.trail.visibility += (show - this.trail.visibility) * Math.min(1, dt * 10);
    // The spot stays on the grass and shrinks and fades as the ball climbs.
    const height = Math.max(0, by - BALL_VISUAL_RADIUS);
    this.ballShadow.position.set(bx, 0.02, bz);
    this.ballShadow.scaling.setAll(Math.max(0.45, 1 - height * 0.12));
    this.ballShadow.visibility = Math.max(0.25, 0.85 - height * 0.12);

    // Free kicks and penalties: where on the goal the shot will go (docs/specs/10 §1); corners: where the cross
    // goes, a ring on the grass in the box.
    const restart = curr.phase.kind === "restart" ? curr.phase.restart : null;
    const aim = restart?.aim ?? null;
    this.aimMarker.setEnabled(aim !== null);
    if (aim) {
      const corner = restart?.kind === "corner";
      this.aimMarker.position.set(aim.x, corner ? 0.06 : curr.pitch.goalHeight * 0.5, aim.z);
      this.aimMarker.rotation.set(0, 0, corner ? 0 : Math.PI / 2);
      this.aimMarker.scaling.setAll(corner ? 1.6 : 1);
    }

    // A "Perfect" first-time strike (M4): a gold ring bursts out from the striker.
    const perfect = curr.lastPerfect;
    const age = perfect ? (curr.tick - perfect.tick) / 60 : Infinity;
    this.perfectFlash.setEnabled(age < PERFECT_SECONDS);
    if (perfect && age < PERFECT_SECONDS) {
      const p = curr.players[perfect.player].pos;
      const k = age / PERFECT_SECONDS;
      this.perfectFlash.position.set(p.x, 0.9, p.z);
      this.perfectFlash.scaling.setAll(1 + k * 3);
      this.perfectFlash.visibility = 1 - k;
    }

    // Offside: the line across the pitch where it was, fading out.
    const e = curr.lastEvent;
    const since = e?.kind === "offside" && e.line !== undefined ? (curr.tick - e.tick) / 60 : Infinity;
    this.offsideLine.setEnabled(since < OFFSIDE_LINE_SECONDS);
    if (e?.line !== undefined && since < OFFSIDE_LINE_SECONDS) {
      this.offsideLine.position.x = e.line;
      this.offsideLine.visibility = Math.min(1, (OFFSIDE_LINE_SECONDS - since) * 2);
    }

    this.rings.forEach((ring, slot) => {
      const index = controlled[slot] ?? -1;
      ring.setEnabled(index >= 0);
      if (index >= 0) {
        const p = this.rigs[index].root.position;
        ring.position.set(p.x, 0.04, p.z);
      }
    });

    this.weather.follow(new Vector3(bx, 0, bz));
    if (shot) {
      this.rig.cinematic(shot, { x: bx, y: by, z: bz }, dt, this.first || shot.kind !== this.lastShot);
    } else {
      // At a corner the camera frames the box, between the flag and the aiming ring, so you can see where you aim.
      const corner = restart?.kind === "corner" && aim ? aim : null;
      const fx = corner ? bx + (corner.x - bx) * 0.6 : bx;
      const fz = corner ? bz + (corner.z - bz) * 0.6 : bz;
      this.rig.update({ x: fx, z: fz, vx: b1.vel.x, vz: b1.vel.z }, dt, this.first || this.lastShot !== null);
    }
    this.lastShot = shot?.kind ?? null;
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

  /**
   * Where (x, z) on the pitch appears on screen, as fractions of the canvas (0..1 inside it). A point behind
   * the camera is mirrored, so it still comes out on the side it lies.
   */
  screenPosition(x: number, z: number): { x: number; y: number } {
    const engine = this.scene.getEngine();
    const w = engine.getRenderWidth();
    const h = engine.getRenderHeight();
    const p = Vector3.Project(
      new Vector3(x, 1, z),
      Matrix.IdentityReadOnly,
      this.scene.getTransformMatrix(),
      this.rig.camera.viewport.toGlobal(w, h),
    );
    const behind = p.z > 1;
    const sx = p.x / w;
    const sy = p.y / h;
    // Behind the camera: flip through the centre and push it off-screen.
    return behind ? { x: 0.5 - (sx - 0.5) * 100, y: 0.5 - (sy - 0.5) * 100 } : { x: sx, y: sy };
  }

  /** The net the ball went into bulges out and springs back. */
  private rippleNets(dt: number): void {
    this.netTime.forEach((t, i) => {
      if (t < 0) return;
      const time = t + dt;
      const bulge = 0.35 * this.juice.netRipple * Math.exp(-time * 5) * Math.cos(time * 16);
      this.nets[i].position.x = this.netRest[i] + Math.max(-0.05, bulge);
      this.netTime[i] = time > 1.2 ? -1 : time;
      if (time > 1.2) this.nets[i].position.x = this.netRest[i];
    });
  }
}

/** A soft streak behind the ball, shown when it's moving fast. */
function buildTrail(scene: Scene, ball: Mesh): TrailMesh {
  const trail = new TrailMesh("ballTrail", ball, scene, BALL_VISUAL_RADIUS * 1.2, 8, true);
  const mat = new StandardMaterial("ballTrailMat", scene);
  mat.disableLighting = true;
  mat.emissiveColor = new Color3(1, 1, 1);
  mat.alpha = 0.5;
  trail.material = mat;
  trail.isPickable = false;
  trail.visibility = 0;
  return trail;
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

/** How long the "Perfect" burst lasts. */
const PERFECT_SECONDS = 0.45;

/** A flat gold ring around a player, waist high, that bursts outwards. */
function buildPerfectFlash(scene: Scene): Mesh {
  const ring = MeshBuilder.CreateTorus(
    "perfectFlash",
    { diameter: 1.2, thickness: 0.12, tessellation: 32 },
    scene,
  );
  const mat = new StandardMaterial("perfectFlashMat", scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString("#ffd23f");
  ring.material = mat;
  ring.isPickable = false;
  ring.setEnabled(false);
  return ring;
}

/** How long the offside line stays on the grass. */
const OFFSIDE_LINE_SECONDS = 3;

/** A bright strip across the pitch, from touchline to touchline. */
function buildOffsideLine(scene: Scene, pitchWidth: number): Mesh {
  const line = MeshBuilder.CreateGround("offsideLine", { width: 0.2, height: pitchWidth }, scene);
  line.position.y = 0.03;
  const mat = new StandardMaterial("offsideLineMat", scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString("#ffd23f");
  line.material = mat;
  line.isPickable = false;
  line.setEnabled(false);
  return line;
}

/** A soft round shadow under each player (Low quality), one thin instance per player. */
function buildBlobShadows(scene: Scene, count: number): Mesh {
  const disc = MeshBuilder.CreateGround("playerShadows", { width: 1.3, height: 1.3 }, scene);
  disc.material = shadowSpotMaterial(scene);
  disc.isPickable = false;
  disc.thinInstanceSetBuffer("matrix", new Float32Array(count * 16), 16, false);
  disc.alwaysSelectAsActiveMesh = true;
  return disc;
}

function buildBallShadow(scene: Scene): Mesh {
  const disc = MeshBuilder.CreateGround("ballShadow", { width: 0.6, height: 0.6 }, scene);
  disc.material = shadowSpotMaterial(scene);
  disc.isPickable = false;
  return disc;
}

/** A dark spot that fades out at the edge, drawn on the grass. */
function shadowSpotMaterial(scene: Scene): StandardMaterial {
  const cached = scene.getMaterialByName("shadowSpotMat");
  if (cached instanceof StandardMaterial) return cached;
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
  const mat = new StandardMaterial("shadowSpotMat", scene);
  mat.diffuseTexture = tex;
  mat.useAlphaFromDiffuseTexture = true;
  mat.disableLighting = true;
  mat.emissiveColor = Color3.Black();
  mat.zOffset = -2;
  return mat;
}

import { AbstractEngine, ArcRotateCamera, Color3, Mesh, Scene, Vector3 } from "@babylonjs/core";
import { Atmosphere } from "../render/atmosphere";
import { SurfaceLibrary } from "../render/materials";
import { buildPitch } from "../render/pitch";
import { buildBall, KITS, Player } from "../render/players";
import { buildStadium, type Stadium } from "../render/stadium";
import { WeatherFx } from "../render/weather";
import { PITCH_FULL } from "../sim/params";
import type { CameraMode, LookTestOptions } from "./options";

const FROZEN_TIME = 3.4;
const BALL_RADIUS = 0.18;

/** The art-direction look-test scene: one pitch, a few players, a ball, weather and lighting presets. */
export class LookTest {
  readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly lib: SurfaceLibrary;
  private readonly atmosphere: Atmosphere;
  private readonly weather: WeatherFx;
  private readonly stadium: Stadium;
  private readonly striker: Player;
  private readonly defender: Player;
  private readonly keeper: Player;
  private readonly ball: Mesh;
  private time = 0;
  private ballSpin = 0;

  constructor(
    engine: AbstractEngine,
    private readonly options: LookTestOptions,
  ) {
    const scene = new Scene(engine);
    this.scene = scene;
    this.lib = new SurfaceLibrary(scene);

    this.camera = new ArcRotateCamera("camera", 0, 1, 40, new Vector3(15, 0, 0), scene);
    this.camera.minZ = 0.5;
    this.camera.maxZ = 1500;
    this.camera.lowerBetaLimit = 0.3;
    this.camera.upperBetaLimit = 1.45;
    this.camera.lowerRadiusLimit = 10;
    this.camera.upperRadiusLimit = 160;
    this.camera.wheelDeltaPercentage = 0.01;
    this.camera.pinchDeltaPercentage = 0.004;
    this.camera.attachControl(engine.getRenderingCanvas()!, true);

    const pitch = buildPitch(scene, this.lib, PITCH_FULL);
    this.stadium = buildStadium(scene, this.lib, options.quality, PITCH_FULL);

    const skin = [
      Color3.FromHexString("#f1c27d"),
      Color3.FromHexString("#8d5524"),
      Color3.FromHexString("#c68642"),
    ];
    const hair = [
      Color3.FromHexString("#2b1d14"),
      Color3.FromHexString("#e8c872"),
      Color3.FromHexString("#120c08"),
    ];
    this.striker = new Player(scene, this.lib, "striker", KITS.home, skin[0], hair[0]);
    this.defender = new Player(scene, this.lib, "defender", KITS.away, skin[1], hair[2]);
    this.keeper = new Player(scene, this.lib, "keeper", KITS.keeper, skin[2], hair[1]);
    this.ball = buildBall(scene, this.lib);

    this.atmosphere = new Atmosphere(scene, this.camera, this.stadium.lamps, options.quality);
    this.atmosphere.addShadowCasters([
      ...pitch.shadowCasters,
      ...this.stadium.shadowCasters,
      ...this.striker.meshes,
      ...this.defender.meshes,
      ...this.keeper.meshes,
      this.ball,
    ]);
    for (const m of [...pitch.receivers, ...this.stadium.receivers]) m.receiveShadows = true;
    for (const p of [this.striker, this.defender, this.keeper])
      for (const m of p.meshes) m.receiveShadows = true;

    this.weather = new WeatherFx(scene, options.quality);

    this.setCamera(options.camera);
    this.refresh();
    this.animate(options.freeze ? FROZEN_TIME : 0, 0);

    scene.onBeforeRenderObservable.add(() => {
      const dt = Math.min(engine.getDeltaTime() / 1000, 0.1);
      if (!this.options.freeze) this.time += dt;
      this.animate(this.options.freeze ? FROZEN_TIME : this.time, this.options.freeze ? 0 : dt);
    });
  }

  update(patch: Partial<LookTestOptions>): void {
    Object.assign(this.options, patch);
    if (patch.camera) this.setCamera(patch.camera);
    this.refresh();
  }

  private refresh(): void {
    const o = this.options;
    this.lib.setLook(o.look);
    this.lib.setWetness(o.weather === "rain" ? 1 : o.weather === "snow" ? 0.35 : 0);
    this.atmosphere.apply(o.time, o.weather, o.look);
    this.stadium.setLampPower(this.atmosphere.floodPower);
    this.weather.set(o.weather);
  }

  private setCamera(mode: CameraMode): void {
    const c = this.camera;
    c.useAutoRotationBehavior = mode === "orbit";
    if (mode === "classic") {
      // The '94 look: a high diagonal view, looking up the pitch towards the attacked goal.
      c.alpha = -Math.PI / 2 - 0.7;
      c.beta = 0.92;
      c.radius = 21;
    } else if (mode === "broadcast") {
      c.alpha = -Math.PI / 2;
      c.beta = 1.15;
      c.radius = 58;
    } else {
      c.alpha = -Math.PI / 2 - 0.4;
      c.beta = 1.05;
      c.radius = 95;
      c.target.set(0, 0, 0);
      if (c.autoRotationBehavior) c.autoRotationBehavior.idleRotationSpeed = 0.06;
    }
  }

  /** Scripted motion: the striker dribbles in a figure of eight, the defender shadows, the keeper sets. */
  private animate(t: number, dt: number): void {
    const path = (time: number) => {
      const w = 0.32;
      return {
        pos: new Vector3(20 + 13 * Math.sin(w * time), 0, 8 * Math.sin(2 * w * time)),
        vel: new Vector3(13 * w * Math.cos(w * time), 0, 16 * w * Math.cos(2 * w * time)),
      };
    };
    const place = (p: Player, pos: Vector3, heading: Vector3, phase: number, effort: number) => {
      p.root.position.copyFrom(pos);
      p.root.rotation.y = Math.atan2(-heading.z, heading.x);
      p.pose(phase, effort);
    };

    const s = path(t);
    const dir = s.vel.normalizeToNew();
    const speed = s.vel.length();
    place(this.striker, s.pos, dir, t * 9, Math.min(1, speed / 6));

    const ballPos = s.pos.add(dir.scale(0.75));
    ballPos.y = BALL_RADIUS + Math.abs(Math.sin(t * 4.5)) * 0.06;
    this.ball.position.copyFrom(ballPos);
    this.ballSpin = dt > 0 ? this.ballSpin + (speed * dt) / BALL_RADIUS : t * 25;
    this.ball.rotation.set(0, Math.atan2(-dir.z, dir.x), -this.ballSpin);

    const d = path(t - 0.7);
    const dDir = d.vel.normalizeToNew();
    const side = new Vector3(-dDir.z, 0, dDir.x);
    const defPos = d.pos.add(side.scale(1.6));
    const toBall = ballPos.subtract(defPos).normalize();
    place(
      this.defender,
      defPos,
      Vector3.Lerp(dDir, toBall, 0.5).normalize(),
      t * 8.5 + 1,
      Math.min(1, d.vel.length() / 6),
    );

    const keeperPos = new Vector3(51.3, 0, Math.max(-2.5, Math.min(2.5, ballPos.z * 0.25)));
    place(this.keeper, keeperPos, new Vector3(-1, 0, 0), t * 3, 0.12);

    this.weather.follow(ballPos);
    if (this.options.view) {
      const [alpha, beta, radius, x, z] = this.options.view;
      this.camera.useAutoRotationBehavior = false;
      Object.assign(this.camera, { alpha, beta, radius });
      this.camera.target.set(x, 0, z);
    } else if (this.options.camera !== "orbit") {
      const target = new Vector3(ballPos.x * 0.85, 0, ballPos.z * 0.5);
      // Move the target in place: setTarget() would keep the camera position and change the angles instead.
      if (dt === 0) this.camera.target.copyFrom(target);
      else this.camera.target.copyFrom(Vector3.Lerp(this.camera.target, target, Math.min(1, dt * 2)));
    }
  }
}

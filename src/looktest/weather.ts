import { Color4, DynamicTexture, ParticleSystem, Scene, Texture, Vector3 } from "@babylonjs/core";
import type { Quality, Weather } from "./options";

/** Rain (streaks + ground splashes) and snow, emitted in a box that follows the camera target. */
export class WeatherFx {
  private readonly rain: ParticleSystem;
  private readonly splashes: ParticleSystem;
  private readonly snow: ParticleSystem;

  constructor(scene: Scene, quality: Quality) {
    const scale = quality === "high" ? 1 : 0.35;
    const streak = makeTexture(scene, "rainTex", 16, 64, (ctx) => {
      const g = ctx.createLinearGradient(0, 0, 0, 64);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(1, "rgba(255,255,255,0.9)");
      ctx.fillStyle = g;
      ctx.fillRect(6, 0, 4, 64);
    });
    const dot = makeTexture(scene, "flakeTex", 32, 32, (ctx) => {
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 32);
    });

    this.rain = new ParticleSystem("rain", Math.round(14000 * scale), scene);
    this.rain.particleTexture = streak;
    this.rain.emitter = new Vector3(0, 30, 0);
    this.rain.minEmitBox = new Vector3(-35, 0, -35);
    this.rain.maxEmitBox = new Vector3(35, 10, 35);
    this.rain.direction1 = new Vector3(-2, -38, 1);
    this.rain.direction2 = new Vector3(-1, -42, 2);
    this.rain.minEmitPower = this.rain.maxEmitPower = 1;
    this.rain.minLifeTime = this.rain.maxLifeTime = 0.95;
    this.rain.emitRate = 12000 * scale;
    this.rain.minSize = 0.04;
    this.rain.maxSize = 0.07;
    this.rain.minScaleY = 9;
    this.rain.maxScaleY = 14;
    this.rain.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED;
    this.rain.color1 = new Color4(0.75, 0.8, 0.9, 0.35);
    this.rain.color2 = new Color4(0.8, 0.85, 0.95, 0.5);
    this.rain.colorDead = new Color4(0.8, 0.85, 0.95, 0.5);
    this.rain.blendMode = ParticleSystem.BLENDMODE_ADD;

    this.splashes = new ParticleSystem("splashes", Math.round(3000 * scale), scene);
    this.splashes.particleTexture = dot;
    this.splashes.emitter = new Vector3(0, 0.02, 0);
    this.splashes.minEmitBox = new Vector3(-35, 0, -35);
    this.splashes.maxEmitBox = new Vector3(35, 0, 35);
    this.splashes.direction1 = new Vector3(-0.6, 1.5, -0.6);
    this.splashes.direction2 = new Vector3(0.6, 2.5, 0.6);
    this.splashes.gravity = new Vector3(0, -18, 0);
    this.splashes.minLifeTime = 0.12;
    this.splashes.maxLifeTime = 0.25;
    this.splashes.emitRate = 6000 * scale;
    this.splashes.minSize = 0.03;
    this.splashes.maxSize = 0.08;
    this.splashes.color1 = new Color4(0.85, 0.9, 1, 0.5);
    this.splashes.color2 = new Color4(0.85, 0.9, 1, 0.3);
    this.splashes.colorDead = new Color4(0.85, 0.9, 1, 0);
    this.splashes.blendMode = ParticleSystem.BLENDMODE_ADD;

    this.snow = new ParticleSystem("snow", Math.round(9000 * scale), scene);
    this.snow.particleTexture = dot;
    this.snow.emitter = new Vector3(0, 22, 0);
    this.snow.minEmitBox = new Vector3(-45, 0, -45);
    this.snow.maxEmitBox = new Vector3(45, 8, 45);
    this.snow.direction1 = new Vector3(-1.2, -2.5, -0.6);
    this.snow.direction2 = new Vector3(1.2, -3.5, 0.6);
    this.snow.minEmitPower = this.snow.maxEmitPower = 1;
    this.snow.minLifeTime = this.snow.maxLifeTime = 8;
    this.snow.emitRate = 1100 * scale;
    this.snow.minSize = 0.08;
    this.snow.maxSize = 0.18;
    this.snow.minAngularSpeed = -1;
    this.snow.maxAngularSpeed = 1;
    this.snow.color1 = new Color4(1, 1, 1, 0.9);
    this.snow.color2 = new Color4(0.95, 0.97, 1, 0.7);
    this.snow.colorDead = new Color4(1, 1, 1, 0.6);
    this.snow.blendMode = ParticleSystem.BLENDMODE_STANDARD;
  }

  /** Keep the precipitation centred on the action, where the camera looks. */
  follow(target: Vector3): void {
    (this.rain.emitter as Vector3).set(target.x - 8, 30, target.z);
    (this.splashes.emitter as Vector3).set(target.x, 0.02, target.z);
    (this.snow.emitter as Vector3).set(target.x - 4, 22, target.z);
  }

  set(weather: Weather): void {
    const toggle = (ps: ParticleSystem, on: boolean) => {
      if (on && !ps.isStarted()) {
        // Pre-fill the sky so the effect is visible immediately (also for screenshots).
        ps.preWarmCycles = 60;
        ps.preWarmStepOffset = 4;
        ps.start();
      } else if (!on && ps.isStarted()) {
        ps.stop();
        ps.reset();
      }
    };
    toggle(this.rain, weather === "rain");
    toggle(this.splashes, weather === "rain");
    toggle(this.snow, weather === "snow");
  }
}

function makeTexture(
  scene: Scene,
  name: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void,
): Texture {
  const tex = new DynamicTexture(name, { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.clearRect(0, 0, w, h);
  draw(ctx);
  tex.hasAlpha = true;
  tex.update();
  return tex;
}

import {
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  Texture,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { Rng } from "../sim/rng";
import type { SurfaceLibrary } from "./materials";

/** Pitch dimensions in metres (FIFA-standard 105 × 68). */
export const PITCH = { length: 105, width: 68, margin: 7 } as const;
const GOAL = { width: 7.32, height: 2.44, depth: 2.2 } as const;

export function buildPitch(scene: Scene, lib: SurfaceLibrary): { shadowCasters: Mesh[]; receivers: Mesh[] } {
  const totalL = PITCH.length + PITCH.margin * 2;
  const totalW = PITCH.width + PITCH.margin * 2;

  lib.define("grass", {
    color: new Color3(1, 1, 1),
    roughness: 0.9,
    texture: grassTexture(scene, totalL, totalW),
    wettable: 1,
  });
  lib.define("post", { color: new Color3(0.95, 0.95, 0.95), roughness: 0.35, outline: true, wettable: 0.5 });
  lib.define("net", { color: new Color3(1, 1, 1), roughness: 0.8, texture: netTexture(scene), blend: true });
  lib.define("flag", { color: new Color3(1, 0.85, 0.1), roughness: 0.7, outline: true });

  const ground = MeshBuilder.CreateGround("pitch", { width: totalL, height: totalW }, scene);
  lib.assign(ground, "grass");
  ground.receiveShadows = true;

  const casters: Mesh[] = [];
  for (const side of [-1, 1]) casters.push(...buildGoal(scene, lib, side));
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const pole = MeshBuilder.CreateCylinder(
        "cornerPole",
        { height: 1.5, diameter: 0.05, tessellation: 6 },
        scene,
      );
      pole.position.set((x * PITCH.length) / 2, 0.75, (z * PITCH.width) / 2);
      lib.assign(pole, "post");
      const flag = MeshBuilder.CreatePlane(
        "cornerFlag",
        { width: 0.45, height: 0.3, sideOrientation: Mesh.DOUBLESIDE },
        scene,
      );
      flag.parent = pole;
      flag.position.set(0.23, 0.6, 0);
      lib.assign(flag, "flag");
      casters.push(pole, flag);
    }
  }
  return { shadowCasters: casters, receivers: [ground] };
}

function buildGoal(scene: Scene, lib: SurfaceLibrary, side: number): Mesh[] {
  const root = new TransformNode(`goal${side}`, scene);
  root.position.x = (side * PITCH.length) / 2;
  root.rotation.y = side > 0 ? 0 : Math.PI;
  const post = (name: string, from: Vector3, to: Vector3): Mesh => {
    const m = MeshBuilder.CreateTube(
      name,
      { path: [from, to], radius: 0.06, tessellation: 8, cap: Mesh.CAP_ALL },
      scene,
    );
    m.parent = root;
    lib.assign(m, "post");
    return m;
  };
  const hw = GOAL.width / 2;
  const h = GOAL.height;
  const d = GOAL.depth;
  const meshes = [
    post("postL", new Vector3(0, 0, -hw), new Vector3(0, h, -hw)),
    post("postR", new Vector3(0, 0, hw), new Vector3(0, h, hw)),
    post("bar", new Vector3(0, h, -hw), new Vector3(0, h, hw)),
    post("backBarTop", new Vector3(d, h * 0.8, -hw), new Vector3(d, h * 0.8, hw)),
  ];
  // Net: back, roof and two side panels (open at the goal mouth).
  const panels: [string, number, number, Vector3, Vector3][] = [
    ["netBack", GOAL.width, h * 0.8, new Vector3(d, h * 0.4, 0), new Vector3(0, Math.PI / 2, 0)],
    [
      "netRoof",
      GOAL.width,
      Math.hypot(d, h * 0.2),
      new Vector3(d / 2, h * 0.9, 0),
      new Vector3(Math.PI / 2 - Math.atan2(h * 0.2, d), Math.PI / 2, 0),
    ],
    ["netSideL", d, h, new Vector3(d / 2, h / 2, -hw), new Vector3(0, 0, 0)],
    ["netSideR", d, h, new Vector3(d / 2, h / 2, hw), new Vector3(0, 0, 0)],
  ];
  for (const [name, width, height, pos, rot] of panels) {
    const panel = MeshBuilder.CreatePlane(name, { width, height, sideOrientation: Mesh.DOUBLESIDE }, scene);
    panel.parent = root;
    panel.position.copyFrom(pos);
    panel.rotation.copyFrom(rot);
    lib.assign(panel, "net");
    meshes.push(panel);
  }
  return meshes;
}

function grassTexture(scene: Scene, totalL: number, totalW: number): Texture {
  const tw = 2048;
  const th = Math.round((tw * totalW) / totalL);
  const tex = new DynamicTexture("grassTex", { width: tw, height: th }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const sx = tw / totalL;
  const sy = th / totalW;
  const px = (x: number) => (x + totalL / 2) * sx;
  const py = (z: number) => (z + totalW / 2) * sy;

  // Mowing stripes.
  const stripes = 18;
  const stripeW = PITCH.length / stripes;
  ctx.fillStyle = "#3f8f3a";
  ctx.fillRect(0, 0, tw, th);
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#4c9744" : "#41863a";
    ctx.fillRect(px(-PITCH.length / 2 + i * stripeW), 0, stripeW * sx + 1, th);
  }
  // Subtle speckle so the grass is not perfectly flat.
  const rng = new Rng(94);
  for (let i = 0; i < 40_000; i++) {
    const shade = rng.range(-18, 18);
    ctx.fillStyle = `rgba(${shade > 0 ? 255 : 0},${shade > 0 ? 255 : 30},0,${Math.abs(shade) / 255})`;
    ctx.fillRect(rng.range(0, tw), rng.range(0, th), 2, 2);
  }

  // Markings.
  const L = PITCH.length / 2;
  const W = PITCH.width / 2;
  ctx.strokeStyle = "rgba(250,250,245,0.95)";
  ctx.lineWidth = 0.18 * sx;
  const rect = (x0: number, z0: number, x1: number, z1: number) =>
    ctx.strokeRect(px(x0), py(z0), (x1 - x0) * sx, (z1 - z0) * sy);
  rect(-L, -W, L, W);
  ctx.beginPath();
  ctx.moveTo(px(0), py(-W));
  ctx.lineTo(px(0), py(W));
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(px(0), py(0), 9.15 * sx, 9.15 * sy, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (const s of [-1, 1]) {
    const goalLine = s * L;
    rect(Math.min(goalLine, goalLine - s * 16.5), -20.16, Math.max(goalLine, goalLine - s * 16.5), 20.16);
    rect(Math.min(goalLine, goalLine - s * 5.5), -9.16, Math.max(goalLine, goalLine - s * 5.5), 9.16);
    const spot = goalLine - s * 11;
    ctx.beginPath();
    ctx.ellipse(px(spot), py(0), 0.15 * sx, 0.15 * sy, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(250,250,245,0.95)";
    ctx.fill();
    // Penalty arc: the part of the 9.15 m circle outside the box.
    const a = Math.acos(5.5 / 9.15);
    ctx.beginPath();
    const start = s > 0 ? Math.PI - a : -a;
    ctx.ellipse(px(spot), py(0), 9.15 * sx, 9.15 * sy, 0, start, start + 2 * a);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.ellipse(px(0), py(0), 0.15 * sx, 0.15 * sy, 0, 0, Math.PI * 2);
  ctx.fill();

  tex.update();
  tex.anisotropicFilteringLevel = 8;
  return tex;
}

function netTexture(scene: Scene): Texture {
  const size = 256;
  const tex = new DynamicTexture("netTex", { width: size, height: size }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  // A near-invisible white background keeps mipmaps white instead of fading to black.
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(255,255,255,0.03)";
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 3;
  const cells = 8;
  for (let i = 0; i <= cells; i++) {
    const p = (i / cells) * size;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  tex.hasAlpha = true;
  tex.uScale = 4;
  tex.vScale = 3;
  tex.update();
  return tex;
}

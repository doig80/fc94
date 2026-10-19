import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import type { SurfaceLibrary } from "./materials";

export interface Kit {
  id: string;
  shirt: Color3;
  shorts: Color3;
  socks: Color3;
}

export const KITS: Record<string, Kit> = {
  home: {
    id: "home",
    shirt: Color3.FromHexString("#d7263d"),
    shorts: Color3.FromHexString("#f5f5f0"),
    socks: Color3.FromHexString("#d7263d"),
  },
  away: {
    id: "away",
    shirt: Color3.FromHexString("#1b4fd8"),
    shorts: Color3.FromHexString("#14213d"),
    socks: Color3.FromHexString("#f5f5f0"),
  },
  keeper: {
    id: "keeper",
    shirt: Color3.FromHexString("#2bb24c"),
    shorts: Color3.FromHexString("#1d1d1d"),
    socks: Color3.FromHexString("#2bb24c"),
  },
  keeperAway: {
    id: "keeperAway",
    shirt: Color3.FromHexString("#ff8c1a"),
    shorts: Color3.FromHexString("#1d1d1d"),
    socks: Color3.FromHexString("#ff8c1a"),
  },
};

/** A procedurally built low-poly footballer with a simple run cycle (placeholder until real models). */
export class Player {
  readonly root: TransformNode;
  readonly meshes: Mesh[] = [];
  private readonly body: TransformNode;
  private readonly legs: TransformNode[] = [];
  private readonly arms: TransformNode[] = [];

  constructor(scene: Scene, lib: SurfaceLibrary, name: string, kit: Kit, skin: Color3, hair: Color3) {
    const k = `kit:${kit.id}`;
    lib.define(`${k}:shirt`, { color: kit.shirt, roughness: 0.7, outline: true, wettable: 0.6 });
    lib.define(`${k}:shorts`, { color: kit.shorts, roughness: 0.7, outline: true, wettable: 0.6 });
    lib.define(`${k}:socks`, { color: kit.socks, roughness: 0.8, outline: true, wettable: 0.4 });
    const skinId = `skin:${skin.toHexString()}`;
    const hairId = `hair:${hair.toHexString()}`;
    lib.define(skinId, { color: skin, roughness: 0.6, outline: true, wettable: 0.5 });
    lib.define(hairId, { color: hair, roughness: 0.5, outline: true, wettable: 0.8 });
    lib.define("boots", {
      color: new Color3(0.08, 0.08, 0.09),
      roughness: 0.3,
      outline: true,
      wettable: 0.6,
    });

    this.root = new TransformNode(name, scene);
    this.body = new TransformNode(`${name}:body`, scene);
    this.body.parent = this.root;

    const part = (mesh: Mesh, surface: string, parent: TransformNode, pos: Vector3): Mesh => {
      mesh.convertToFlatShadedMesh();
      mesh.parent = parent;
      mesh.position.copyFrom(pos);
      lib.assign(mesh, surface);
      this.meshes.push(mesh);
      return mesh;
    };
    const cyl = (n: string, height: number, top: number, bottom: number, tess = 6) =>
      MeshBuilder.CreateCylinder(
        n,
        { height, diameterTop: top, diameterBottom: bottom, tessellation: tess },
        scene,
      );

    // Cartoon proportions: big head, compact torso, sturdy legs.
    part(cyl("torso", 0.62, 0.56, 0.42), `${k}:shirt`, this.body, new Vector3(0, 1.28, 0));
    part(cyl("shorts", 0.26, 0.44, 0.48), `${k}:shorts`, this.body, new Vector3(0, 0.9, 0));
    part(
      MeshBuilder.CreateIcoSphere("head", { radius: 0.21, subdivisions: 1 }, scene),
      skinId,
      this.body,
      new Vector3(0, 1.84, 0),
    );
    const hairMesh = part(
      MeshBuilder.CreateIcoSphere("hair", { radius: 0.225, subdivisions: 1 }, scene),
      hairId,
      this.body,
      new Vector3(0, 1.9, -0.02),
    );
    hairMesh.scaling.set(1, 0.7, 1.02);
    part(cyl("neck", 0.12, 0.12, 0.14, 5), skinId, this.body, new Vector3(0, 1.64, 0));

    for (const side of [-1, 1]) {
      const hip = new TransformNode(`${name}:hip${side}`, scene);
      hip.parent = this.body;
      hip.position.set(0, 0.86, side * 0.12);
      part(cyl("thigh", 0.38, 0.18, 0.15, 5), skinId, hip, new Vector3(0, -0.2, 0));
      part(cyl("sock", 0.42, 0.15, 0.12, 5), `${k}:socks`, hip, new Vector3(0, -0.58, 0));
      part(
        MeshBuilder.CreateBox("boot", { width: 0.26, height: 0.1, depth: 0.12 }, scene),
        "boots",
        hip,
        new Vector3(0.05, -0.82, 0),
      );
      this.legs.push(hip);

      const shoulder = new TransformNode(`${name}:shoulder${side}`, scene);
      shoulder.parent = this.body;
      shoulder.position.set(0, 1.52, side * 0.31);
      part(cyl("sleeve", 0.24, 0.16, 0.14, 5), `${k}:shirt`, shoulder, new Vector3(0, -0.1, 0));
      part(cyl("arm", 0.4, 0.12, 0.1, 5), skinId, shoulder, new Vector3(0, -0.4, 0));
      this.arms.push(shoulder);
    }
  }

  /** Pose the run cycle. `phase` advances with distance travelled; `effort` 0 = idle, 1 = sprint. */
  pose(phase: number, effort: number): void {
    const swing = 0.15 + 0.75 * effort;
    for (let i = 0; i < 2; i++) {
      const s = Math.sin(phase + i * Math.PI);
      this.legs[i].rotation.z = s * swing;
      this.arms[i].rotation.z = -s * swing * 0.8;
      this.arms[i].rotation.x = (i === 0 ? -1 : 1) * 0.12;
    }
    this.body.position.set(0, Math.abs(Math.sin(phase)) * 0.06 * effort, 0);
    this.body.rotation.set(0, 0, -0.12 * effort); // lean into the run
  }

  /**
   * Override the run cycle for an action (docs/specs/10 §3 and §7). `progress` runs 0 → 1.
   * The body pivots at the feet: a positive z rotation tips it backwards, swinging the legs forwards.
   */
  poseAction(kind: PoseAction, progress: number): void {
    const b = this.body;
    const ease = Math.sin(Math.min(1, progress) * Math.PI); // 0 → 1 → 0
    switch (kind) {
      case "slide":
        // Lying back with the legs out in front.
        b.rotation.z = 1.15;
        b.position.set(0.45, 0, 0);
        this.legs[0].rotation.z = 0.15;
        this.legs[1].rotation.z = -0.1;
        this.arms[0].rotation.z = this.arms[1].rotation.z = -1.2;
        break;
      case "recover": {
        // Getting up from a slide: ease from lying back to standing.
        const k = 1 - smoothstep(progress);
        b.rotation.z = 1.15 * k;
        b.position.set(0.45 * k, 0, 0);
        this.legs[0].rotation.z = 0.15 * k;
        this.legs[1].rotation.z = -0.1 * k;
        this.arms[0].rotation.z = this.arms[1].rotation.z = -1.2 * k;
        break;
      }
      case "stumble":
        // Thrown off balance: lurch forward and sway once, arms out.
        b.rotation.z = -0.35 * ease - 0.08 * Math.sin(progress * Math.PI * 3);
        b.rotation.x = 0.1 * Math.sin(progress * Math.PI * 2);
        b.position.y = -0.08;
        this.arms[0].rotation.z = 1.4;
        this.arms[1].rotation.z = -1.1;
        break;
      case "header":
        // Diving forwards, flat, then landing.
        b.rotation.z = -1.3 * ease;
        b.position.set(0.3 * ease, 0.45 * ease, 0);
        this.arms[0].rotation.z = this.arms[1].rotation.z = 2.4 * ease;
        break;
      case "bicycle":
        // Flipped over backwards, the kicking leg high above the head.
        b.rotation.z = 2.4 * ease;
        b.position.set(0.6 * ease, 1.45 * ease, 0);
        this.legs[0].rotation.z = -0.9 * ease;
        this.legs[1].rotation.z = 0.5 * ease;
        break;
      case "volley":
      case "kick":
        // Kicking leg swings through, body leans back a little.
        b.rotation.z = 0.15 * ease;
        this.legs[1].rotation.z = -0.6 + 1.9 * Math.min(1, progress * 1.6);
        this.legs[0].rotation.z = -0.2;
        this.arms[0].rotation.z = 0.7 * ease;
        break;
      case "tackle":
        b.rotation.z = -0.3 * ease;
        this.legs[0].rotation.z = 1.0 * ease;
        break;
    }
  }
}

export type PoseAction =
  "slide" | "recover" | "stumble" | "header" | "bicycle" | "volley" | "kick" | "tackle";

function smoothstep(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

export function buildBall(scene: Scene, lib: SurfaceLibrary): Mesh {
  const tex = new DynamicTexture("ballTex", { width: 256, height: 128 }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  ctx.fillStyle = "#f7f7f2";
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = "#16161a";
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      const x = (col + (row % 2) * 0.5) * 51.2 + 10;
      const y = 22 + row * 42;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(x + Math.cos(a) * 11, y + Math.sin(a) * 11);
      }
      ctx.fill();
    }
  }
  tex.update();
  lib.define("ball", {
    color: new Color3(1, 1, 1),
    roughness: 0.35,
    texture: tex,
    outline: true,
    wettable: 0.8,
  });
  // Arcade games draw the ball larger than life so it is easy to follow (real radius is 0.11 m).
  const ball = MeshBuilder.CreateSphere("ball", { diameter: 0.36, segments: 6 }, scene);
  ball.convertToFlatShadedMesh();
  lib.assign(ball, "ball");
  return ball;
}

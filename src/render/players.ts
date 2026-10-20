import { Color3, DynamicTexture, Mesh, MeshBuilder, Scene, TransformNode, Vector3 } from "@babylonjs/core";
import { DEFAULT_PARAMS } from "../sim/params";
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
    shirt: Color3.FromHexString("#b3101e"),
    shorts: Color3.FromHexString("#f5f5f0"),
    socks: Color3.FromHexString("#b3101e"),
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
  /** The referee and assistants: all in black. */
  referee: {
    id: "referee",
    shirt: Color3.FromHexString("#151515"),
    shorts: Color3.FromHexString("#0b0b0b"),
    socks: Color3.FromHexString("#151515"),
  },
};

/** Which colour a body part takes. */
export type PartColour = "shirt" | "shorts" | "socks" | "skin" | "hair" | "boots";
/** The joint a body part hangs from: the body, or one of the hips or shoulders. */
type Joint = "body" | "hip" | "shoulder";

export interface PartSpec {
  name: string;
  colour: PartColour;
  joint: Joint;
  position: Vector3;
  scaling?: Vector3;
  build(scene: Scene): Mesh;
}

const cylinder =
  (height: number, top: number, bottom: number, tessellation = 6) =>
  (scene: Scene): Mesh =>
    MeshBuilder.CreateCylinder(
      "part",
      { height, diameterTop: top, diameterBottom: bottom, tessellation },
      scene,
    );

/** The placeholder footballer, part by part. Cartoon proportions: big head, compact torso, sturdy legs. */
export const PARTS: PartSpec[] = [
  {
    name: "torso",
    colour: "shirt",
    joint: "body",
    position: new Vector3(0, 1.28, 0),
    build: cylinder(0.62, 0.56, 0.42),
  },
  {
    name: "shorts",
    colour: "shorts",
    joint: "body",
    position: new Vector3(0, 0.9, 0),
    build: cylinder(0.26, 0.44, 0.48),
  },
  {
    name: "head",
    colour: "skin",
    joint: "body",
    position: new Vector3(0, 1.84, 0),
    build: (scene) => MeshBuilder.CreateIcoSphere("part", { radius: 0.21, subdivisions: 1 }, scene),
  },
  {
    name: "hair",
    colour: "hair",
    joint: "body",
    position: new Vector3(0, 1.9, -0.02),
    scaling: new Vector3(1, 0.7, 1.02),
    build: (scene) => MeshBuilder.CreateIcoSphere("part", { radius: 0.225, subdivisions: 1 }, scene),
  },
  {
    name: "neck",
    colour: "skin",
    joint: "body",
    position: new Vector3(0, 1.64, 0),
    build: cylinder(0.12, 0.12, 0.14, 5),
  },
  {
    name: "thigh",
    colour: "skin",
    joint: "hip",
    position: new Vector3(0, -0.2, 0),
    build: cylinder(0.38, 0.18, 0.15, 5),
  },
  {
    name: "sock",
    colour: "socks",
    joint: "hip",
    position: new Vector3(0, -0.58, 0),
    build: cylinder(0.42, 0.15, 0.12, 5),
  },
  {
    name: "boot",
    colour: "boots",
    joint: "hip",
    position: new Vector3(0.05, -0.82, 0),
    build: (scene) => MeshBuilder.CreateBox("part", { width: 0.26, height: 0.1, depth: 0.12 }, scene),
  },
  {
    name: "sleeve",
    colour: "shirt",
    joint: "shoulder",
    position: new Vector3(0, -0.1, 0),
    build: cylinder(0.24, 0.16, 0.14, 5),
  },
  {
    name: "arm",
    colour: "skin",
    joint: "shoulder",
    position: new Vector3(0, -0.4, 0),
    build: cylinder(0.4, 0.12, 0.1, 5),
  },
];

export const BOOTS = new Color3(0.08, 0.08, 0.09);

/**
 * What the match and the officials drive to show a person: the placeholder `PlayerRig`, or the new model's
 * `CharacterRig` (characterRig.ts, the character test). `root` faces +x at no rotation.
 */
export interface Rig {
  readonly root: TransformNode;
  /** The run cycle: `phase` advances with distance, `effort` 0 = idle, 1 = sprint; `dt` is seconds this frame. */
  pose(phase: number, effort: number, dt?: number): void;
  poseAction(kind: PoseAction, progress: number): void;
  signal(kind: Signal, progress: number): void;
  hand(): TransformNode;
}

/**
 * A footballer's skeleton: the joints the run cycle and actions move. It has no meshes of its own; body parts
 * hang from `joints(part)` (see `Player`, and `Squad` for many players drawn in one go).
 */
export class PlayerRig implements Rig {
  readonly root: TransformNode;
  private readonly body: TransformNode;
  private readonly legs: TransformNode[] = [];
  private readonly arms: TransformNode[] = [];

  constructor(scene: Scene, name: string) {
    this.root = new TransformNode(name, scene);
    this.body = new TransformNode(`${name}:body`, scene);
    this.body.parent = this.root;
    for (const side of [-1, 1]) {
      const hip = new TransformNode(`${name}:hip${side}`, scene);
      hip.parent = this.body;
      hip.position.set(0, 0.86, side * 0.12);
      this.legs.push(hip);
      const shoulder = new TransformNode(`${name}:shoulder${side}`, scene);
      shoulder.parent = this.body;
      shoulder.position.set(0, 1.52, side * 0.31);
      this.arms.push(shoulder);
    }
  }

  /** Bring the joints' world matrices up to date with the pose, parents first. */
  computeWorldMatrices(): void {
    this.root.computeWorldMatrix(true);
    this.body.computeWorldMatrix(true);
    for (const joint of [...this.legs, ...this.arms]) joint.computeWorldMatrix(true);
  }

  /** A node at the end of the right arm, for things held in the hand (a card, a flag). */
  hand(): TransformNode {
    const hand = new TransformNode(`${this.root.name}:hand`, this.root.getScene());
    hand.parent = this.arms[1];
    hand.position.set(0, -0.64, 0);
    return hand;
  }

  /**
   * An official's arm signal on top of the run cycle (docs/specs/10 §6). `progress` is seconds since the call;
   * the arm comes up quickly and stays.
   */
  signal(kind: Signal, progress: number): void {
    const up = Math.min(1, progress * 5);
    const [left, right] = this.arms;
    switch (kind) {
      case "whistle":
        // Whistle to the mouth: right hand up in front of the face.
        right.rotation.set(0, 0, 2.5 * up);
        break;
      case "point":
        // Arm straight out in front, the way the root faces.
        right.rotation.set(0, 0, 1.55 * up);
        break;
      case "advantage":
        // Both arms forward: play on.
        left.rotation.set(0, 0, 1.35 * up);
        right.rotation.set(0, 0, 1.35 * up);
        break;
      case "card":
      case "flag":
        // Straight up above the head.
        right.rotation.set(0, 0, 3.05 * up);
        break;
    }
  }

  /** The joints a part hangs from: one for the body, one per side for hips and shoulders. */
  joints(part: PartSpec): TransformNode[] {
    return part.joint === "body" ? [this.body] : part.joint === "hip" ? this.legs : this.arms;
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
      case "dive": {
        // Goalkeeper dive: launched flat towards the ball, arms stretched out, then down on the grass.
        const up = Math.min(1, progress * 3);
        b.rotation.z = -1.45 * up;
        b.position.set(0.35 * up, 0.55 * ease, 0);
        this.arms[0].rotation.z = this.arms[1].rotation.z = 2.7 * up;
        break;
      }
    }
  }
}

/** One footballer with its own meshes (the look-test). The match draws all players at once with `Squad`. */
export class Player extends PlayerRig {
  readonly meshes: Mesh[] = [];

  constructor(scene: Scene, lib: SurfaceLibrary, name: string, kit: Kit, skin: Color3, hair: Color3) {
    super(scene, name);
    const colours: Record<PartColour, Color3> = {
      shirt: kit.shirt,
      shorts: kit.shorts,
      socks: kit.socks,
      skin,
      hair,
      boots: BOOTS,
    };
    for (const part of PARTS) {
      const id = `${part.colour}:${colours[part.colour].toHexString()}`;
      lib.define(id, { color: colours[part.colour], ...PART_SURFACE[part.colour], outline: true });
      for (const joint of this.joints(part)) {
        const mesh = part.build(scene);
        mesh.name = part.name;
        mesh.convertToFlatShadedMesh();
        mesh.parent = joint;
        mesh.position.copyFrom(part.position);
        if (part.scaling) mesh.scaling.copyFrom(part.scaling);
        lib.assign(mesh, id);
        this.meshes.push(mesh);
      }
    }
  }
}

/** How each kind of part responds to light and rain. */
export const PART_SURFACE: Record<PartColour, { roughness: number; wettable: number }> = {
  shirt: { roughness: 0.7, wettable: 0.6 },
  shorts: { roughness: 0.7, wettable: 0.6 },
  socks: { roughness: 0.8, wettable: 0.4 },
  skin: { roughness: 0.6, wettable: 0.5 },
  hair: { roughness: 0.5, wettable: 0.8 },
  boots: { roughness: 0.3, wettable: 0.6 },
};

export type PoseAction =
  "slide" | "recover" | "stumble" | "header" | "bicycle" | "volley" | "kick" | "tackle" | "dive";

/** The referee's and assistants' arm signals. */
export type Signal = "whistle" | "point" | "advantage" | "card" | "flag";

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
  const ball = MeshBuilder.CreateSphere(
    "ball",
    { diameter: DEFAULT_PARAMS.ball.drawRadius * 2, segments: 6 },
    scene,
  );
  ball.convertToFlatShadedMesh();
  lib.assign(ball, "ball");
  return ball;
}

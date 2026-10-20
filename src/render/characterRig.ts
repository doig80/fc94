import {
  Quaternion,
  Vector3,
  TransformNode,
  type AbstractMesh,
  type Node,
  type Scene,
} from "@babylonjs/core";
import { Character, FACING, HAIRSTYLES, type CharacterAssets } from "./character";
import type { Color3 } from "@babylonjs/core";
import type { Kit, PoseAction, Rig, Signal } from "./players";

/** The speed (m/s) a rig's `effort` of 1 stands for: a sprint. */
const SPRINT = 8.5;

/** Axes in the model's own space (glTF: he faces +z, +x is his left, +y is up). */
const LEFT = new Vector3(1, 0, 0);
const FORWARD = new Vector3(0, 0, 1);

/**
 * A bone turned by `angle` about `axis` (model space), on top of what the animations do. About LEFT, a negative
 * angle swings a leg or an arm forwards (and tips the spine back); a positive one swings it back (tips forwards).
 */
type Turn = [bone: string, axis: Vector3, angle: number];

function smoothstep(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

/** A curve through (time, value) keys, eased between them. */
function keys(t: number, points: [number, number][]): number {
  for (let k = 1; k < points.length; k++) {
    const [t1, v1] = points[k];
    const [t0, v0] = points[k - 1];
    if (t <= t1) return v0 + (v1 - v0) * smoothstep((t - t0) / (t1 - t0));
  }
  return points[points.length - 1][1];
}

/**
 * The new player model (issue #27) behind the same controls as the placeholder players' `PlayerRig`, so the match
 * and the officials drive it the same way: running comes from the animations, blended by speed; kicks, tackles,
 * slides, dives and the referee's signals are simple poses laid over them until the football moves from Mixamo
 * arrive. The body tilts like the placeholder's (same numbers); arms and legs are turned bone by bone.
 */
export class CharacterRig implements Rig {
  /** Move and turn this, as with the placeholders: it faces +x at no rotation. */
  readonly root: TransformNode;
  readonly meshes: AbstractMesh[];
  readonly shadowCaster: AbstractMesh;
  /** Whole-body tilts and lifts, pivoting at the feet like the placeholder's body. */
  private readonly body: TransformNode;
  private readonly character: Character;
  private readonly armature: TransformNode;
  private turns: Turn[] = [];
  /** Where the root was at the last `pose`, to stride by the distance covered. */
  private readonly last = new Vector3(Number.NaN, 0, 0);

  constructor(
    scene: Scene,
    assets: CharacterAssets,
    name: string,
    kit: Kit,
    look: { hair: Color3; hairstyle: (typeof HAIRSTYLES)[number] },
  ) {
    this.root = new TransformNode(name, scene);
    this.body = new TransformNode(`${name}:body`, scene);
    this.body.parent = this.root;
    this.character = new Character(scene, assets, `${name}:model`, kit, look);
    this.character.root.parent = this.body;
    this.character.root.rotation.y = FACING;
    this.meshes = this.character.meshes;
    this.shadowCaster = this.character.shadowCaster;
    this.armature = this.character.bones.get("Armature")!;
    // The poses go on after the animations have set the bones for this frame.
    scene.onAfterAnimationsObservable.add(() => this.applyTurns());
  }

  /**
   * Run at `effort` × sprint speed, striding by the distance the root has moved since the last call (so slow motion
   * and freezes slow or hold the legs, as with the placeholders); `dt` paces the idle. `phase` isn't needed.
   */
  pose(_phase: number, effort: number, dt = 0): void {
    const p = this.root.position;
    const moved = Math.hypot(p.x - this.last.x, p.z - this.last.z);
    this.last.copyFrom(p);
    // A jump (the first frame, a restart) isn't a stride.
    this.character.run(effort * SPRINT, dt, moved < 2 ? moved : 0);
    this.body.position.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.turns = [];
  }

  /** An action's pose over the run, `progress` 0 → 1 (as `PlayerRig.poseAction`). */
  poseAction(kind: PoseAction, progress: number): void {
    const b = this.body;
    const ease = Math.sin(Math.min(1, progress) * Math.PI); // 0 → 1 → 0
    switch (kind) {
      case "volley":
      case "kick":
        // Back-swing, strike, follow through; the body leans back a little and the left arm goes out.
        b.rotation.z = 0.12 * ease;
        this.turns = [
          [
            "thigh_r",
            LEFT,
            keys(progress, [
              [0, 0],
              [0.25, 0.6],
              [0.55, -1.3],
              [1, 0],
            ]),
          ],
          [
            "calf_r",
            LEFT,
            keys(progress, [
              [0, 0],
              [0.25, 1.1],
              [0.55, 0.1],
              [1, 0],
            ]),
          ],
          ["upperarm_l", FORWARD, 0.9 * ease],
        ];
        break;
      case "tackle":
        // A lunge: the left leg reaches for the ball.
        b.rotation.z = -0.3 * ease;
        this.turns = [["thigh_l", LEFT, -1.1 * ease]];
        break;
      case "slide":
      case "recover": {
        // Lying back with the legs out in front; getting up eases back to standing.
        const k = kind === "slide" ? 1 : 1 - smoothstep(progress);
        b.rotation.z = 1.15 * k;
        b.position.set(0.45 * k, 0, 0);
        this.turns = [
          ["thigh_l", LEFT, -0.35 * k],
          ["upperarm_l", LEFT, 0.9 * k],
          ["upperarm_r", LEFT, 0.9 * k],
        ];
        break;
      }
      case "stumble":
        // Thrown off balance: lurch forward and sway, arms out.
        b.rotation.z = -0.35 * ease - 0.08 * Math.sin(progress * Math.PI * 3);
        b.position.y = -0.08;
        this.turns = [
          ["upperarm_l", FORWARD, 1.2],
          ["upperarm_r", FORWARD, -1.2],
        ];
        break;
      case "header":
        // Diving forwards, flat, arms reaching ahead.
        b.rotation.z = -1.3 * ease;
        b.position.set(0.3 * ease, 0.45 * ease, 0);
        this.turns = [
          ["upperarm_l", LEFT, -2.2 * ease],
          ["upperarm_r", LEFT, -2.2 * ease],
        ];
        break;
      case "bicycle":
        // Flipped over backwards, the kicking leg high above the head.
        b.rotation.z = 2.4 * ease;
        b.position.set(0.6 * ease, 1.45 * ease, 0);
        this.turns = [
          ["thigh_r", LEFT, -1.5 * ease],
          ["thigh_l", LEFT, 0.4 * ease],
        ];
        break;
      case "dive": {
        // The keeper launches flat at the ball, arms stretched out, then lands on the grass.
        const up = Math.min(1, progress * 3);
        b.rotation.z = -1.45 * up;
        b.position.set(0.35 * up, 0.55 * ease, 0);
        this.turns = [
          ["upperarm_l", LEFT, -2.8 * up],
          ["upperarm_r", LEFT, -2.8 * up],
        ];
        break;
      }
    }
  }

  /** An official's arm signal over the run (as `PlayerRig.signal`): the arm comes up quickly and stays. */
  signal(kind: Signal, progress: number): void {
    const up = Math.min(1, progress * 5);
    switch (kind) {
      case "whistle":
        // Whistle to the mouth: the right hand up in front of the face.
        this.turns = [
          ["upperarm_r", LEFT, -1.2 * up],
          ["lowerarm_r", LEFT, -1.6 * up],
        ];
        break;
      case "point":
        // Arm straight out in front, the way he faces.
        this.turns = [["upperarm_r", LEFT, -1.55 * up]];
        break;
      case "advantage":
        // Both arms forward: play on.
        this.turns = [
          ["upperarm_l", LEFT, -1.35 * up],
          ["upperarm_r", LEFT, -1.35 * up],
        ];
        break;
      case "card":
      case "flag":
        // Straight up above the head.
        this.turns = [["upperarm_r", LEFT, -3.0 * up]];
        break;
    }
  }

  /**
   * A node in the right palm, for a card or a flag, turned to match the placeholder's hand: there the arm runs down
   * its -y and +x is forward; the bone runs along its +y with +z forward (in the model's rest pose).
   */
  hand(): TransformNode {
    const hand = new TransformNode(`${this.root.name}:hand`, this.root.getScene());
    hand.parent = this.character.bones.get("hand_r")!;
    hand.position.set(0, 0.08, 0);
    hand.rotationQuaternion = new Quaternion(Math.SQRT1_2, 0, Math.SQRT1_2, 0);
    return hand;
  }

  /**
   * Turn each bone about its axis in model space: its new local rotation is G⁻¹ · R · G · L, where G is the model-space
   * rotation of its parent (from the armature down) and L its rotation from the animations. Parents come first in the
   * lists, so a child's G already includes its parent's turn.
   */
  private applyTurns(): void {
    for (const [name, axis, angle] of this.turns) {
      if (angle === 0) continue;
      const bone = this.character.bones.get(name);
      if (!bone) continue;
      const g = this.modelRotation(bone.parent);
      const local = bone.rotationQuaternion ?? Quaternion.FromEulerVector(bone.rotation);
      const turn = Quaternion.RotationAxis(axis, angle);
      bone.rotationQuaternion = Quaternion.Inverse(g).multiply(turn).multiply(g).multiply(local);
    }
  }

  /** The rotation from `node`'s space to the model's, multiplying from the armature down. */
  private modelRotation(node: Node | null): Quaternion {
    const chain: Quaternion[] = [];
    for (let n = node; n && n !== this.armature.parent; n = n.parent) {
      if (n instanceof TransformNode)
        chain.push(n.rotationQuaternion ?? Quaternion.FromEulerVector(n.rotation));
    }
    let g = Quaternion.Identity();
    for (let k = chain.length - 1; k >= 0; k--) g = g.multiply(chain[k]);
    return g;
  }
}

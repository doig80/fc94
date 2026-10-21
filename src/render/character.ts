import {
  Animation,
  Color3,
  Constants,
  LoadAssetContainerAsync,
  Mesh,
  PBRMaterial,
  Quaternion,
  RawTexture,
  Scene,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type AssetContainer,
} from "@babylonjs/core";
import { MAX_LIGHTS } from "./materials";
import { BOOTS, type Kit } from "./players";

/**
 * The character test (issue #27): a real player model with real animation, to compare with the placeholder players.
 * Quaternius's "Universal Base Characters" man (CC0), with idle, walk, jog and sprint and a few moves from his
 * "Universal Animation Library" 1 and 2 (CC0, the same skeleton), prepared by scripts/assets/prepare_player.py and
 * made lighter by scripts/assets/player_lods.ts. Loaded after the match has started, so it doesn't add to the wait.
 */
const FOLDER = `${import.meta.env.BASE_URL}assets/characters/`;

/** The animations and the ground speed each was made for (m/s, measured from the library's root-motion version). */
export const GAITS = [
  { name: "Idle_Loop", speed: 0 },
  { name: "Walk_Loop", speed: 0.97 },
  { name: "Jog_Fwd_Loop", speed: 5.36 },
  { name: "Sprint_Loop", speed: 8.25 },
] as const;

/**
 * The moves laid over the running (`Character.move`): the slide tackle and getting up from it, the keeper's dive (a
 * dive roll: the dive, then rolling over and getting up), and the jump for a header.
 */
export const MOVES = ["Slide_Start", "Slide_Exit", "Roll", "Jump_Start"] as const;
export type Move = (typeof MOVES)[number];

/**
 * Beyond this distance from the camera (m), each player is drawn with the far versions of his meshes (`<name>_LOD1`
 * in player.glb), and the eyes and eyebrows not at all. The match camera sees most players from further away; replays
 * and close-ups show the near versions.
 */
export const FAR = 24;

/** The model faces +z; our players face +x before turning to their heading. */
export const FACING = Math.PI / 2;

/** The hairstyles in player.glb; each player shows one. */
export const HAIRSTYLES = ["Hair_SimpleParted", "Hair_Buzzed"] as const;

/** Region numbers in player-kit.png (grey level ÷ 50). */
const REGION = { skin: 0, shirt: 1, shorts: 2, socks: 3, boots: 4 } as const;

/**
 * One animation's motion, sampled when the model loads: for each animated bone property ("thigh_r
 * rotationQuaternion", "pelvis position"), its value at every frame, first to last (4 numbers a frame for a rotation,
 * 3 for a position).
 */
export interface GaitClip {
  name: string;
  /** The ground speed it was made for (m/s; 0 for a move), and its length (s). */
  speed: number;
  seconds: number;
  tracks: Map<string, Float32Array>;
}

export interface CharacterAssets {
  container: AssetContainer;
  /** The body's colour texture and the kit map, as RGBA pixels. */
  skin: ImageData;
  kit: ImageData;
  /** `GAITS`, in the same order, and `MOVES`. */
  gaits: GaitClip[];
  moves: Map<Move, GaitClip>;
}

async function pixels(url: string): Promise<ImageData> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, image.width, image.height);
}

/** Load the model (and the glTF loader) once; every character is a copy of it. */
export async function loadCharacterAssets(scene: Scene): Promise<CharacterAssets> {
  await import("@babylonjs/loaders/glTF/2.0");
  const [container, skin, kit] = await Promise.all([
    LoadAssetContainerAsync(`${FOLDER}player.glb`, scene),
    pixels(`${FOLDER}player-skin.jpg`),
    pixels(`${FOLDER}player-kit.png`),
  ]);
  const gaits = GAITS.map((g) => sample(container, g.name, g.speed));
  const moves = new Map(MOVES.map((name) => [name, sample(container, name, 0)]));
  // The characters are posed by `Character.run` and `move`, not by Babylon's animation player: the copies don't need
  // the animations.
  for (const group of [...container.animationGroups]) group.dispose();
  return { container, skin, kit, gaits, moves };
}

/** Sample one of the model's animations, frame by frame (see `GaitClip`). */
function sample(container: AssetContainer, name: string, speed: number): GaitClip {
  const group = container.animationGroups.find((a) => a.name.endsWith(name));
  if (!group) throw new Error(`Character animation ${name} is missing`);
  const fps = group.targetedAnimations[0]?.animation.framePerSecond ?? 60;
  const frames = Math.max(1, Math.round(group.to - group.from));
  const tracks = new Map<string, Float32Array>();
  for (const { target, animation } of group.targetedAnimations) {
    const size = animation.dataType === Animation.ANIMATIONTYPE_QUATERNION ? 4 : 3;
    const values = new Float32Array((frames + 1) * size);
    for (let f = 0; f <= frames; f++) {
      const v = animation.evaluate(group.from + ((group.to - group.from) * f) / frames) as Record<
        string,
        number
      >;
      const at = f * size;
      values.set(size === 4 ? [v.x, v.y, v.z, v.w] : [v.x, v.y, v.z], at);
      // A rotation and its negative are the same turn: keep each frame on the same side as the one before, so
      // the frames in between blend the short way round.
      if (size === 4 && f > 0) {
        let dot = 0;
        for (let k = 0; k < 4; k++) dot += values[at + k] * values[at - 4 + k];
        if (dot < 0) for (let k = 0; k < 4; k++) values[at + k] = -values[at + k];
      }
    }
    tracks.set(`${(target as { name: string }).name} ${animation.targetProperty}`, values);
  }
  return { name, speed, seconds: frames / fps, tracks };
}

/** The body texture with `kit` painted on: flat colours for the kit, the skin as it is everywhere else. */
function kitTexture(scene: Scene, assets: CharacterAssets, kit: Kit, name: string): RawTexture {
  const { skin, kit: map } = assets;
  const colour = (c: Color3) => [c.r * 255, c.g * 255, c.b * 255];
  const fill: Record<number, number[]> = {
    [REGION.shirt]: colour(kit.shirt),
    [REGION.shorts]: colour(kit.shorts),
    [REGION.socks]: colour(kit.socks),
    [REGION.boots]: colour(BOOTS),
  };
  const out = new Uint8Array(skin.data);
  const sx = map.width / skin.width;
  const sy = map.height / skin.height;
  for (let y = 0; y < skin.height; y++) {
    for (let x = 0; x < skin.width; x++) {
      const region = Math.round(map.data[(Math.floor(y * sy) * map.width + Math.floor(x * sx)) * 4] / 50);
      const c = fill[region];
      if (!c) continue;
      const i = (y * skin.width + x) * 4;
      out[i] = c[0];
      out[i + 1] = c[1];
      out[i + 2] = c[2];
    }
  }
  // glTF textures aren't flipped: the first row is the top (v = 0).
  const texture = RawTexture.CreateRGBATexture(
    out,
    skin.width,
    skin.height,
    scene,
    true,
    false,
    Constants.TEXTURE_TRILINEAR_SAMPLINGMODE,
  );
  texture.name = `${name}:kit`;
  return texture;
}

/**
 * How much of each gait to show at `speed` (m/s), and how fast the cycle goes: the two gaits around that speed are
 * blended; a running gait cycles once per stride it covers (`perMetre`), so the feet don't slide, and idle breathes
 * at its own pace (`perSecond`). `gaits` are in order of speed, from standing.
 */
export function blendGaits(
  gaits: readonly { speed: number; seconds: number }[],
  speed: number,
): { weights: number[]; perMetre: number; perSecond: number } {
  const weights = gaits.map(() => 0);
  let k = 0;
  while (k < gaits.length - 2 && speed > gaits[k + 1].speed) k++;
  const t = Math.min(1, Math.max(0, (speed - gaits[k].speed) / (gaits[k + 1].speed - gaits[k].speed)));
  weights[k] = 1 - t;
  weights[k + 1] = t;
  let perMetre = 0;
  let perSecond = 0;
  gaits.forEach((g, i) => {
    if (g.speed > 0) perMetre += weights[i] / (g.speed * g.seconds);
    else perSecond += weights[i] / g.seconds;
  });
  return { weights, perMetre, perSecond };
}

const scratch = [0, 0, 0, 0];

/**
 * One bone property's value from the gaits: each gait with a weight is read at `phase` (0 → 1 through its loop,
 * between its sampled frames) and they are mixed by `weights` into `out`, a rotation (4 numbers, kept unit length)
 * or a position (3). `tracks[i]` is gait i's samples (see `GaitClip`), if it moves this property. Returns false, and
 * leaves `out` alone, when no gait with a weight moves it.
 */
export function blendTrack(
  tracks: readonly (Float32Array | undefined)[],
  size: 3 | 4,
  weights: readonly number[],
  phase: number,
  out: number[],
): boolean {
  let total = 0;
  for (let g = 0; g < tracks.length; g++) {
    const values = tracks[g];
    const w = weights[g];
    if (!values || !(w > 0)) continue;
    const frames = values.length / size - 1;
    const f = phase * frames;
    const i = Math.min(Math.floor(f), frames - 1);
    const t = f - i;
    let dot = 0;
    for (let k = 0; k < size; k++) {
      const a = values[i * size + k];
      scratch[k] = a + (values[(i + 1) * size + k] - a) * t;
      dot += scratch[k] * (total > 0 ? out[k] : 0);
    }
    // A rotation and its negative are the same turn: add this one on the same side as the mix so far.
    const sign = size === 4 && dot < 0 ? -1 : 1;
    for (let k = 0; k < size; k++) out[k] = (total > 0 ? out[k] : 0) + sign * w * scratch[k];
    total += w;
  }
  if (total === 0) return false;
  if (size === 4) {
    const len = Math.hypot(out[0], out[1], out[2], out[3]);
    for (let k = 0; k < 4; k++) out[k] /= len;
  } else {
    for (let k = 0; k < 3; k++) out[k] /= total;
  }
  return true;
}

/** One player: a copy of the model in a team's kit, running with the animations blended by speed. */
export class Character {
  /** Move and turn this; the model sits under it. */
  readonly root: TransformNode;
  readonly meshes: AbstractMesh[];
  /** The mesh that casts a shadow: the body (the hair, eyes and eyebrows are too small to show in it). */
  readonly shadowCaster: AbstractMesh;
  /** The skeleton's nodes by bone name ("thigh_r"…), and the model's own top node ("Armature"). */
  readonly bones = new Map<string, TransformNode>();
  private readonly gaits: GaitClip[];
  private readonly moves: GaitClip[];
  /**
   * Every bone property the gaits or moves animate, on this player's own skeleton: its value at rest, and each gait's
   * and each move's samples of it (if they move it).
   */
  private readonly channels: {
    node: TransformNode;
    property: "rotationQuaternion" | "position" | "scaling";
    size: 3 | 4;
    rest: number[];
    tracks: (Float32Array | undefined)[];
    moves: (Float32Array | undefined)[];
  }[] = [];
  private readonly value = [0, 0, 0, 0];
  private readonly turn = new Quaternion();
  private phase = 0;

  constructor(
    scene: Scene,
    assets: CharacterAssets,
    name: string,
    kit: Kit,
    look: { hair: Color3; hairstyle: (typeof HAIRSTYLES)[number] },
  ) {
    this.root = new TransformNode(name, scene);
    const copy = assets.container.instantiateModelsToScene((n) => `${name}:${n}`, true);
    for (const node of copy.rootNodes) node.parent = this.root;
    for (const node of copy.rootNodes.flatMap((n) => n.getDescendants(false)))
      if (node instanceof TransformNode) this.bones.set(node.name.slice(name.length + 1), node);
    const all = copy.rootNodes.flatMap((n) => n.getChildMeshes(false));
    // One hairstyle: the others go.
    for (const mesh of all) {
      const style = HAIRSTYLES.find((h) => mesh.name.includes(h));
      if (style && style !== look.hairstyle) mesh.dispose();
    }
    this.meshes = all.filter((m) => !m.isDisposed());
    // Each mesh and its far version (`FAR`): the eyes and eyebrows have none, so they aren't drawn from there.
    const near = this.meshes.filter((m) => !m.name.endsWith("_LOD1"));
    for (const mesh of near) {
      const far = this.meshes.find((m) => m.name === `${mesh.name}_LOD1`) ?? null;
      if (mesh instanceof Mesh) mesh.addLODLevel(FAR, far as Mesh | null);
    }
    this.shadowCaster = near.find((m) => m.material?.name.includes("MI_Superhero"))!;
    // A far version shares its near version's material, so each is set up once.
    for (const mesh of near) {
      const m = mesh.material;
      if (!(m instanceof PBRMaterial)) continue;
      // Lit like the rest of the scene: the floodlights fall off over their range, not physically (see materials.ts).
      m.usePhysicalLightFalloff = false;
      m.maxSimultaneousLights = MAX_LIGHTS;
      if (m.name.includes("MI_Superhero")) {
        m.albedoTexture = kitTexture(scene, assets, kit, name);
        m.albedoColor = Color3.White();
      } else if (m.name.includes("MI_Hair")) {
        // Hair in one flat colour, like the rest of the game's stylised look; the eyebrows a darker shade of it,
        // or fair eyebrows read as goggles from the camera. The material's colour is linear; ours are as on screen,
        // as in the kit texture.
        m.albedoTexture = null;
        m.albedoColor = look.hair.toLinearSpace();
        if (mesh.name.includes("Eyebrows")) {
          const brows = m.clone(`${m.name}:brows`);
          brows.albedoColor = look.hair.scale(0.45).toLinearSpace();
          mesh.material = brows;
        }
      }
    }
    for (const mesh of this.meshes) {
      const nearer = mesh.name.endsWith("_LOD1") && near.find((m) => mesh.name === `${m.name}_LOD1`);
      if (nearer) mesh.material = nearer.material;
    }
    this.gaits = assets.gaits;
    this.moves = MOVES.map((name) => assets.moves.get(name)!);
    const keys = new Set([...this.gaits, ...this.moves].flatMap((clip) => [...clip.tracks.keys()]));
    for (const key of keys) {
      const [bone, property] = key.split(" ");
      const node = this.bones.get(bone);
      if (!node || (property !== "rotationQuaternion" && property !== "position" && property !== "scaling"))
        continue;
      node.rotationQuaternion ??= Quaternion.FromEulerVector(node.rotation);
      const q = node.rotationQuaternion;
      const v = node[property as "position" | "scaling"];
      this.channels.push({
        node,
        property,
        size: property === "rotationQuaternion" ? 4 : 3,
        rest: property === "rotationQuaternion" ? [q.x, q.y, q.z, q.w] : [v.x, v.y, v.z],
        tracks: this.gaits.map((g) => g.tracks.get(key)),
        moves: this.moves.map((clip) => clip.tracks.get(key)),
      });
    }
    this.run(0, 0);
  }

  /**
   * Put the player at `pos`, facing `heading` (on the ground), moving at `speed` m/s, with the gaits blended for
   * that speed (`blendGaits`); `dt` advances the stride (0 holds the pose).
   */
  place(pos: Vector3, heading: Vector3, speed: number, dt: number): void {
    this.root.position.copyFrom(pos);
    this.root.rotation.y = Math.atan2(-heading.z, heading.x) + FACING;
    this.run(speed, dt);
  }

  /**
   * Blend the gaits for `speed` m/s (`blendGaits`). The stride advances with the `distance` covered in this frame's
   * `dt` seconds (as it would at that speed, unless given): in slow motion or a freeze it slows or holds with the play.
   */
  run(speed: number, dt: number, distance = speed * dt): void {
    const { weights, perMetre, perSecond } = blendGaits(this.gaits, speed);
    this.phase = (this.phase + perMetre * distance + perSecond * dt) % 1;
    const v = this.value;
    for (const c of this.channels) {
      // A bone only the moves turn goes back to rest.
      const pose = blendTrack(c.tracks, c.size, weights, this.phase, v) ? v : c.rest;
      if (c.size === 4) c.node.rotationQuaternion!.set(pose[0], pose[1], pose[2], pose[3]);
      else c.node[c.property as "position" | "scaling"].set(pose[0], pose[1], pose[2]);
    }
  }

  /** How long one of `MOVES` lasts (s). */
  duration(name: Move): number {
    return this.moves[MOVES.indexOf(name)].seconds;
  }

  /**
   * Lay one of `MOVES` over the running pose `run` has just set, as it is `seconds` into it; `weight` 0 → 1 is how
   * far each bone it moves is turned from running towards it.
   */
  move(name: Move, seconds: number, weight: number): void {
    if (!(weight > 0)) return;
    const index = MOVES.indexOf(name);
    const t = Math.min(1, Math.max(0, seconds / this.moves[index].seconds));
    const v = this.value;
    for (const c of this.channels) {
      const track = c.moves[index];
      if (!track) continue;
      blendTrack([track], c.size, [1], t, v);
      if (c.size === 4) {
        const q = c.node.rotationQuaternion!;
        if (weight >= 1) q.set(v[0], v[1], v[2], v[3]);
        else Quaternion.SlerpToRef(q, this.turn.set(v[0], v[1], v[2], v[3]), weight, q);
      } else {
        const p = c.node[c.property as "position" | "scaling"];
        const w = Math.min(1, weight);
        p.set(p.x + (v[0] - p.x) * w, p.y + (v[1] - p.y) * w, p.z + (v[2] - p.z) * w);
      }
    }
  }

  dispose(): void {
    this.root.dispose(false, true);
  }
}

import {
  AnimationGroup,
  Color3,
  Constants,
  LoadAssetContainerAsync,
  PBRMaterial,
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
 * Quaternius's "Universal Base Characters" man (CC0), with idle, walk, jog and sprint from his "Universal Animation
 * Library" (CC0, the same skeleton), prepared by scripts/assets/prepare_player.py. Loaded only when asked for, so the
 * match doesn't download it.
 */
const FOLDER = `${import.meta.env.BASE_URL}assets/characters/`;

/** The animations and the ground speed each was made for (m/s, measured from the library's root-motion version). */
export const GAITS = [
  { name: "Idle_Loop", speed: 0 },
  { name: "Walk_Loop", speed: 0.97 },
  { name: "Jog_Fwd_Loop", speed: 5.36 },
  { name: "Sprint_Loop", speed: 8.25 },
] as const;

/** The model faces +z; our players face +x before turning to their heading. */
const FACING = Math.PI / 2;

/** The hairstyles in player.glb; each player shows one. */
export const HAIRSTYLES = ["Hair_SimpleParted", "Hair_Buzzed"] as const;

/** Region numbers in player-kit.png (grey level ÷ 50). */
const REGION = { skin: 0, shirt: 1, shorts: 2, socks: 3, boots: 4 } as const;

export interface CharacterAssets {
  container: AssetContainer;
  /** The body's colour texture and the kit map, as RGBA pixels. */
  skin: ImageData;
  kit: ImageData;
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
  return { container, skin, kit };
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
 * How much of each gait to show at `speed` (m/s), and how many stride cycles a second: the two gaits around that
 * speed are blended, and a running gait cycles as fast as its stride covers that ground, so the feet don't slide
 * (idle breathes at its own pace). `gaits` are in order of speed, from standing.
 */
export function blendGaits(
  gaits: readonly { speed: number; seconds: number }[],
  speed: number,
): { weights: number[]; rate: number } {
  const weights = gaits.map(() => 0);
  let k = 0;
  while (k < gaits.length - 2 && speed > gaits[k + 1].speed) k++;
  const t = Math.min(1, Math.max(0, (speed - gaits[k].speed) / (gaits[k + 1].speed - gaits[k].speed)));
  weights[k] = 1 - t;
  weights[k + 1] = t;
  let rate = 0;
  gaits.forEach((g, i) => {
    if (weights[i] > 0) rate += weights[i] * (g.speed > 0 ? speed / (g.speed * g.seconds) : 1 / g.seconds);
  });
  return { weights, rate };
}

/** One player: a copy of the model in a team's kit, running with the animations blended by speed. */
export class Character {
  /** Move and turn this; the model sits under it. */
  readonly root: TransformNode;
  readonly meshes: AbstractMesh[];
  private readonly gaits: { group: AnimationGroup; speed: number; frames: number; seconds: number }[];
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
    const all = copy.rootNodes.flatMap((n) => n.getChildMeshes(false));
    // One hairstyle: the others go.
    for (const mesh of all) {
      const style = HAIRSTYLES.find((h) => mesh.name.includes(h));
      if (style && style !== look.hairstyle) mesh.dispose();
    }
    this.meshes = all.filter((m) => !m.isDisposed());
    for (const mesh of this.meshes) {
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
    this.gaits = GAITS.map((g) => {
      const group = copy.animationGroups.find((a) => a.name.endsWith(g.name));
      if (!group) throw new Error(`Character animation ${g.name} is missing`);
      // Every gait plays at once, frozen in place: `place` picks the frame and the weights each tick.
      group.start(true, 0, group.from, group.to);
      const fps = group.targetedAnimations[0]?.animation.framePerSecond ?? 60;
      return { group, speed: g.speed, frames: group.to - group.from, seconds: (group.to - group.from) / fps };
    });
  }

  /**
   * Put the player at `pos`, facing `heading` (on the ground), moving at `speed` m/s, with the gaits blended for
   * that speed (`blendGaits`); `dt` advances the stride (0 holds the pose).
   */
  place(pos: Vector3, heading: Vector3, speed: number, dt: number): void {
    this.root.position.copyFrom(pos);
    this.root.rotation.y = Math.atan2(-heading.z, heading.x) + FACING;
    const { weights, rate } = blendGaits(this.gaits, speed);
    this.phase = (this.phase + rate * dt) % 1;
    this.gaits.forEach((gait, i) => {
      gait.group.weight = weights[i];
      gait.group.goToFrame(gait.group.from + this.phase * gait.frames);
    });
  }

  dispose(): void {
    for (const gait of this.gaits) gait.group.dispose();
    this.root.dispose(false, true);
  }
}

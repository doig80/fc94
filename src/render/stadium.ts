import {
  Color3,
  DynamicTexture,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";
import { Rng } from "../sim/rng";
import type { SurfaceLibrary } from "./materials";
import type { PitchSpec } from "../sim/params";
import { pitchMargin } from "./pitch";
import type { Quality } from "./types";

export interface Stadium {
  shadowCasters: Mesh[];
  receivers: Mesh[];
  /** Floodlight lamp positions, used to place spotlights. */
  lamps: Vector3[];
  /** Ad boards and lamp panels: glow at night. */
  setLampPower(power: number): void;
  /** Fade out roofs on the camera's side of the pitch, so they never block the view of play. */
  fadeOccluders(camera: Vector3, target: Vector3, dt: number): void;
}

const TIER_H = 0.75;
const TIER_D = 1.15;

export function buildStadium(scene: Scene, lib: SurfaceLibrary, quality: Quality, pitch: PitchSpec): Stadium {
  // A small-sided pitch gets a compact arena: fewer tiers and shorter floodlight towers.
  const big = pitch.length >= 90;
  const TIERS = big ? 9 : 6;
  const towerHeight = big ? 40 : 24;
  lib.define("concrete", {
    color: Color3.FromHexString("#b9b4aa"),
    roughness: 0.85,
    outline: true,
    wettable: 0.7,
  });
  lib.define("roof", {
    color: Color3.FromHexString("#e9ecef"),
    roughness: 0.4,
    metallic: 0.3,
    outline: true,
    wettable: 0.5,
  });
  lib.define("steel", {
    color: Color3.FromHexString("#5b6470"),
    roughness: 0.45,
    metallic: 0.6,
    outline: true,
    wettable: 0.5,
  });
  lib.define("seat", { color: Color3.FromHexString("#2f5d9e"), roughness: 0.6, wettable: 0.8 });

  const margin = pitchMargin(pitch);
  const halfL = pitch.length / 2 + margin + 1.5;
  const halfW = pitch.width / 2 + margin + 1.5;
  const casters: Mesh[] = [];
  const receivers: Mesh[] = [];
  const roofs: Mesh[] = [];
  const crowdMatrices: number[] = [];
  const crowdColors: number[] = [];
  const rng = new Rng(1994);
  const shirtPalette = [
    "#d7263d",
    "#f5f5f0",
    "#d7263d",
    "#1b4fd8",
    "#ffd23f",
    "#f5f5f0",
    "#2b2d42",
    "#d7263d",
  ].map((h) => Color3.FromHexString(h));
  const density = quality === "high" ? 1 : 0.45;

  // Four stands; each is built along +x and rotated into place.
  const sides = [
    { length: halfL * 2, offset: halfW, rot: 0 },
    { length: halfL * 2, offset: halfW, rot: Math.PI },
    { length: halfW * 2, offset: halfL, rot: Math.PI / 2 },
    { length: halfW * 2, offset: halfL, rot: -Math.PI / 2 },
  ];
  for (const side of sides) {
    const parts: Mesh[] = [];
    for (let t = 0; t < TIERS; t++) {
      const tier = MeshBuilder.CreateBox(
        "tier",
        { width: side.length, height: TIER_H * (t + 1), depth: TIER_D },
        scene,
      );
      tier.position.set(0, (TIER_H * (t + 1)) / 2, side.offset + TIER_D * (t + 0.5));
      parts.push(tier);
    }
    const back = MeshBuilder.CreateBox(
      "backWall",
      { width: side.length + 2, height: TIER_H * TIERS + 6, depth: 0.6 },
      scene,
    );
    back.position.set(0, (TIER_H * TIERS + 6) / 2, side.offset + TIER_D * TIERS + 0.3);
    parts.push(back);
    const stand = Mesh.MergeMeshes(parts, true, true)!;
    stand.name = "stand";
    stand.rotation.y = side.rot;
    lib.assign(stand, "concrete");
    stand.receiveShadows = true;
    receivers.push(stand);
    casters.push(stand);

    const roof = MeshBuilder.CreateBox(
      "roof",
      { width: side.length + 2, height: 0.3, depth: TIER_D * TIERS + 4 },
      scene,
    );
    roof.position.set(0, TIER_H * TIERS + 6.2, side.offset + (TIER_D * TIERS) / 2 - 1);
    roof.rotation.x = -0.08;
    const pivot = new Mesh("roofPivot", scene);
    pivot.rotation.y = side.rot;
    roof.parent = pivot;
    lib.assign(roof, "roof");
    casters.push(roof);
    roofs.push(roof);

    // Crowd on every tier, as thin instances (one draw call per stand).
    const rot = Quaternion.RotationAxis(Vector3.Up(), side.rot + Math.PI);
    const sideRot = Matrix.RotationY(side.rot);
    const spacing = 0.75 / density;
    for (let t = 0; t < TIERS; t++) {
      for (let x = -side.length / 2 + 1; x < side.length / 2 - 1; x += spacing) {
        if (rng.next() < 0.12) continue; // empty seats
        const local = new Vector3(
          x + rng.range(-0.1, 0.1),
          TIER_H * (t + 1),
          side.offset + TIER_D * (t + 0.5),
        );
        const world = Vector3.TransformCoordinates(local, sideRot);
        const height = rng.range(0.9, 1.1);
        const m = Matrix.Compose(new Vector3(1, height, 1), rot, world);
        crowdMatrices.push(...m.asArray());
        const c =
          rng.next() < 0.6
            ? rng.pick(shirtPalette)
            : Color3.FromHSV(rng.range(0, 360), 0.5, rng.range(0.3, 0.9));
        crowdColors.push(c.r, c.g, c.b, 1);
      }
    }
  }

  // One low-poly spectator mesh, instanced thousands of times.
  const body = MeshBuilder.CreateBox("spectatorBody", { width: 0.42, height: 0.62, depth: 0.3 }, scene);
  body.position.y = 0.31;
  const head = MeshBuilder.CreateIcoSphere("spectatorHead", { radius: 0.13, subdivisions: 1 }, scene);
  head.position.y = 0.76;
  const spectator = Mesh.MergeMeshes([body, head], true)!;
  spectator.name = "crowd";
  const crowdMat = new StandardMaterial("crowd", scene);
  crowdMat.specularColor = Color3.Black();
  crowdMat.maxSimultaneousLights = 8;
  spectator.material = crowdMat;
  spectator.thinInstanceSetBuffer("matrix", new Float32Array(crowdMatrices), 16, true);
  spectator.thinInstanceRegisterAttribute("color", 4);
  spectator.thinInstanceSetBuffer("color", new Float32Array(crowdColors), 4, true);
  spectator.receiveShadows = true;

  // Pitch-side advertising boards (fictional brands only — see docs/specs/03).
  lib.define("adboard", {
    color: new Color3(0.1, 0.1, 0.1),
    roughness: 0.3,
    texture: adTexture(scene),
    emissive: new Color3(0.4, 0.4, 0.4),
  });
  const boardOffset = { x: pitch.length / 2 + margin * 0.6, z: pitch.width / 2 + margin * 0.45 };
  const boards: Mesh[] = [];
  for (const s of [-1, 1]) {
    const longBoard = MeshBuilder.CreateBox(
      "adboard",
      { width: pitch.length, height: 0.9, depth: 0.15 },
      scene,
    );
    longBoard.position.set(0, 0.45, s * boardOffset.z);
    if (s < 0) longBoard.rotation.y = Math.PI;
    const endBoard = MeshBuilder.CreateBox(
      "adboard",
      { width: pitch.width * 0.7, height: 0.9, depth: 0.15 },
      scene,
    );
    endBoard.position.set(s * boardOffset.x, 0.45, 0);
    endBoard.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    boards.push(longBoard, endBoard);
  }
  for (const b of boards) {
    lib.assign(b, "adboard");
    casters.push(b);
  }

  // Floodlight towers in the corners.
  lib.define("lamp", { color: new Color3(1, 1, 1), roughness: 0.2, emissive: new Color3(1, 0.97, 0.9) });
  const lamps: Vector3[] = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const base = new Vector3(sx * (halfL + (big ? 9 : 5)), 0, sz * (halfW + (big ? 9 : 5)));
      const tower = MeshBuilder.CreateCylinder(
        "tower",
        { height: towerHeight, diameterTop: 0.7, diameterBottom: 1.6, tessellation: 6 },
        scene,
      );
      tower.position.set(base.x, towerHeight / 2, base.z);
      lib.assign(tower, "steel");
      casters.push(tower);
      const panel = MeshBuilder.CreateBox("lampPanel", { width: 7, height: 3.5, depth: 0.5 }, scene);
      panel.position.set(base.x, towerHeight + 1, base.z);
      panel.lookAt(new Vector3(0, 0, 0));
      lib.assign(panel, "lamp");
      lamps.push(new Vector3(base.x * 0.97, towerHeight, base.z * 0.97));
    }
  }

  // Roof centres on the ground plane, for deciding which roofs sit between the camera and the pitch.
  const roofCentres = roofs.map((r) => {
    r.computeWorldMatrix(true);
    const c = r.getBoundingInfo().boundingBox.centerWorld;
    return new Vector3(c.x, 0, c.z);
  });

  return {
    shadowCasters: casters,
    fadeOccluders(camera: Vector3, target: Vector3, dt: number) {
      const cx = camera.x - target.x;
      const cz = camera.z - target.z;
      const cl = Math.hypot(cx, cz) || 1;
      const k = 1 - Math.exp(-dt * 6);
      roofs.forEach((roof, i) => {
        const rx = roofCentres[i].x - target.x;
        const rz = roofCentres[i].z - target.z;
        const rl = Math.hypot(rx, rz) || 1;
        // On the camera's side (the camera looks over it) → nearly invisible; elsewhere → solid.
        const cameraSide = (rx * cx + rz * cz) / (rl * cl) > 0.35;
        const goal = cameraSide ? 0.08 : 1;
        roof.visibility += (goal - roof.visibility) * k;
      });
    },
    receivers,
    lamps,
    setLampPower(power: number) {
      lib.setEmissive("lamp", new Color3(1, 0.97, 0.9).scale(0.25 + 1.75 * power));
      lib.setEmissive("adboard", new Color3(1, 1, 1).scale(0.45 + 0.55 * power));
    },
  };
}

const adTextures = new WeakMap<Scene, DynamicTexture>();

function adTexture(scene: Scene): DynamicTexture {
  const cached = adTextures.get(scene);
  if (cached) return cached;
  const w = 2048;
  const h = 64;
  const tex = new DynamicTexture("adTex", { width: w, height: h }, scene, true);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const ads = [
    { bg: "#d7263d", fg: "#ffffff", text: "NUTMEG" },
    { bg: "#ffd23f", fg: "#14213d", text: "ARCADE COLA" },
    { bg: "#14213d", fg: "#ffffff", text: "PLAY FAIR" },
    { bg: "#2bb24c", fg: "#ffffff", text: "PIXEL BOOTS" },
    { bg: "#1b4fd8", fg: "#ffd23f", text: "COUCH CUP" },
  ];
  const segment = w / 10;
  for (let i = 0; i < 10; i++) {
    const ad = ads[i % ads.length];
    ctx.fillStyle = ad.bg;
    ctx.fillRect(i * segment, 0, segment, h);
    ctx.fillStyle = ad.fg;
    // Shrink long slogans so they fit their panel.
    let size = 40;
    do {
      ctx.font = `bold ${size}px sans-serif`;
    } while (ctx.measureText(ad.text).width > segment * 0.88 && --size > 12);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ad.text, i * segment + segment / 2, h / 2 + 2);
  }
  tex.update();
  adTextures.set(scene, tex);
  return tex;
}

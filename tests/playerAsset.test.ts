import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GAITS, HAIRSTYLES, MOVES } from "../src/render/character";

/** public/assets/characters/player.glb's JSON part (scripts/assets/prepare_player.py, then player_lods.ts). */
function playerGltf() {
  const glb = readFileSync("public/assets/characters/player.glb");
  const length = glb.readUInt32LE(12);
  return JSON.parse(glb.subarray(20, 20 + length).toString("utf8")) as {
    nodes: { name: string; mesh?: number }[];
    meshes: { primitives: { indices: number }[] }[];
    accessors: { count: number }[];
    animations: { name: string }[];
  };
}

describe("the new player's model file (issue #27)", () => {
  const gltf = playerGltf();
  const triangles = (node: string) => {
    const n = gltf.nodes.find((x) => x.name === node);
    if (n?.mesh === undefined) return null;
    return gltf.meshes[n.mesh].primitives.reduce((sum, p) => sum + gltf.accessors[p.indices].count / 3, 0);
  };

  it("has every gait and every move the game plays", () => {
    const names = gltf.animations.map((a) => a.name);
    for (const name of [...GAITS.map((g) => g.name), ...MOVES]) expect(names).toContain(name);
  });

  it("stays within the triangle budget close up (spec 01 §4: 3,000 a player), whichever hairstyle", () => {
    for (const hair of HAIRSTYLES) {
      const total = ["SuperHero_Male", "Eyes", "Eyebrows", hair].reduce(
        (sum, n) => sum + (triangles(n) ?? 0),
        0,
      );
      expect(total).toBeGreaterThan(1500);
      expect(total).toBeLessThanOrEqual(3000);
    }
  });

  it("has lighter far versions of the body and hair, and none of the eyes and eyebrows", () => {
    for (const name of ["SuperHero_Male", ...HAIRSTYLES]) {
      expect(triangles(`${name}_LOD1`)).toBeGreaterThan(0);
      expect(triangles(`${name}_LOD1`)).toBeLessThan(triangles(name)! / 2);
    }
    expect(triangles("Eyes_LOD1")).toBeNull();
    expect(triangles("Eyebrows_LOD1")).toBeNull();
  });
});

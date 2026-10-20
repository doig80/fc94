import { Color3, NullEngine, Scene } from "@babylonjs/core";
import { describe, expect, it } from "vitest";
import { SurfaceLibrary } from "../src/render/materials";
import { KITS, PARTS } from "../src/render/players";
import { Squad } from "../src/render/squad";

function squadOf(count: number): Squad {
  const scene = new Scene(new NullEngine());
  const members = Array.from({ length: count }, (_, i) => ({
    kit: i % 2 === 0 ? KITS.home : KITS.away,
    skin: Color3.FromHexString("#c68642"),
    hair: Color3.FromHexString("#2b1d14"),
  }));
  return new Squad(scene, new SurfaceLibrary(scene), members);
}

describe("squad (docs/specs/01 §4 draw calls)", () => {
  it("draws any number of players with one mesh per kind of body part", () => {
    for (const count of [10, 22]) {
      const squad = squadOf(count);
      expect(squad.meshes).toHaveLength(PARTS.length);
      for (const [k, part] of PARTS.entries()) {
        const perPlayer = part.joint === "body" ? 1 : 2;
        expect(squad.meshes[k].thinInstanceCount).toBe(count * perPlayer);
      }
    }
  });

  it("puts each player's parts where its rig is", () => {
    const squad = squadOf(2);
    squad.rigs[1].root.position.set(12, 0, -5);
    squad.update();
    const torso = squad.meshes[PARTS.findIndex((p) => p.name === "torso")];
    const m = torso.thinInstanceGetWorldMatrices()[1];
    expect(m.getTranslation().x).toBeCloseTo(12);
    expect(m.getTranslation().z).toBeCloseTo(-5);
    expect(m.getTranslation().y).toBeCloseTo(1.28);
  });
});

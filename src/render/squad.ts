import { Color3, Mesh, Scene, TransformNode } from "@babylonjs/core";
import type { SurfaceLibrary } from "./materials";
import { BOOTS, PART_SURFACE, PARTS, PlayerRig, type Kit, type PartColour } from "./players";

export interface SquadMember {
  kit: Kit;
  skin: Color3;
  hair: Color3;
}

/**
 * Every player on the pitch, drawn together (docs/specs/01 §4 draw-call budget). Each kind of body part is one
 * mesh with a thin instance per player, coloured per instance, so the cost doesn't grow with the number of
 * players. Pose the rigs, then call `update()` once a frame to copy the poses into the instances.
 */
export class Squad {
  readonly rigs: PlayerRig[];
  readonly meshes: Mesh[] = [];
  /** Per part kind: the node each instance follows, and its matrix buffer. */
  private readonly parts: { mesh: Mesh; anchors: TransformNode[]; matrices: Float32Array }[] = [];

  constructor(scene: Scene, lib: SurfaceLibrary, members: SquadMember[]) {
    this.rigs = members.map((_, i) => new PlayerRig(scene, `player${i}`));
    for (const colour of Object.keys(PART_SURFACE) as PartColour[]) {
      // White, so the per-instance colour comes through unchanged.
      lib.define(`squad:${colour}`, { color: Color3.White(), ...PART_SURFACE[colour] });
    }
    for (const part of PARTS) {
      const mesh = part.build(scene);
      mesh.name = `squad:${part.name}`;
      mesh.convertToFlatShadedMesh();
      lib.assign(mesh, `squad:${part.colour}`);
      const anchors: TransformNode[] = [];
      const colours: number[] = [];
      members.forEach((m, i) => {
        const c = colourOf(m, part.colour);
        for (const joint of this.rigs[i].joints(part)) {
          const anchor = new TransformNode(`${part.name}${i}`, scene);
          anchor.parent = joint;
          anchor.position.copyFrom(part.position);
          if (part.scaling) anchor.scaling.copyFrom(part.scaling);
          anchors.push(anchor);
          colours.push(c.r, c.g, c.b, 1);
        }
      });
      const matrices = new Float32Array(anchors.length * 16);
      mesh.thinInstanceSetBuffer("matrix", matrices, 16, false);
      mesh.thinInstanceRegisterAttribute("color", 4);
      mesh.thinInstanceSetBuffer("color", new Float32Array(colours), 4, true);
      mesh.isPickable = false;
      this.parts.push({ mesh, anchors, matrices });
      this.meshes.push(mesh);
    }
    this.update();
  }

  /** Copy the rigs' current poses into the instances. */
  update(): void {
    for (const rig of this.rigs) rig.computeWorldMatrices();
    for (const { mesh, anchors, matrices } of this.parts) {
      anchors.forEach((a, j) => {
        a.computeWorldMatrix(true);
        a.getWorldMatrix().copyToArray(matrices, j * 16);
      });
      mesh.thinInstanceBufferUpdated("matrix");
      mesh.thinInstanceRefreshBoundingInfo(false);
    }
  }
}

function colourOf(m: SquadMember, colour: PartColour): Color3 {
  switch (colour) {
    case "shirt":
      return m.kit.shirt;
    case "shorts":
      return m.kit.shorts;
    case "socks":
      return m.kit.socks;
    case "skin":
      return m.skin;
    case "hair":
      return m.hair;
    case "boots":
      return BOOTS;
  }
}

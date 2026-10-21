/**
 * Makes the new player light enough for 22 players and 3 officials on every device (spec 01 §4: a player is at most
 * 3,000 triangles, with a second, lighter level of detail): each mesh in player.glb is simplified in place (LOD0, used
 * close up), and a lighter copy is added beside it as `<name>_LOD1` for players far from the camera. The eyes and
 * eyebrows have no far copy: from there they are a pixel or two, so they aren't drawn at all.
 *
 * meshoptimizer keeps the texture seams and the skinning (it only removes vertices, so each remaining vertex keeps
 * its UVs and bone weights); unused vertices are dropped afterwards.
 *
 * Usage: node scripts/assets/player_lods.ts [public/assets/characters/player.glb]
 * Run after scripts/assets/prepare_player.py (which writes the full-detail model).
 */
import { NodeIO, type Accessor } from "@gltf-transform/core";
import { MeshoptSimplifier } from "meshoptimizer";

/** Triangles per mesh: [close up (LOD0), far away (LOD1, or null for none)]. One hairstyle shows per player. */
const TARGETS: Record<string, [number, number | null]> = {
  SuperHero_Male: [2200, 700],
  Hair_SimpleParted: [300, 100],
  Hair_Buzzed: [240, 80],
  Eyebrows: [120, null],
  Eyes: [160, null],
};

/** How much the simplifier minds changing each attribute, after position: normal (×3), then UV (×2). */
const ATTRIBUTE_WEIGHTS = [0.5, 0.5, 0.5, 1, 1];
/** The largest change allowed, relative to the mesh's size: big enough that the triangle targets decide. */
const MAX_ERROR = 0.2;

const path = process.argv[2] ?? "public/assets/characters/player.glb";
await MeshoptSimplifier.ready;
const io = new NodeIO();
const doc = await io.read(path);

function simplify(
  indices: Uint32Array,
  positions: Float32Array,
  attributes: Float32Array,
  triangles: number,
) {
  const [result, error] = MeshoptSimplifier.simplifyWithAttributes(
    indices,
    positions,
    3,
    attributes,
    ATTRIBUTE_WEIGHTS.length,
    ATTRIBUTE_WEIGHTS,
    null,
    triangles * 3,
    MAX_ERROR,
  );
  return { indices: result, error };
}

let total = 0;
for (const node of doc.getRoot().listNodes()) {
  const target = TARGETS[node.getName()];
  const mesh = node.getMesh();
  if (!target || !mesh) continue;
  const prim = mesh.listPrimitives()[0];
  const array = (semantic: string) => prim.getAttribute(semantic)!.getArray() as Float32Array;
  const positions = array("POSITION");
  const normals = array("NORMAL");
  const uvs = array("TEXCOORD_0");
  const count = positions.length / 3;
  const attributes = new Float32Array(count * 5);
  for (let v = 0; v < count; v++) {
    attributes.set(normals.subarray(v * 3, v * 3 + 3), v * 5);
    attributes.set(uvs.subarray(v * 2, v * 2 + 2), v * 5 + 3);
  }
  const indices = prim.getIndices()!;
  const before = indices.getCount() / 3;
  const lod0 = simplify(Uint32Array.from(indices.getArray()!), positions, attributes, target[0]);
  const lod1 = target[1] ? simplify(lod0.indices, positions, attributes, target[1]) : null;

  // Keep only the vertices LOD0 uses (LOD1's are among them), renumbered in order of first use.
  const remap = new Int32Array(count).fill(-1);
  let kept = 0;
  for (const v of lod0.indices) if (remap[v] < 0) remap[v] = kept++;
  for (const semantic of prim.listSemantics()) {
    const accessor = prim.getAttribute(semantic) as Accessor;
    const size = accessor.getElementSize();
    const from = accessor.getArray()!;
    const to = new (from.constructor as new (length: number) => typeof from)(kept * size);
    for (let v = 0; v < count; v++)
      if (remap[v] >= 0) to.set(from.subarray(v * size, v * size + size), remap[v] * size);
    accessor.setArray(to);
  }
  const renumber = (list: Uint32Array) => Uint16Array.from(list, (v) => remap[v]);
  indices.setArray(renumber(lod0.indices));

  let far = "none";
  if (lod1) {
    const lodPrim = doc.createPrimitive().setMaterial(prim.getMaterial());
    for (const semantic of prim.listSemantics()) lodPrim.setAttribute(semantic, prim.getAttribute(semantic));
    lodPrim.setIndices(doc.createAccessor().setType("SCALAR").setArray(renumber(lod1.indices)));
    const lodMesh = doc.createMesh(`${mesh.getName()}_LOD1`).addPrimitive(lodPrim);
    const lodNode = doc.createNode(`${node.getName()}_LOD1`).setMesh(lodMesh).setSkin(node.getSkin());
    node.getParentNode()?.addChild(lodNode);
    far = `${lod1.indices.length / 3} (error ${lod1.error.toFixed(3)})`;
  }
  total += lod0.indices.length / 3;
  console.log(
    `${node.getName()}: ${before} → ${lod0.indices.length / 3} triangles (error ${lod0.error.toFixed(3)}), ` +
      `${count} → ${kept} vertices; far: ${far}`,
  );
}
await io.write(path, doc);
console.log(`Close-up total (both hairstyles): ${total} triangles. Written ${path}`);

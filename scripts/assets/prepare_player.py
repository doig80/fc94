#!/usr/bin/env python3
"""
Builds the character-test player (issue #27) from two free Quaternius packs (CC0, https://quaternius.com):

- "Universal Base Characters [Standard]": the male base character (mesh, skeleton, textures);
- "Universal Animation Library [Standard]": idle, walk, jog and sprint, made for the same 65-bone skeleton, plus a
  dive roll (the keeper's dive, then rolling over and getting up) and a jump (headers);
- "Universal Animation Library 2 [Standard]": the slide (a slide tackle) and getting up from it.

Writes, into public/assets/characters/:
- player.glb: the character with only what the game uses (smaller textures, no spare UV or colour sets), two
  hairstyles (the game shows one), and the animations, rotations only plus the pelvis height, so they fit his
  proportions;
- player-skin.jpg: the body's colour texture, kept out of player.glb: the game paints each team's kit onto it;
- player-kit.png: where the kit goes, in the texture's layout: 0 skin, 1 shirt, 2 shorts, 3 socks, 4 boots
  (times 50, as grey levels), worked out from which bone moves each part of the body.

Usage: python3 scripts/assets/prepare_player.py <base-characters.zip> <animation-library.zip>
       <animation-library-2.zip> [out_dir]
The packs are downloaded from quaternius.itch.io (name your own price, $0 is fine); they are not kept in the repo.
Then `node scripts/assets/player_lods.ts` makes the lighter versions of the meshes (spec 01 §4).
"""
import io
import json
import os
import struct
import sys
import zipfile

import numpy as np
from PIL import Image

CHARACTER = "Universal Base Characters[Standard]/Base Characters/Godot - UE/Superhero_Male_FullBody.gltf"
# Hairstyles (separate in the pack), skinned to the head bone; the game shows one per player.
HAIR_FOLDER = "Universal Base Characters[Standard]/Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)/"
HAIRSTYLES = ["Hair_SimpleParted", "Hair_Buzzed"]
# The animations taken from each library: the gaits (blended by speed), then the moves.
LIBRARIES = [
    (
        "Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb",
        ["Idle_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "Roll", "Jump_Start"],
    ),
    (
        "Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb",
        ["Slide_Start", "Slide_Exit"],
    ),
]
ATTRIBUTES = ["POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0"]
# Texture sizes (longest side) and formats; None drops the texture.
# The body's colour texture goes in its own file (see SKIN_TEXTURE).
SKIN_TEXTURE = "T_Superhero_Male_Dark.png"
TEXTURES = {
    SKIN_TEXTURE: None,
    "T_Superhero_Male_Normal.png": (512, "JPEG"),
    "T_Superhero_Male_Roughness.png": None,
    "T_Hair_1_BaseColor.png": (512, "JPEG"),
    "T_Hair_1_Normal_png.png": None,
    "T_Eye_Brown.png": (128, "PNG"),
    "T_Eye_Normal_png.png": None,
}
KIT_SIZE = 1024
SKIN, SHIRT, SHORTS, SOCKS, BOOTS = range(5)

COMPONENT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(data):
    json_len, _ = struct.unpack_from("<II", data, 12)
    doc = json.loads(data[20 : 20 + json_len])
    off = 20 + json_len
    bin_len, _ = struct.unpack_from("<II", data, off)
    return doc, data[off + 8 : off + 8 + bin_len]


class Source:
    """A glTF document and its binary buffer, read-only."""

    def __init__(self, doc, buffer):
        self.doc = doc
        self.buffer = buffer

    def raw(self, index):
        """An accessor's elements as tightly packed bytes."""
        a = self.doc["accessors"][index]
        view = self.doc["bufferViews"][a["bufferView"]]
        size = struct.calcsize("<" + COMPONENT[a["componentType"]]) * WIDTH[a["type"]]
        start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
        stride = view.get("byteStride", size)
        if stride == size:
            return self.buffer[start : start + size * a["count"]]
        return b"".join(self.buffer[start + k * stride : start + k * stride + size] for k in range(a["count"]))

    def array(self, index):
        a = self.doc["accessors"][index]
        dtype = np.dtype("<" + COMPONENT[a["componentType"]])
        return np.frombuffer(self.raw(index), dtype=dtype).reshape(a["count"], WIDTH[a["type"]])


class Output:
    """The glTF being written: every accessor gets its own tightly packed buffer view."""

    def __init__(self):
        self.buffer = bytearray()
        self.views = []
        self.accessors = []

    def view(self, data, target=None):
        while len(self.buffer) % 4:
            self.buffer.append(0)
        v = {"buffer": 0, "byteOffset": len(self.buffer), "byteLength": len(data)}
        if target:
            v["target"] = target
        self.buffer.extend(data)
        self.views.append(v)
        return len(self.views) - 1

    def accessor(self, src, index, target=None, data=None):
        a = {k: v for k, v in src.doc["accessors"][index].items() if k not in ("bufferView", "byteOffset", "sparse")}
        raw = src.raw(index) if data is None else data
        a["bufferView"] = self.view(raw, target)
        self.accessors.append(a)
        return len(self.accessors) - 1


def load_gltf(archive, path):
    doc = json.loads(archive.read(path))
    folder = os.path.dirname(path)
    return Source(doc, archive.read(folder + "/" + doc["buffers"][0]["uri"]))


def add_hairstyle(out, gltf, char, hair, name, material):
    """
    One hairstyle as another mesh on the character's skeleton. The pack skins hair to the head in a slightly
    different rest pose, so its vertices are moved into the body's: from the hair's head space into the body's.
    """
    prim = hair.doc["meshes"][0]["primitives"][0]
    joint_names = [hair.doc["nodes"][j]["name"] for j in hair.doc["skins"][0]["joints"]]
    body_names = [char.doc["nodes"][j]["name"] for j in char.doc["skins"][0]["joints"]]
    assert joint_names == body_names, "the hair's skeleton must match the body's"
    hair_ibm = hair.array(hair.doc["skins"][0]["inverseBindMatrices"]).astype(np.float64).reshape(-1, 4, 4)
    body_ibm = char.array(char.doc["skins"][0]["inverseBindMatrices"]).astype(np.float64).reshape(-1, 4, 4)
    joints = hair.array(prim["attributes"]["JOINTS_0"])
    weights = hair.array(prim["attributes"]["WEIGHTS_0"]).astype(np.float64)
    pos = hair.array(prim["attributes"]["POSITION"]).astype(np.float64)
    nrm = hair.array(prim["attributes"]["NORMAL"]).astype(np.float64)
    for i in range(len(pos)):
        j = int(joints[i][int(np.argmax(weights[i]))])
        # Column-major in the file: transpose to get the matrices; body bind space <- joint space <- hair bind space.
        m = np.linalg.inv(body_ibm[j].T) @ hair_ibm[j].T
        pos[i] = (m @ np.append(pos[i], 1.0))[:3]
        n = m[:3, :3] @ nrm[i]
        nrm[i] = n / (np.linalg.norm(n) or 1.0)
    attrs = {}
    for attr in ATTRIBUTES:
        if attr == "POSITION":
            data = pos.astype("<f4")
            index = out.accessor(hair, prim["attributes"][attr], 34962, data.tobytes())
            out.accessors[index]["min"] = data.min(axis=0).tolist()
            out.accessors[index]["max"] = data.max(axis=0).tolist()
        elif attr == "NORMAL":
            index = out.accessor(hair, prim["attributes"][attr], 34962, nrm.astype("<f4").tobytes())
        else:
            index = out.accessor(hair, prim["attributes"][attr], 34962)
        attrs[attr] = index
    gltf["meshes"].append(
        {
            "name": name,
            "primitives": [
                {"attributes": attrs, "indices": out.accessor(hair, prim["indices"], 34963), "material": material}
            ],
        }
    )
    gltf["nodes"].append({"name": name, "mesh": len(gltf["meshes"]) - 1, "skin": 0})
    return len(gltf["nodes"]) - 1


def image_bytes(img, size, fmt):
    img = img.convert("RGB" if fmt == "JPEG" else "RGBA")
    scale = size / max(img.size)
    if scale < 1:
        img = img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)
    out = io.BytesIO()
    img.save(out, fmt, **({"quality": 88} if fmt == "JPEG" else {"optimize": True}))
    return out.getvalue()


def kit_regions(src, mesh, joint_names):
    """The kit region of each vertex of the body, from the bone that moves it most and how far along that bone."""
    prim = src.doc["meshes"][mesh]["primitives"][0]
    pos = src.array(prim["attributes"]["POSITION"]).astype(np.float64)
    joints = src.array(prim["attributes"]["JOINTS_0"])
    weights = src.array(prim["attributes"]["WEIGHTS_0"]).astype(np.float64)
    if src.doc["accessors"][prim["attributes"]["WEIGHTS_0"]]["componentType"] != 5126:
        weights /= 255.0
    ibm = src.array(src.doc["skins"][0]["inverseBindMatrices"]).astype(np.float64).reshape(-1, 4, 4)
    # glTF matrices are column-major; a joint's bind position is the translation of the inverse of its inverse bind.
    where = {n: np.linalg.inv(ibm[k].T)[:3, 3] for k, n in enumerate(joint_names)}

    def along(v, a, b):
        d = where[b] - where[a]
        return float(np.dot(v - where[a], d) / np.dot(d, d))

    regions = np.zeros(len(pos), dtype=np.uint8)
    for i, v in enumerate(pos):
        bone = joint_names[int(joints[i][int(np.argmax(weights[i]))])]
        side = bone[-2:] if bone.endswith(("_l", "_r")) else ""
        if bone.startswith(("spine", "clavicle")):
            regions[i] = SHIRT
        elif bone.startswith("upperarm"):
            # Short sleeves: the upper half of the upper arm.
            regions[i] = SHIRT if along(v, "upperarm" + side, "lowerarm" + side) < 0.5 else SKIN
        elif bone == "pelvis":
            regions[i] = SHORTS
        elif bone.startswith("thigh"):
            regions[i] = SHORTS if along(v, "thigh" + side, "calf" + side) < 0.6 else SKIN
        elif bone.startswith("calf"):
            # Socks from just under the knee.
            regions[i] = SOCKS if along(v, "calf" + side, "foot" + side) > 0.2 else SKIN
        elif bone.startswith(("foot", "ball")):
            regions[i] = BOOTS
    return prim, regions


def kit_map(src, prim, regions):
    """
    Paints the regions in the texture's layout. Each triangle blends its corners' regions smoothly and every pixel
    takes the strongest, so a kit edge runs straight through the triangles instead of zigzagging along them; the map
    is then padded a few pixels past the edges of each piece so the skin can't bleed in at the seams.
    """
    uv = src.array(prim["attributes"]["TEXCOORD_0"]).astype(np.float64) * KIT_SIZE
    tris = src.array(prim["indices"]).reshape(-1, 3)
    onehot = np.eye(5)[regions]
    strength = np.zeros((KIT_SIZE, KIT_SIZE, 5))
    covered = np.zeros((KIT_SIZE, KIT_SIZE), dtype=bool)
    for tri in tris:
        a, b, c = uv[tri]
        x0, y0 = np.floor(np.minimum(np.minimum(a, b), c)).astype(int)
        x1, y1 = np.ceil(np.maximum(np.maximum(a, b), c)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, KIT_SIZE - 1), min(y1, KIT_SIZE - 1)
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        den = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(den) < 1e-12:
            continue
        w0 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / den
        w1 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / den
        w2 = 1 - w0 - w1
        inside = (w0 >= -0.02) & (w1 >= -0.02) & (w2 >= -0.02)
        if not inside.any():
            continue
        mix = w0[..., None] * onehot[tri[0]] + w1[..., None] * onehot[tri[1]] + w2[..., None] * onehot[tri[2]]
        rows, cols = np.nonzero(inside)
        strength[rows + y0, cols + x0] = mix[rows, cols]
        covered[rows + y0, cols + x0] = True
    label = strength.argmax(axis=2).astype(np.uint8)
    # Pad: uncovered pixels take the region of a covered neighbour, a few pixels out.
    for _ in range(4):
        grown = label.copy()
        have = covered.copy()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            shifted = np.roll(np.roll(label, dy, axis=0), dx, axis=1)
            from_covered = np.roll(np.roll(covered, dy, axis=0), dx, axis=1)
            take = ~have & from_covered
            grown[take] = shifted[take]
            have |= take
        label, covered = grown, have
    img = Image.fromarray(label * 50, mode="L")
    out = io.BytesIO()
    img.save(out, "PNG", optimize=True)
    return out.getvalue()


def main():
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    out_dir = sys.argv[4] if len(sys.argv) > 4 else os.path.join("public", "assets", "characters")
    base = zipfile.ZipFile(sys.argv[1])
    folder = os.path.dirname(CHARACTER)
    doc = json.loads(base.read(CHARACTER))
    char = Source(doc, base.read(folder + "/" + doc["buffers"][0]["uri"]))
    libs = [
        (Source(*read_glb(zipfile.ZipFile(archive).read(path))), wanted)
        for archive, (path, wanted) in zip(sys.argv[2:4], LIBRARIES)
    ]

    out = Output()
    gltf = {
        "asset": {"version": "2.0", "generator": "Nutmeg prepare_player.py (Quaternius CC0 assets)"},
        "scene": doc.get("scene", 0),
        "scenes": doc["scenes"],
        "nodes": json.loads(json.dumps(doc["nodes"])),
        "samplers": doc.get("samplers", []),
    }

    # Meshes: only the attributes the game uses.
    gltf["meshes"] = []
    for mesh in doc["meshes"]:
        prims = []
        for p in mesh["primitives"]:
            attrs = {n: out.accessor(char, p["attributes"][n], 34962) for n in ATTRIBUTES if n in p["attributes"]}
            q = {"attributes": attrs, "indices": out.accessor(char, p["indices"], 34963)}
            if "material" in p:
                q["material"] = p["material"]
            prims.append(q)
        gltf["meshes"].append({"name": mesh.get("name", ""), "primitives": prims})

    # Hairstyles, beside the body under the armature, sharing the eyebrows' hair material.
    hair_material = next(i for i, m in enumerate(doc["materials"]) if m.get("name", "").startswith("MI_Hair"))
    armature = next(i for i, n in enumerate(doc["nodes"]) if n.get("name") == "Armature")
    for style in HAIRSTYLES:
        node = add_hairstyle(out, gltf, char, load_gltf(base, HAIR_FOLDER + style + ".gltf"), style, hair_material)
        gltf["nodes"][armature]["children"].append(node)

    skin = dict(doc["skins"][0])
    skin["inverseBindMatrices"] = out.accessor(char, skin["inverseBindMatrices"])
    gltf["skins"] = [skin]

    # Textures: smaller, embedded; the dropped ones leave their material slot empty.
    images, textures, new_texture = [], [], {}
    for t_index, tex in enumerate(doc["textures"]):
        name = doc["images"][tex["source"]]["uri"]
        spec = TEXTURES.get(name, (512, "JPEG"))
        if spec is None:
            continue
        data = image_bytes(Image.open(io.BytesIO(base.read(folder + "/" + name))), *spec)
        images.append(
            {"name": name, "bufferView": out.view(data), "mimeType": "image/jpeg" if spec[1] == "JPEG" else "image/png"}
        )
        new_texture[t_index] = len(textures)
        textures.append({"sampler": tex.get("sampler", 0), "source": len(images) - 1})
    materials = []
    for m in doc["materials"]:
        m = json.loads(json.dumps(m))
        pbr = m.setdefault("pbrMetallicRoughness", {})
        for slot, owner in (("normalTexture", m), ("baseColorTexture", pbr), ("metallicRoughnessTexture", pbr)):
            if slot in owner:
                if owner[slot]["index"] in new_texture:
                    owner[slot]["index"] = new_texture[owner[slot]["index"]]
                else:
                    del owner[slot]
                    if slot == "metallicRoughnessTexture":
                        pbr["roughnessFactor"] = 0.7
        materials.append(m)
    gltf["materials"], gltf["textures"], gltf["images"] = materials, textures, images

    # Animations: rotations of every bone the character has, and the pelvis's height, moved to his own rest height.
    names = {n.get("name"): i for i, n in enumerate(doc["nodes"])}
    gltf["animations"] = []
    for lib, wanted in libs:
        lib_names = [n.get("name") for n in lib.doc["nodes"]]
        pelvis_offset = np.array(doc["nodes"][names["pelvis"]]["translation"]) - np.array(
            lib.doc["nodes"][lib_names.index("pelvis")]["translation"]
        )
        found = {a["name"]: a for a in lib.doc["animations"]}
        for name in wanted:
            if name not in found:
                sys.exit(f"Animation {name} is missing from the library")
            anim = found[name]
            samplers, channels, times = [], [], {}
            for ch in anim["channels"]:
                bone = lib_names[ch["target"]["node"]]
                path = ch["target"]["path"]
                if bone not in names or not (path == "rotation" or (path == "translation" and bone == "pelvis")):
                    continue
                s = anim["samplers"][ch["sampler"]]
                if s["input"] not in times:
                    times[s["input"]] = out.accessor(lib, s["input"])
                values = None
                if path == "translation":
                    values = (lib.array(s["output"]).astype("<f4") + pelvis_offset.astype("<f4")).tobytes()
                output = out.accessor(lib, s["output"], data=values)
                interpolation = s.get("interpolation", "LINEAR")
                samplers.append({"input": times[s["input"]], "output": output, "interpolation": interpolation})
                channels.append({"sampler": len(samplers) - 1, "target": {"node": names[bone], "path": path}})
            gltf["animations"].append({"name": name, "samplers": samplers, "channels": channels})

    gltf["accessors"], gltf["bufferViews"] = out.accessors, out.views
    while len(out.buffer) % 4:
        out.buffer.append(0)
    gltf["buffers"] = [{"byteLength": len(out.buffer)}]

    body_material = next(i for i, m in enumerate(doc["materials"]) if m.get("name", "").startswith("MI_Superhero"))
    body = next(i for i, m in enumerate(doc["meshes"]) if m["primitives"][0].get("material") == body_material)
    prim, regions = kit_regions(char, body, [doc["nodes"][j].get("name") for j in doc["skins"][0]["joints"]])
    kit = kit_map(char, prim, regions)

    text = json.dumps(gltf, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    glb = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(text) + 8 + len(out.buffer))
    glb += struct.pack("<II", len(text), 0x4E4F534A) + text
    glb += struct.pack("<II", len(out.buffer), 0x004E4942) + bytes(out.buffer)

    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "player.glb"), "wb") as f:
        f.write(glb)
    with open(os.path.join(out_dir, "player-kit.png"), "wb") as f:
        f.write(kit)
    skin_jpg = image_bytes(Image.open(io.BytesIO(base.read(folder + "/" + SKIN_TEXTURE))), KIT_SIZE, "JPEG")
    with open(os.path.join(out_dir, "player-skin.jpg"), "wb") as f:
        f.write(skin_jpg)
    counts = np.bincount(regions, minlength=5)
    print(
        f"player.glb {len(glb) / 1e6:.2f} MB, {len(gltf['animations'])} animations; "
        f"player-skin.jpg {len(skin_jpg) / 1e3:.0f} kB; player-kit.png {len(kit) / 1e3:.0f} kB"
    )
    print("body vertices per region (skin, shirt, shorts, socks, boots):", counts.tolist())


if __name__ == "__main__":
    main()

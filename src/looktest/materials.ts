import { Color3, Material, Mesh, PBRMaterial, Scene, StandardMaterial, Texture } from "@babylonjs/core";
import { CellMaterial } from "@babylonjs/materials";
import type { Look } from "./options";

/**
 * A look-independent description of a surface. Meshes carry a spec id in their metadata and
 * the active look (stylised physically based, or toon) turns specs into real materials.
 */
export interface SurfaceSpec {
  color: Color3;
  /** 0 = mirror, 1 = fully matte (stylised look only). */
  roughness: number;
  metallic?: number;
  texture?: Texture;
  emissive?: Color3;
  /** How strongly rain makes this surface shiny (0 = not at all). */
  wettable?: number;
  /** Use the texture's alpha for smooth transparency (e.g. nets) instead of a hard cut-out. */
  blend?: boolean;
  /** Toon look: draw an ink outline around this mesh. */
  outline?: boolean;
}

interface Built {
  material: Material;
  spec: SurfaceSpec;
}

const MAX_LIGHTS = 8;

export class SurfaceLibrary {
  private readonly specs = new Map<string, SurfaceSpec>();
  private readonly built = new Map<string, Built>();
  private look: Look = "stylised";
  private wetness = 0;

  constructor(private readonly scene: Scene) {}

  define(id: string, spec: SurfaceSpec): void {
    this.specs.set(id, spec);
  }

  /** Tag a mesh with a surface; it gets the matching material for the current look. */
  assign(mesh: Mesh, id: string): void {
    if (!this.specs.has(id)) throw new Error(`Unknown surface "${id}"`);
    mesh.metadata = { ...(mesh.metadata ?? {}), surface: id };
    this.apply(mesh);
  }

  setLook(look: Look): void {
    if (look === this.look && this.built.size > 0) return;
    this.look = look;
    for (const b of this.built.values()) b.material.dispose();
    this.built.clear();
    for (const mesh of this.scene.meshes) {
      if (mesh instanceof Mesh && mesh.metadata?.surface) this.apply(mesh);
    }
  }

  /** 0 = dry, 1 = soaked. Affects shine (stylised) and colour depth (both looks). */
  setWetness(wetness: number): void {
    this.wetness = wetness;
    for (const b of this.built.values()) this.applyWetness(b);
  }

  /** Change how brightly a glowing surface (lamps, LED boards) shines. */
  setEmissive(id: string, emissive: Color3): void {
    const spec = this.specs.get(id);
    if (!spec) return;
    spec.emissive = emissive;
    const b = this.built.get(id);
    if (b?.material instanceof PBRMaterial || b?.material instanceof StandardMaterial) {
      b.material.emissiveColor = emissive;
    }
  }

  private apply(mesh: Mesh): void {
    const id = mesh.metadata.surface as string;
    const b = this.material(id);
    mesh.material = b.material;
    const toonOutline = this.look === "toon" && b.spec.outline === true;
    mesh.renderOutline = toonOutline;
    if (toonOutline) {
      mesh.outlineColor = new Color3(0.06, 0.07, 0.1);
      mesh.outlineWidth = 0.035;
    }
  }

  private material(id: string): Built {
    const existing = this.built.get(id);
    if (existing) return existing;
    const spec = this.specs.get(id)!;
    const material = this.look === "toon" ? this.toon(id, spec) : this.stylised(id, spec);
    const b = { material, spec };
    this.applyWetness(b);
    this.built.set(id, b);
    return b;
  }

  private stylised(id: string, spec: SurfaceSpec): Material {
    const m = new PBRMaterial(`pbr:${id}`, this.scene);
    m.albedoColor = spec.color.clone();
    if (spec.texture) {
      m.albedoTexture = spec.texture;
      if (spec.texture.hasAlpha) {
        m.useAlphaFromAlbedoTexture = true;
        m.transparencyMode = spec.blend ? Material.MATERIAL_ALPHABLEND : Material.MATERIAL_ALPHATEST;
        m.backFaceCulling = false;
      }
    }
    m.roughness = spec.roughness;
    m.metallic = spec.metallic ?? 0;
    m.maxSimultaneousLights = MAX_LIGHTS;
    m.realTimeFiltering = true;
    if (spec.emissive) {
      m.emissiveColor = spec.emissive;
      if (spec.texture) m.emissiveTexture = spec.texture;
    }
    return m;
  }

  private toon(id: string, spec: SurfaceSpec): Material {
    if (spec.texture?.hasAlpha) {
      // The cel material has no alpha cut-out, so see-through surfaces (nets) use a matte standard material.
      const m = new StandardMaterial(`toon:${id}`, this.scene);
      m.diffuseColor = spec.color.clone();
      m.diffuseTexture = spec.texture;
      m.specularColor = Color3.Black();
      m.backFaceCulling = false;
      m.useAlphaFromDiffuseTexture = true;
      m.transparencyMode = spec.blend ? Material.MATERIAL_ALPHABLEND : Material.MATERIAL_ALPHATEST;
      return m;
    }
    if (spec.emissive) {
      // Lamps and LED boards are unlit, so they read as glowing: output = texture × emissive colour.
      const m = new StandardMaterial(`toon:${id}`, this.scene);
      m.disableLighting = true;
      m.diffuseColor = Color3.Black();
      m.emissiveColor = spec.emissive;
      if (spec.texture) m.diffuseTexture = spec.texture;
      return m;
    }
    const m = new CellMaterial(`toon:${id}`, this.scene);
    m.diffuseColor = spec.color.clone();
    if (spec.texture) m.diffuseTexture = spec.texture;
    m.computeHighLevel = true;
    // The cel shader lights every surface at least 20% per light, so extra lights wash everything out.
    // Only the first two lights (sky fill + key light) are used; floodlight pools would need a custom toon shader.
    m.maxSimultaneousLights = 2;
    return m;
  }

  private applyWetness({ material, spec }: Built): void {
    const wet = this.wetness * (spec.wettable ?? 0);
    const darken = 1 - 0.3 * wet;
    if (material instanceof PBRMaterial) {
      material.albedoColor = spec.color.scale(darken);
      material.roughness = spec.roughness * (1 - 0.65 * wet);
      material.clearCoat.isEnabled = wet > 0.05;
      material.clearCoat.intensity = wet * 0.6;
      material.clearCoat.roughness = 0.45;
    } else if (material instanceof CellMaterial) {
      material.diffuseColor = spec.color.scale(darken);
    }
  }
}

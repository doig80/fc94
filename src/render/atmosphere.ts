import {
  Camera,
  CascadedShadowGenerator,
  ClusteredLightContainer,
  Color3,
  Color4,
  DefaultRenderingPipeline,
  DirectionalLight,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  ReflectionProbe,
  RenderTargetTexture,
  Scene,
  ShadowGenerator,
  SpotLight,
  SSAO2RenderingPipeline,
  StandardMaterial,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core";
import type { Look, Quality, TimeOfDay, Weather } from "./types";

interface Preset {
  skyTop: Color3;
  skyHorizon: Color3;
  sunDir: Vector3;
  sunColor: Color3;
  sunIntensity: number;
  hemiIntensity: number;
  hemiGround: Color3;
  flood: number;
  exposure: number;
}

const PRESETS: Record<TimeOfDay, Preset> = {
  day: {
    skyTop: Color3.FromHexString("#3d7fd6"),
    skyHorizon: Color3.FromHexString("#bfe0ff"),
    sunDir: new Vector3(0.45, -1, 0.55),
    sunColor: Color3.FromHexString("#fff4e0"),
    sunIntensity: 3.2,
    hemiIntensity: 0.7,
    hemiGround: Color3.FromHexString("#4a6b3a"),
    flood: 0,
    exposure: 1.0,
  },
  dusk: {
    skyTop: Color3.FromHexString("#2b2f6b"),
    skyHorizon: Color3.FromHexString("#ff9a5c"),
    sunDir: new Vector3(0.9, -0.28, 0.35),
    sunColor: Color3.FromHexString("#ffb070"),
    sunIntensity: 2.2,
    hemiIntensity: 0.45,
    hemiGround: Color3.FromHexString("#3a2d3a"),
    flood: 0.5,
    exposure: 1.1,
  },
  night: {
    skyTop: Color3.FromHexString("#03050d"),
    skyHorizon: Color3.FromHexString("#1a2140"),
    // At night the "sun" stands in for the combined floodlights so players still cast crisp shadows.
    sunDir: new Vector3(0.25, -1, 0.35),
    sunColor: Color3.FromHexString("#eef2ff"),
    sunIntensity: 0.9,
    hemiIntensity: 0.08,
    hemiGround: Color3.FromHexString("#101418"),
    flood: 1,
    exposure: 1.2,
  },
};

/**
 * Floodlight lamps per tower (#29). With clustered lighting many lamps cost little, so each aims at its own part
 * of the pitch and night matches get real pools of light; fewer on Low. Without it (old WebGL2 hardware), one
 * wide lamp per tower lights the whole pitch evenly.
 */
const LAMPS_PER_TOWER: Record<Quality, number> = { high: 6, low: 2 };
/** Where a tower's lamps aim, as fractions of the way from the centre spot to the tower (across x, along z). */
const AIMS: Record<number, [number, number][]> = {
  6: [
    [0.08, 0.15],
    [0.42, 0.15],
    [0.76, 0.15],
    [0.08, 0.58],
    [0.42, 0.58],
    [0.76, 0.58],
  ],
  2: [
    [0.25, 0.3],
    [0.68, 0.55],
  ],
};

export class Atmosphere {
  private readonly sky: Mesh;
  private readonly sun: DirectionalLight;
  private readonly hemi: HemisphericLight;
  private readonly spots: SpotLight[];
  /** The floodlights' clustered light, when the hardware has it (null: a few plain spotlights instead). */
  private readonly flood: ClusteredLightContainer | null;
  /** Each lamp's share of the floodlight power. */
  private readonly lampShare: number;
  private readonly probe: ReflectionProbe;
  /** Null without shadow maps (Low quality in the match draws blob shadows instead). */
  readonly shadows: ShadowGenerator | null;
  private readonly pipeline: DefaultRenderingPipeline;
  /** Floodlight power, 0..1 (drives lamp panels and LED boards). */
  floodPower = 0;

  constructor(
    private readonly scene: Scene,
    camera: Camera,
    lamps: Vector3[],
    quality: Quality,
    shadowMaps = true,
  ) {
    this.sky = MeshBuilder.CreateSphere(
      "sky",
      { diameter: 900, segments: 16, sideOrientation: Mesh.BACKSIDE, updatable: true },
      scene,
    );
    const skyMat = new StandardMaterial("skyMat", scene);
    skyMat.disableLighting = true;
    skyMat.emissiveColor = Color3.White();
    skyMat.diffuseColor = Color3.Black();
    skyMat.fogEnabled = false;
    this.sky.material = skyMat;
    this.sky.infiniteDistance = true;
    this.sky.isPickable = false;

    this.hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    this.sun = new DirectionalLight("sun", new Vector3(0.45, -1, 0.55), scene);
    this.sun.position = new Vector3(-60, 120, -80);
    // Materials limited to a few lights (toon) must get the key light and sky fill first.
    this.sun.renderPriority = 2;
    this.hemi.renderPriority = 1;

    if (!shadowMaps) {
      this.shadows = null;
    } else if (quality === "high") {
      const csm = new CascadedShadowGenerator(2048, this.sun);
      csm.numCascades = 3;
      csm.shadowMaxZ = 160;
      csm.stabilizeCascades = true;
      csm.lambda = 0.85;
      csm.filteringQuality = ShadowGenerator.QUALITY_HIGH;
      csm.usePercentageCloserFiltering = true;
      csm.bias = 0.004;
      this.shadows = csm;
    } else {
      const sg = new ShadowGenerator(1024, this.sun);
      sg.usePercentageCloserFiltering = true;
      sg.filteringQuality = ShadowGenerator.QUALITY_LOW;
      sg.bias = 0.002;
      this.sun.shadowMinZ = 1;
      this.sun.shadowMaxZ = 300;
      this.shadows = sg;
    }

    // Floodlight pools. No shadows from these; the key light handles shadows.
    const test = new SpotLight("floodTest", Vector3.Zero(), Vector3.Down(), 1, 1, scene, true);
    const perTower = LAMPS_PER_TOWER[quality];
    const clustered = ClusteredLightContainer.IsLightSupported(test);
    test.dispose();
    if (clustered) {
      this.spots = lamps.flatMap((tower, t) => floodLamps(scene, tower, perTower, t));
      this.flood = new ClusteredLightContainer("floodlights", this.spots, scene);
    } else {
      this.spots = lamps.map((p, i) => {
        const dir = new Vector3(-p.x * 0.55, -p.y, -p.z * 0.55).normalize();
        const s = new SpotLight(`flood${i}`, p, dir, 1.25, 2, scene);
        s.range = 260;
        s.diffuse = Color3.FromHexString("#fff6e8");
        return s;
      });
      this.flood = null;
    }
    this.lampShare = lamps.length / this.spots.length;

    // Environment reflections for physically based materials, captured from the sky once per change.
    this.probe = new ReflectionProbe("envProbe", quality === "high" ? 256 : 64, scene);
    this.probe.renderList!.push(this.sky);
    this.probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    scene.environmentTexture = this.probe.cubeTexture;

    this.pipeline = new DefaultRenderingPipeline("post", true, scene, [camera]);
    this.pipeline.samples = quality === "high" ? 4 : 1;
    this.pipeline.fxaaEnabled = quality !== "high";
    this.pipeline.bloomEnabled = true;
    this.pipeline.bloomThreshold = 0.85;
    this.pipeline.bloomWeight = 0.35;
    this.pipeline.bloomKernel = 64;
    this.pipeline.bloomScale = 0.5;
    const ip = this.pipeline.imageProcessing;
    ip.toneMappingEnabled = true;
    ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES;
    ip.vignetteEnabled = true;
    ip.vignetteWeight = 1.4;
    ip.vignetteColor = new Color4(0, 0, 0, 0);

    if (quality === "high") {
      try {
        const ssao = new SSAO2RenderingPipeline("ssao", scene, { ssaoRatio: 0.5, blurRatio: 1 }, [camera]);
        ssao.radius = 1.2;
        ssao.totalStrength = 1.1;
        ssao.samples = 16;
        ssao.maxZ = 200;
      } catch (err) {
        console.warn("SSAO unavailable", err);
      }
    }
  }

  apply(time: TimeOfDay, weather: Weather, look: Look): void {
    const p = PRESETS[time];
    const overcast = weather === "clear" ? 0 : 1;
    const grey =
      time === "night"
        ? Color3.FromHexString("#0b0e16")
        : Color3.FromHexString(weather === "snow" ? "#c9ced6" : "#7d8794");
    const top = Color3.Lerp(p.skyTop, grey, 0.75 * overcast);
    const horizon = Color3.Lerp(p.skyHorizon, grey.scale(1.1), 0.7 * overcast);
    this.paintSky(top, horizon);

    this.sun.direction = p.sunDir.normalizeToNew();
    this.sun.position = this.sun.direction.scale(-160);
    this.sun.diffuse = p.sunColor;
    // At night the key light is a stand-in for the floodlights: no single "sun" highlight on a wet pitch.
    this.sun.specular = p.sunColor.scale(time === "night" ? 0.08 : 1 - 0.7 * overcast);
    // Toon (cel) materials use classic lighting, which saturates much earlier than physically based materials.
    const lightScale = look === "toon" ? { day: 0.5, dusk: 1.0, night: 1.0 }[time] : 1;
    // With floodlight pools the night key light steps back, so the pools show.
    const night = this.flood ? 0.62 : 1;
    this.sun.intensity = lightScale * p.sunIntensity * (time === "night" ? night : 1 - 0.55 * overcast);
    // A low dusk sun lands in the darkest cel band, so the toon look leans on the sky fill instead.
    const toonFill = { day: 1.4, dusk: 2.6, night: 1.4 }[time];
    this.hemi.intensity = (look === "toon" ? toonFill : 1) * p.hemiIntensity * (1 + 0.3 * overcast);
    this.hemi.diffuse = Color3.Lerp(horizon, Color3.White(), 0.5);
    this.hemi.groundColor = p.hemiGround;

    this.floodPower = p.flood;
    // Toon materials cannot show floodlight pools (see materials.ts), so the floodlights are off in that look.
    const floodOn = p.flood > 0 && look !== "toon";
    for (const s of this.spots) {
      s.intensity = p.flood * 1.4 * this.lampShare * (this.flood ? 3 : 1);
      s.specular = s.diffuse.scale(0.5);
      if (!this.flood) s.setEnabled(floodOn);
    }
    this.flood?.setEnabled(floodOn);

    const scene = this.scene;
    scene.clearColor = new Color4(horizon.r, horizon.g, horizon.b, 1);
    scene.fogMode = overcast ? Scene.FOGMODE_EXP2 : Scene.FOGMODE_NONE;
    scene.fogDensity = weather === "snow" ? 0.0085 : 0.006;
    scene.fogColor = horizon;
    scene.environmentIntensity = look === "toon" ? 0.4 : time === "night" ? 0.35 : 0.9;

    this.probe.cubeTexture.resetRefreshCounter();

    const ip = this.pipeline.imageProcessing;
    ip.exposure = p.exposure;
    ip.contrast = look === "toon" ? 1.05 : 1.15;
    // Toon look keeps colours flat and punchy; stylised gets filmic tone mapping.
    ip.toneMappingType =
      look === "toon"
        ? ImageProcessingConfiguration.TONEMAPPING_KHR_PBR_NEUTRAL
        : ImageProcessingConfiguration.TONEMAPPING_ACES;
    this.pipeline.bloomWeight = look === "toon" ? 0.2 : time === "night" ? 0.6 : 0.3;
  }

  addShadowCasters(meshes: Mesh[]): void {
    for (const m of meshes) this.shadows?.addShadowCaster(m, false);
  }

  private paintSky(top: Color3, horizon: Color3): void {
    const positions = this.sky.getVerticesData(VertexBuffer.PositionKind)!;
    const colors = new Float32Array((positions.length / 3) * 4);
    for (let i = 0; i < positions.length / 3; i++) {
      const y = positions[i * 3 + 1] / 450; // -1..1
      const t = Math.pow(Math.max(0, y), 0.55);
      const c = Color3.Lerp(horizon, top, t);
      colors.set([c.r, c.g, c.b, 1], i * 4);
    }
    this.sky.setVerticesData(VertexBuffer.ColorKind, colors, true);
  }
}

/**
 * One tower's lamps: spread along its light panel, each a narrow beam aimed at its own spot in the tower's quarter
 * of the pitch, so the beams overlap into pools of light with a little shade between.
 */
function floodLamps(scene: Scene, tower: Vector3, count: number, t: number): SpotLight[] {
  const across = new Vector3(-tower.z, 0, tower.x).normalize();
  return (AIMS[count] ?? AIMS[2]).map(([fx, fz], k) => {
    const offset = (k % 3) - 1;
    const from = tower.add(across.scale(offset * 2.2)).add(new Vector3(0, k < 3 ? 0.8 : -0.8, 0));
    const aim = new Vector3(tower.x * fx * 0.88, 0, tower.z * fz * 0.88);
    const s = new SpotLight(`flood${t}-${k}`, from, aim.subtract(from).normalize(), 0.85, 3, scene, true);
    s.range = 150;
    s.diffuse = Color3.FromHexString("#fff6e8");
    return s;
  });
}

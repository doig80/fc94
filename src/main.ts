import "./style.css";
import type { Scene } from "@babylonjs/core";
import { createEngine } from "./render/engine";
import { showInspector } from "./render/inspector";
import { LookTest } from "./looktest/lookTest";
import { parseOptions, toSearch, type LookTestOptions } from "./looktest/options";
import { buildPanel } from "./looktest/ui";

declare global {
  interface Window {
    /** Set when the first frames have rendered; used by Playwright screenshot scripts (and the scene, for close-ups). */
    __looktest?: { ready: boolean; renderer: string; scene?: Scene };
  }
}

async function main(): Promise<void> {
  const isMobile = window.matchMedia("(pointer: coarse)").matches;
  const options = parseOptions(window.location.search, isMobile);
  const canvas = document.getElementById("game") as HTMLCanvasElement;

  const { engine, renderer } = await createEngine(canvas, options.renderer);
  if (options.quality === "low") engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 1.25));
  else engine.setHardwareScalingLevel(1 / Math.min(window.devicePixelRatio, 2));

  const lookTest = new LookTest(engine, options);
  window.__looktest = { ready: false, renderer, scene: lookTest.scene };
  if (options.inspector) void showInspector(lookTest.scene);

  const panel = options.hideUi
    ? undefined
    : buildPanel(options, (key, value) => {
        const next = { ...options, [key]: value } as LookTestOptions;
        window.history.replaceState(null, "", toSearch(next) + window.location.hash);
        if (key === "quality" || key === "players") {
          // Quality changes shadow maps, particle counts etc., and the players are loaded once: rebuild from scratch.
          window.location.reload();
          return;
        }
        lookTest.update({ [key]: value });
      });
  if (options.hideUi) document.getElementById("panel")?.remove();

  let frames = 0;
  // Ready once the first frames are drawn and everything asked for has loaded (the character test's players).
  let loaded = false;
  lookTest.loaded.then(
    () => (loaded = true),
    (err: unknown) => {
      console.error(err);
      loaded = true;
    },
  );
  engine.runRenderLoop(() => {
    lookTest.scene.render();
    if (++frames >= 30 && loaded && !window.__looktest!.ready) {
      window.__looktest!.ready = true;
      document.body.dataset.ready = "1";
    }
  });
  window.addEventListener("resize", () => engine.resize());

  if (panel) {
    const update = () =>
      panel.setStatus(`${renderer} · ${engine.getFps().toFixed(0)} fps · ${options.quality} quality`);
    update();
    window.setInterval(update, 500);
  }
}

// The match is the default page; `?mode=looktest` is the art look-test, `?mode=physics` the physics sandbox.
const mode = new URLSearchParams(window.location.search).get("mode");
const start =
  mode === "physics"
    ? import("./sandbox/sandbox").then((m) => m.startSandbox())
    : mode === "looktest"
      ? main()
      : import("./game/matchApp").then((m) => m.startMatch());

start.catch((err) => {
  console.error(err);
  const el = document.getElementById("error");
  if (el) {
    el.hidden = false;
    el.textContent = "Sorry, this browser can't run the game (WebGL2 or WebGPU is required).";
  }
});

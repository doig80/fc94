import { AbstractEngine, Engine, WebGPUEngine } from "@babylonjs/core";
import type { RendererPref } from "./types";

export interface EngineResult {
  engine: AbstractEngine;
  renderer: "WebGPU" | "WebGL2";
}

/** WebGPU when available, WebGL2 otherwise (docs/specs/01 §1). */
export async function createEngine(canvas: HTMLCanvasElement, pref: RendererPref): Promise<EngineResult> {
  if (pref !== "webgl" && "gpu" in navigator && (await WebGPUEngine.IsSupportedAsync)) {
    try {
      const engine = new WebGPUEngine(canvas, { antialias: true, adaptToDeviceRatio: true, stencil: true });
      await engine.initAsync();
      return { engine, renderer: "WebGPU" };
    } catch (err) {
      console.warn("WebGPU init failed, falling back to WebGL2", err);
    }
  }
  const engine = new Engine(canvas, true, { stencil: true, preserveDrawingBuffer: false }, true);
  return { engine, renderer: "WebGL2" };
}

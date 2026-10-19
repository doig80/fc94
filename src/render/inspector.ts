import type { Scene } from "@babylonjs/core";

/**
 * Opens the Babylon.js Inspector (`?inspector=1`) for debugging visuals. Dev builds only (`pnpm dev`): the
 * production build drops this code, so the Inspector never adds to the players' download.
 */
export async function showInspector(scene: Scene): Promise<void> {
  if (!import.meta.env.DEV) return;
  const { ShowInspector } = await import("@babylonjs/inspector");
  ShowInspector(scene);
}

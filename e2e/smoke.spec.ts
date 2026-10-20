import { expect, test } from "@playwright/test";

test("look-test boots and renders without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text());
  });
  await page.goto("./?mode=looktest&renderer=webgl&quality=low");
  await page.waitForFunction(() => window.__looktest?.ready === true, null, { timeout: 60_000 });
  await expect(page.locator("#panel button", { hasText: "Toon" })).toBeVisible();
  await page.locator("#panel button", { hasText: "Toon" }).click();
  await page.locator("#panel button", { hasText: "Rain" }).click();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test("the character test's new players load, in their kits, and run", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("./?mode=looktest&renderer=webgl&quality=low&players=both");
  await page.waitForFunction(() => window.__looktest?.ready === true, null, { timeout: 150_000 });
  const bodies = await page.evaluate(
    () => window.__looktest!.scene!.meshes.filter((m) => m.name.endsWith(":SuperHero_Male")).length,
  );
  expect(bodies).toBe(3);
  // Running: the striker's legs swing from frame to frame (the animations play, not just switch on). Over a few
  // frames, as a leg barely moves at the turn of its swing.
  const thigh = () =>
    page.evaluate(() => {
      const scene = window.__looktest!.scene!;
      return new Promise<number[]>((resolve) => {
        // After the next drawn frame.
        scene.onAfterRenderObservable.addOnce(() => {
          const q = scene.getTransformNodeByName("new-striker:thigh_r")!.rotationQuaternion!;
          resolve([q.x, q.y, q.z, q.w]);
        });
      });
    });
  const frames = [await thigh()];
  for (let k = 0; k < 6; k++) frames.push(await thigh());
  const swing = Math.max(...frames.slice(1).map((q) => turned(frames[0], q)));
  expect(swing).toBeGreaterThan(0.2);
  expect(errors).toEqual([]);
});

/** How far apart two rotations are (radians). */
function turned(a: number[], b: number[]): number {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return 2 * Math.acos(Math.min(1, dot));
}

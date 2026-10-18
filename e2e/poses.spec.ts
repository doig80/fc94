import { test } from "@playwright/test";

// Visual check of action poses (not run in CI): `pnpm e2e e2e/poses.spec.ts`, then look at screenshots/poses.png.
test("action poses", async ({ page }) => {
  await page.goto("./?renderer=webgl&quality=high");
  await page.waitForFunction(() => window.__match?.ready === true, null, { timeout: 60_000 });
  await page.keyboard.press("KeyH");
  await page.evaluate(() => {
    const s = window.__match!.state();
    // Line four players up near the camera's target, each in a different action, frozen mid-way.
    const kinds = ["slide", "header", "bicycle", "stumble"] as const;
    kinds.forEach((kind, n) => {
      const p = s.players[5 + n];
      p.pos = { x: -2 + n * 2.2, z: 3 };
      p.facing = { x: 1, z: 0 };
      p.action = { kind, ticks: 100000, total: 200000, dir: { x: 1, z: 0 } };
    });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "screenshots/poses.png" });
});

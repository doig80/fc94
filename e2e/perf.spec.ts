import { expect, test } from "@playwright/test";

/** Draw-call budget per quality preset (docs/specs/01 §4). */
const BUDGET = { high: 300, low: 120 };

// Today's players, and the character test's new model (?players=new, issue #27).
for (const players of ["old", "new"]) {
  for (const [quality, budget] of Object.entries(BUDGET)) {
    test(`draw calls on ${quality} with the ${players} players stay within ${budget}`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto(`./?renderer=webgl&quality=${quality}&cpu=0&players=${players}`);
      await page.waitForFunction(() => window.__match?.ready === true, null, { timeout: 150_000 });
      const calls = await page.evaluate(() => window.__match!.drawCalls());
      console.log(`${quality}, ${players} players: ${calls} draw calls (budget ${budget})`);
      expect(calls).toBeGreaterThan(0);
      expect(calls).toBeLessThanOrEqual(budget);
    });
  }
}

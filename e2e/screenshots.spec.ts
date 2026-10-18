import { test } from "@playwright/test";

/**
 * Captures the look-test in every look × time combination (+ weather) into screenshots/.
 * Run with `pnpm screenshots`. CI uploads the folder as an artifact for PR review.
 */
const SHOTS: { name: string; query: string }[] = [];
for (const look of ["stylised", "toon"]) {
  for (const time of ["day", "dusk", "night"])
    SHOTS.push({ name: `${look}-${time}-clear`, query: `look=${look}&time=${time}` });
  SHOTS.push({ name: `${look}-day-rain`, query: `look=${look}&time=day&weather=rain` });
  SHOTS.push({ name: `${look}-night-rain`, query: `look=${look}&time=night&weather=rain` });
  SHOTS.push({ name: `${look}-dusk-snow`, query: `look=${look}&time=dusk&weather=snow` });
  SHOTS.push({ name: `${look}-day-broadcast`, query: `look=${look}&time=day&camera=broadcast` });
}

for (const shot of SHOTS) {
  test(`screenshot ${shot.name}`, async ({ page }) => {
    const quality = process.env.SHOT_QUALITY ?? "high";
    await page.goto(`./?mode=looktest&${shot.query}&quality=${quality}&renderer=webgl&freeze=1&hideui=1`);
    await page.waitForFunction(() => window.__looktest?.ready === true, null, { timeout: 80_000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: `screenshots/${shot.name}.png` });
  });
}

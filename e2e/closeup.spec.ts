import { test } from "@playwright/test";

// Ad-hoc close-ups for art review: SHOT_QUERY="look=toon&time=night" pnpm e2e e2e/closeup.spec.ts
test("closeup", async ({ page }) => {
  test.skip(!process.env.SHOT_QUERY, "set SHOT_QUERY to use");
  await page.goto(`./?mode=looktest&${process.env.SHOT_QUERY}&renderer=webgl&freeze=1&hideui=1`);
  await page.waitForFunction(() => window.__looktest?.ready === true, null, { timeout: 80_000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `screenshots/closeup-${process.env.SHOT_NAME ?? "shot"}.png` });
});

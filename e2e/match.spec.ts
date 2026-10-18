import { expect, test } from "@playwright/test";

test("match view boots and draws the simulation without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text());
  });
  await page.goto(`./?mode=match&renderer=webgl&quality=${process.env.SHOT_QUALITY ?? "low"}`);
  await page.waitForFunction(() => window.__match?.ready === true, null, { timeout: 60_000 });
  const state = await page.evaluate(() => window.__match!.state());
  expect(state.players).toHaveLength(10);
  expect(state.tick).toBeGreaterThan(0);
  await page.screenshot({ path: "screenshots/match.png" });
  expect(errors).toEqual([]);
});

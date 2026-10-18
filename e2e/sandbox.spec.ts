import { expect, test } from "@playwright/test";

test("physics sandbox runs and responds to the keyboard", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?mode=physics");
  await page.waitForFunction(() => (window.__sandbox?.tick() ?? 0) > 30);
  const before = await page.evaluate(() => window.__sandbox!.state().players[4].pos.x);
  await page.keyboard.down("KeyD");
  await page.waitForTimeout(800);
  await page.keyboard.up("KeyD");
  const after = await page.evaluate(() => window.__sandbox!.state().players[4].pos.x);
  expect(after).toBeGreaterThan(before + 2);
  await page.keyboard.press("KeyJ");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__sandbox!.state().ball.owner)).not.toBe(4);
  await page.screenshot({ path: "screenshots/sandbox.png" });
  expect(errors).toEqual([]);
});

import { expect, test } from "@playwright/test";

test("tuning panel changes the live match and resets", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("./?tune=1&renderer=webgl&quality=low");
  await page.waitForFunction(() => window.__match?.ready === true, null, { timeout: 120_000 });
  const panel = page.locator("#tuning");
  await expect(panel).toBeVisible();
  await expect(panel.locator(".tuning-count")).toHaveText("defaults");

  await panel.locator('input[data-key="action.passArrivalSpeed"]').fill("12");
  expect(await page.evaluate(() => window.__match!.params().action.passArrivalSpeed)).toBe(12);
  await expect(panel.locator(".tuning-count")).toHaveText("1 changed");

  await panel.getByRole("button", { name: "Copy changes" }).click();
  await expect(panel.locator("textarea")).toHaveValue(/"passArrivalSpeed": 12/);

  await panel.getByRole("button", { name: "Reset all" }).click();
  expect(await page.evaluate(() => window.__match!.params().action.passArrivalSpeed)).toBe(8);
  await expect(panel.locator(".tuning-count")).toHaveText("defaults");

  // T hides and shows the panel.
  await page.keyboard.press("KeyT");
  await expect(panel).toBeHidden();
});

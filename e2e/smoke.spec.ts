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

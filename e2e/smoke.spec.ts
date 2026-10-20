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
  const players = await page.evaluate(() => {
    const scene = window.__looktest!.scene!;
    const bodies = scene.meshes.filter((m) => m.name.endsWith(":SuperHero_Male"));
    // Running: the striker's animations are blended, at least one of them weighted in.
    const striker = scene.animationGroups.filter((g) => g.name.startsWith("new-striker:"));
    return { bodies: bodies.length, gaits: striker.length, moving: striker.some((g) => g.weight > 0) };
  });
  expect(players).toEqual({ bodies: 3, gaits: 4, moving: true });
  expect(errors).toEqual([]);
});

test("a match with the new players (?players=new) boots with everyone in the new model, and plays", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto("./?renderer=webgl&quality=low&players=new");
  await page.waitForFunction(() => window.__match?.ready === true, null, { timeout: 150_000 });
  const tick = await page.evaluate(() => window.__match!.state().tick);
  await page.waitForFunction((t) => window.__match!.state().tick > t + 30, tick, { timeout: 60_000 });
  const people = await page.evaluate(() => {
    const scene = window.__match!.scene;
    const bodies = scene.meshes.filter((m) => m.name.endsWith(":SuperHero_Male") && m.isEnabled());
    return { bodies: bodies.length, players: window.__match!.state().players.length };
  });
  // 22 players, the referee and his two assistants.
  expect(people).toEqual({ bodies: 25, players: 22 });
  expect(errors).toEqual([]);
});

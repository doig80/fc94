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
  // Into open play: past the kick-off whistle, players running.
  await page.waitForFunction(() => window.__match!.state().lastEvent?.kind === "kickoff", null, {
    timeout: 90_000,
  });
  const tick = await page.evaluate(() => window.__match!.state().tick);
  await page.waitForFunction((t) => window.__match!.state().tick > t + 60, tick, { timeout: 90_000 });
  const people = await page.evaluate(() => {
    const scene = window.__match!.scene;
    const bodies = scene.meshes.filter((m) => m.name.endsWith(":SuperHero_Male") && m.isEnabled());
    return { bodies: bodies.length, players: window.__match!.state().players.length };
  });
  // 22 players, the referee and his two assistants.
  expect(people).toEqual({ bodies: 25, players: 22 });
  // Their legs swing as they run (the animations play, not just switch on): the left knee, which no kick or tackle
  // pose bends, of players running steadily. Looked at over several stretches of play, as everyone may be standing
  // for a free kick in any one of them.
  const knees = () =>
    page.evaluate(() => ({
      tick: window.__match!.state().tick,
      players: window.__match!.state().players.map((p, i) => {
        const q = window.__match!.scene.getTransformNodeByName(
          `person${i}:model:calf_l`,
        )!.rotationQuaternion!;
        return { q: [q.x, q.y, q.z, q.w], speed: Math.hypot(p.vel.x, p.vel.z) };
      }),
    }));
  let swing = 0;
  let before = await knees();
  for (let k = 0; k < 6 && swing <= 0.5; k++) {
    await page.waitForFunction((t) => window.__match!.state().tick > t + 20, before.tick, {
      timeout: 60_000,
    });
    const after = await knees();
    before.players.forEach((p, i) => {
      const q = after.players[i];
      if (p.speed > 4 && Math.abs(q.speed - p.speed) < 0.5) swing = Math.max(swing, turned(p.q, q.q));
    });
    before = after;
  }
  expect(swing).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});

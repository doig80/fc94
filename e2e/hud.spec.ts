import { expect, test } from "@playwright/test";

test("pause stops the match; a goal is replayed and the replay can be skipped", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("./?renderer=webgl&quality=low&cpu=0");
  await page.waitForFunction(() => window.__match?.ready === true, null, { timeout: 120_000 });
  const tick = () => page.evaluate(() => window.__match!.state().tick);
  const mode = () => page.evaluate(() => window.__match!.mode());
  const waitTicks = (n: number) =>
    page.evaluate(
      (count) =>
        new Promise<void>((done) => {
          const target = window.__match!.state().tick + count;
          const check = () =>
            window.__match!.state().tick >= target ? done() : requestAnimationFrame(check);
          check();
        }),
      n,
    );

  // Pause: the clock stands still and the menu shows.
  await page.keyboard.press("Escape");
  expect(await mode()).toBe("paused");
  await expect(page.locator(".pause-menu")).toBeVisible();
  const t0 = await tick();
  await page.waitForTimeout(1500);
  expect(await tick()).toBe(t0);
  await page.keyboard.press("Escape");
  expect(await mode()).toBe("live");
  await waitTicks(5);

  // Score: kick off, then roll the ball into the net.
  await page.keyboard.press("KeyJ");
  await page.waitForFunction(() => window.__match!.state().phase.kind === "play");
  await page.evaluate(() => {
    const s = window.__match!.state();
    const goalX = s.pitch.length / 2;
    const keeper = s.players.length / 2; // team 1's keeper
    s.ball.owner = -1;
    s.ball.pos = { x: goalX - 4, y: 0.5, z: 0 };
    s.ball.vel = { x: 15, y: 0, z: 0 };
    s.ball.lastTouch = keeper - 1;
    s.players[keeper].pos = { x: goalX - 1, z: 6 }; // keeper out of the way
  });
  await page.waitForFunction(() => window.__match!.state().score[0] === 1, null, { timeout: 60_000 });
  await page.waitForFunction(() => window.__match!.mode() === "replay", null, { timeout: 60_000 });
  await expect(page.locator(".replay-badge")).toBeVisible();
  await page.keyboard.press("Space");
  expect(await mode()).toBe("live");
  await expect(page.locator(".replay-badge")).toBeHidden();
  // Then the team that conceded kicks off.
  await page.waitForFunction(() => {
    const p = window.__match!.state().phase;
    return p.kind === "restart" && p.restart.kind === "kickoff" && p.restart.team === 1;
  });
});

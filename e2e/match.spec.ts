import { expect, test } from "@playwright/test";

test("match boots, the keyboard moves the player, and a shot leaves the foot", async ({ page }) => {
  // Software rendering on CI runners is slow; this test drives several seconds of play.
  test.setTimeout(180_000);
  // Review screenshots are for local runs; on CI each one waits for a slow software-rendered frame.
  const snap = async (path: string) => {
    if (!process.env.CI) await page.screenshot({ path });
  };
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text());
  });
  await page.goto(`./?renderer=webgl&quality=${process.env.SHOT_QUALITY ?? "low"}`);
  await page.waitForFunction(() => window.__match?.ready === true, null, { timeout: 60_000 });
  const start = await page.evaluate(() => window.__match!.state());
  expect(start.players).toHaveLength(10);
  const me = start.controllers[0].player;

  // Run towards the ball (it starts just ahead of the forward), then a bit further.
  // Wait for simulation ticks rather than wall time: software rendering in CI can be very slow.
  const ticks = (n: number) =>
    page.evaluate(
      (t0) =>
        new Promise<void>((done) => {
          const check = () => (window.__match!.state().tick >= t0 ? done() : requestAnimationFrame(check));
          check();
        }),
      n,
    );
  const t0 = await page.evaluate(() => window.__match!.state().tick);
  await page.keyboard.down("KeyW");
  await ticks(t0 + 45);
  await page.keyboard.up("KeyW");
  const moved = await page.evaluate((i) => window.__match!.state().players[i].pos, me);
  expect(Math.hypot(moved.x - start.players[me].pos.x, moved.z - start.players[me].pos.z)).toBeGreaterThan(1);

  // Put the ball at the controlled player's feet (the test reaches into the live match), then hold shoot.
  await page.evaluate(() => {
    const s = window.__match!.state();
    const p = s.players[s.controllers[0].player];
    s.ball.pos = { x: p.pos.x + p.facing.x * 0.4, y: 0.11, z: p.pos.z + p.facing.z * 0.4 };
    s.ball.vel = { x: 0, y: 0, z: 0 };
  });
  await page.waitForFunction(() => {
    const s = window.__match!.state();
    return s.ball.owner === s.controllers[0].player;
  });
  await snap("screenshots/match-dribble.png");
  const t1 = await page.evaluate(() => window.__match!.state().tick);
  await page.keyboard.down("KeyK");
  await ticks(t1 + 20);
  await page.keyboard.up("KeyK");
  await ticks(t1 + 26);
  const ball = await page.evaluate(() => window.__match!.state().ball);
  expect(ball.owner).toBe(-1);
  expect(Math.hypot(ball.vel.x, ball.vel.z)).toBeGreaterThan(8);
  await snap("screenshots/match-shot.png");
  expect(errors).toEqual([]);
});

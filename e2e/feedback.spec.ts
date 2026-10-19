import { test } from "@playwright/test";

// Visual review of playtest feedback #21 (rounds 1 and 2) (not run in CI): `pnpm e2e e2e/feedback.spec.ts`.
test("feedback views", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("./?renderer=webgl&quality=high");
  await page.waitForFunction(() => window.__match?.ready === true, null, { timeout: 60_000 });
  await page.keyboard.press("KeyH");
  const ticks = (n: number) =>
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
  const placeBall = (x: number, y: number, z: number) =>
    page.evaluate(
      ([bx, by, bz]) => {
        const s = window.__match!.state();
        s.ball.owner = -1;
        s.ball.pos = { x: bx, y: by, z: bz };
        s.ball.vel = { x: 0, y: 0, z: 0 };
        s.ball.spin = { x: 0, y: 0, z: 0 };
        // Move players out of the way so nobody picks the ball up.
        s.players.forEach((p, i) => (p.pos = { x: -16 + i * 3.4, z: 11 }));
      },
      [x, y, z],
    );
  const views: [string, number, number, number][] = [
    ["centre", 0, 0.11, 0],
    ["near-touchline", 0, 0.11, -11],
    ["near-corner", -18, 0.11, -11],
    ["left-goal", -18, 0.11, 0],
    ["near-right", 17, 0.11, -11],
    ["far-goal", 17, 0.11, 2],
    ["ball-in-air", 10, 2.2, 0],
  ];
  for (const [name, x, y, z] of views) {
    await placeBall(x, y, z);
    if (y > 0.2) {
      // Hold the ball in the air for the picture.
      await page.evaluate(() => {
        const s = window.__match!.state();
        s.ball.vel = { x: 0, y: 0.1, z: 0 };
      });
    }
    await ticks(y > 0.2 ? 2 : 120);
    await page.screenshot({ path: `screenshots/feedback-${name}.png` });
  }
});

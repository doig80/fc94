import { test, type Page } from "@playwright/test";

/**
 * Screenshots of the match for PR review: `pnpm screenshots:match`. CI uploads them with the look-test
 * screenshots and links them from the PR.
 */
const SCENES: { name: string; query: string; views: [string, number, number, number][] }[] = [
  {
    name: "day",
    query: "time=day",
    views: [
      ["centre", 0, 0.11, 0],
      ["near-corner", -18, 0.11, -11],
      ["far-goal", 17, 0.11, 2],
      ["ball-in-air", 10, 2.2, 0],
    ],
  },
  { name: "night-rain", query: "time=night&weather=rain", views: [["centre", 0, 0.11, 0]] },
];

for (const scene of SCENES) {
  test(`match screenshots: ${scene.name}`, async ({ page }) => {
    test.setTimeout(600_000);
    // cpu=0: the computer players stand still, so every run frames the same picture.
    await page.goto(`./?${scene.query}&renderer=webgl&quality=high&cpu=0`);
    await page.waitForFunction(() => window.__match?.ready === true, null, { timeout: 120_000 });
    await page.keyboard.press("KeyH"); // hide the controls help
    for (const [view, x, y, z] of scene.views) {
      await placeBall(page, x, y, z);
      // Let the camera settle; a ball in the air is held there for the picture.
      await ticks(page, y > 0.2 ? 2 : 120);
      await page.screenshot({ path: `screenshots/match-${scene.name}-${view}.png` });
    }
  });
}

function ticks(page: Page, n: number): Promise<void> {
  return page.evaluate(
    (count) =>
      new Promise<void>((done) => {
        const target = window.__match!.state().tick + count;
        const check = () => (window.__match!.state().tick >= target ? done() : requestAnimationFrame(check));
        check();
      }),
    n,
  );
}

function placeBall(page: Page, x: number, y: number, z: number): Promise<void> {
  return page.evaluate(
    ([bx, by, bz]) => {
      const s = window.__match!.state();
      s.phase = { kind: "play" };
      s.ball.owner = -1;
      s.ball.pos = { x: bx, y: by, z: bz };
      s.ball.vel = { x: 0, y: by > 0.2 ? 0.1 : 0, z: 0 };
      s.ball.spin = { x: 0, y: 0, z: 0 };
      // Move players out of the way so nobody picks the ball up.
      s.players.forEach((p, i) => (p.pos = { x: -16 + i * 3.4, z: 11 }));
    },
    [x, y, z],
  );
}

import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    /** The test's pretend pad: its buttons and stick are set from the test. */
    __pad?: { axes: number[]; buttons: { pressed: boolean; touched: boolean; value: number }[] };
  }
}

test("a pad plays: A kicks off, the stick runs, Start pauses, and the help shows pad buttons", async ({
  page,
}) => {
  test.setTimeout(180_000);
  // A standard pad, plugged in before the game starts (browsers report pads through getGamepads()).
  await page.addInitScript(() => {
    const pad = {
      id: "Test pad (STANDARD GAMEPAD)",
      index: 0,
      connected: true,
      mapping: "standard",
      timestamp: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    window.__pad = pad;
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
  });
  await page.goto("./?renderer=webgl&quality=low&cpu=0");
  await page.waitForFunction(() => window.__match?.ready === true, null, { timeout: 60_000 });
  const press = (button: number, down: boolean) =>
    page.evaluate(
      ([b, d]) => {
        const btn = window.__pad!.buttons[b as number];
        btn.pressed = d as boolean;
        btn.value = d ? 1 : 0;
      },
      [button, down] as const,
    );
  const ticks = (n: number) =>
    page.evaluate(
      (k) =>
        new Promise<void>((done) => {
          const t0 = window.__match!.state().tick;
          const check = () =>
            window.__match!.state().tick >= t0 + k ? done() : requestAnimationFrame(check);
          check();
        }),
      n,
    );

  await expect(page.locator(".controls-help")).toContainText("Left stick");

  // A (button 0) takes the kick-off, after the referee's whistle: a pass.
  await page.waitForFunction(() => window.__match!.state().lastEvent?.kind === "kickoff");
  await press(0, true);
  await page.waitForFunction(() => window.__match!.state().phase.kind === "play");
  await press(0, false);

  // The stick runs the controlled player.
  const before = await page.evaluate(() => {
    const s = window.__match!.state();
    return { me: s.controllers[0].player, pos: { ...s.players[s.controllers[0].player].pos } };
  });
  await page.evaluate(() => (window.__pad!.axes[0] = 1));
  await ticks(45);
  await page.evaluate(() => (window.__pad!.axes[0] = 0));
  const after = await page.evaluate((i) => window.__match!.state().players[i].pos, before.me);
  expect(Math.hypot(after.x - before.pos.x, after.z - before.pos.z)).toBeGreaterThan(1);

  // Start (button 9) pauses and resumes.
  await press(9, true);
  await page.waitForFunction(() => window.__match!.mode() === "paused");
  await press(9, false);
  // The game reads the pad once a frame: let it see the button come up before pressing again.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await press(9, true);
  await page.waitForFunction(() => window.__match!.mode() === "live");
  await press(9, false);
});

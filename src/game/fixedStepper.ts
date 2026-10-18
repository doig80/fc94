/**
 * Runs the simulation at a fixed rate regardless of the screen's frame rate.
 * Rendering then blends the last two states by `alpha` for smooth motion (docs/specs/01 §3).
 */
export class FixedStepper {
  private accumulator = 0;

  /**
   * @param stepSeconds simulation tick length
   * @param maxStepsPerFrame cap so a slow frame (or a backgrounded tab) can't trigger a catch-up spiral
   */
  constructor(
    private readonly stepSeconds: number,
    private readonly maxStepsPerFrame = 5,
  ) {}

  /** Add elapsed real time and run as many whole ticks as fit. Returns the blend factor 0..1 for rendering. */
  advance(elapsedSeconds: number, tick: () => void): number {
    this.accumulator += Math.max(0, elapsedSeconds);
    let steps = 0;
    while (this.accumulator >= this.stepSeconds && steps < this.maxStepsPerFrame) {
      tick();
      this.accumulator -= this.stepSeconds;
      steps++;
    }
    if (steps === this.maxStepsPerFrame && this.accumulator >= this.stepSeconds) {
      // Too far behind: drop the backlog instead of fast-forwarding.
      this.accumulator = 0;
    }
    return this.accumulator / this.stepSeconds;
  }
}

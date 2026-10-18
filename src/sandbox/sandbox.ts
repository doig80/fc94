import { FixedStepper } from "../game/fixedStepper";
import {
  createMatch,
  DEFAULT_PARAMS,
  DT,
  idleIntents,
  isInGoal,
  kickBall,
  PITCH_5_A_SIDE,
  step,
  type MatchState,
  type Weather,
} from "../sim";

/**
 * Physics sandbox (`?mode=physics`): a top-down debug view of the simulation, to feel the ball and
 * player physics before the real controls and 3D view exist. These kicks are stand-ins, not the
 * final control scheme (docs/specs/10 §3).
 */
const CONTROLLED = 4; // team 0's forward

declare global {
  interface Window {
    __sandbox?: { tick: () => number; state: () => MatchState };
  }
}

export function startSandbox(): void {
  document.getElementById("game")?.remove();
  document.getElementById("panel")?.remove();
  const canvas = document.createElement("canvas");
  canvas.id = "sandbox";
  canvas.setAttribute("aria-label", "Top-down physics sandbox");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    background: "#0b0e14",
  });
  document.body.append(canvas);
  const help = document.createElement("div");
  help.className = "sandbox-help";
  help.innerHTML = `<strong>Physics sandbox</strong> — debug view, not the real game<br>
    <kbd>W A S D</kbd> run · <kbd>Space</kbd> sprint · <kbd>J</kbd> pass · hold <kbd>K</kbd> shoot (steer while
    releasing to curl) · <kbd>L</kbd> lob<br><kbd>R</kbd> reset · <kbd>1</kbd> clear <kbd>2</kbd> rain <kbd>3</kbd> snow`;
  document.body.append(help);
  const ctx = canvas.getContext("2d")!;

  let state = newState("clear");
  let goalFlash = 0;
  const keys = new Set<string>();
  let shootHeld = -1;

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === "KeyR") state = newState(state.weather);
    if (e.code === "Digit1") state.weather = "clear";
    if (e.code === "Digit2") state.weather = "rain";
    if (e.code === "Digit3") state.weather = "snow";
    if (e.code === "KeyK") shootHeld = state.tick;
    if (e.code === "KeyJ") kick("pass");
    if (e.code === "KeyL") kick("lob");
    if (e.code === "Space") e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    keys.delete(e.code);
    if (e.code === "KeyK" && shootHeld >= 0) {
      kick("shoot", Math.min(1, (state.tick - shootHeld) * DT));
      shootHeld = -1;
    }
  });

  function moveInput(): { x: number; z: number } {
    return {
      x: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
      z: (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0),
    };
  }

  function kick(kind: "pass" | "shoot" | "lob", power = 0): void {
    if (state.ball.owner !== CONTROLLED) return;
    const f = state.players[CONTROLLED].facing;
    const m = moveInput();
    if (kind === "pass") kickBall(state, CONTROLLED, { x: f.x * 13, y: 0, z: f.z * 13 });
    if (kind === "lob") kickBall(state, CONTROLLED, { x: f.x * 13, y: 8, z: f.z * 13 });
    if (kind === "shoot") {
      const speed = 16 + 14 * power;
      // Steering sideways at release curls the ball towards that side.
      const curl = f.x * m.z - f.z * m.x;
      kickBall(
        state,
        CONTROLLED,
        { x: f.x * speed, y: 1.5 + 3 * power, z: f.z * speed },
        { x: 0, y: -curl * 14, z: 0 },
      );
    }
  }

  const stepper = new FixedStepper(DT);
  const intents = idleIntents(state.players.length);
  let last = performance.now();
  window.__sandbox = { tick: () => state.tick, state: () => state };

  function frame(now: number): void {
    stepper.advance((now - last) / 1000, () => {
      const m = moveInput();
      intents[CONTROLLED].moveX = m.x;
      intents[CONTROLLED].moveZ = m.z;
      intents[CONTROLLED].sprint = keys.has("Space");
      step(state, intents, DEFAULT_PARAMS);
      if (goalFlash === 0 && isInGoal(state.ball, state.pitch, DEFAULT_PARAMS.ball.radius) !== 0)
        goalFlash = 90;
      if (goalFlash > 0 && --goalFlash === 0) state = newState(state.weather);
    });
    last = now;
    draw(ctx, canvas, state, shootHeld >= 0 ? Math.min(1, (state.tick - shootHeld) * DT) : -1, goalFlash > 0);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function newState(weather: Weather): MatchState {
  const s = createMatch({ seed: 1, pitch: PITCH_5_A_SIDE, teamSize: 5, weather });
  // Start with the ball at the controlled player's feet.
  s.ball.pos.x = s.players[CONTROLLED].pos.x + 0.5;
  return s;
}

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  s: MatchState,
  power: number,
  goal: boolean,
): void {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const p = s.pitch;
  const scale = Math.min((w - 40) / (p.length + 6), (h - 140) / (p.width + 6));
  const ox = w / 2;
  const oy = 110 + (h - 110) / 2;
  const X = (x: number) => ox + x * scale;
  const Z = (z: number) => oy + z * scale;

  // Pitch and markings.
  const grass = s.weather === "snow" ? "#9fb3a2" : s.weather === "rain" ? "#2f6b33" : "#3f8f3a";
  ctx.fillStyle = grass;
  ctx.fillRect(X(-p.length / 2 - 3), Z(-p.width / 2 - 3), (p.length + 6) * scale, (p.width + 6) * scale);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.lineWidth = 2;
  ctx.strokeRect(X(-p.length / 2), Z(-p.width / 2), p.length * scale, p.width * scale);
  ctx.beginPath();
  ctx.moveTo(X(0), Z(-p.width / 2));
  ctx.lineTo(X(0), Z(p.width / 2));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(X(0), Z(0), 3 * scale, 0, Math.PI * 2);
  ctx.stroke();
  for (const side of [-1, 1]) {
    const gx = (side * p.length) / 2;
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(
      Math.min(X(gx), X(gx + side * p.goalDepth)),
      Z(-p.goalWidth / 2),
      p.goalDepth * scale,
      p.goalWidth * scale,
    );
    ctx.fillStyle = "#fff";
    for (const z of [-p.goalWidth / 2, p.goalWidth / 2]) {
      ctx.beginPath();
      ctx.arc(X(gx), Z(z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Players.
  s.players.forEach((pl, i) => {
    ctx.fillStyle =
      pl.team === 0 ? (pl.role === "gk" ? "#ffd23f" : "#d7263d") : pl.role === "gk" ? "#2bb24c" : "#1b4fd8";
    ctx.beginPath();
    ctx.arc(X(pl.pos.x), Z(pl.pos.z), DEFAULT_PARAMS.player.radius * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#111";
    ctx.beginPath();
    ctx.moveTo(X(pl.pos.x), Z(pl.pos.z));
    ctx.lineTo(X(pl.pos.x + pl.facing.x * 0.7), Z(pl.pos.z + pl.facing.z * 0.7));
    ctx.stroke();
    if (i === CONTROLLED) {
      ctx.strokeStyle = "#ffd23f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(X(pl.pos.x), Z(pl.pos.z), DEFAULT_PARAMS.player.radius * scale + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
    }
  });

  // Ball: shadow on the ground, ball raised by its height (a fake 3/4 view).
  const b = s.ball;
  const r = Math.max(4, 0.18 * scale);
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(X(b.pos.x), Z(b.pos.z), r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#111";
  ctx.beginPath();
  ctx.arc(
    X(b.pos.x),
    Z(b.pos.z) - (b.pos.y - DEFAULT_PARAMS.ball.radius) * scale,
    r * (1 + b.pos.y * 0.08),
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.stroke();

  // Read-outs.
  const pl = s.players[CONTROLLED];
  const speed = Math.sqrt(b.vel.x * b.vel.x + b.vel.y * b.vel.y + b.vel.z * b.vel.z);
  ctx.fillStyle = "#f2f4f8";
  ctx.font = "13px system-ui, sans-serif";
  ctx.fillText(
    `ball ${speed.toFixed(1)} m/s · height ${b.pos.y.toFixed(2)} m · weather ${s.weather} · stamina`,
    20,
    oy - (p.width / 2 + 3) * scale - 14,
  );
  const barX =
    20 +
    ctx.measureText(
      `ball ${speed.toFixed(1)} m/s · height ${b.pos.y.toFixed(2)} m · weather ${s.weather} · stamina`,
    ).width +
    8;
  const barY = oy - (p.width / 2 + 3) * scale - 24;
  ctx.fillStyle = "rgba(255,255,255,0.2)";
  ctx.fillRect(barX, barY, 80, 10);
  ctx.fillStyle = pl.stamina > 0.3 ? "#2bb24c" : "#d7263d";
  ctx.fillRect(barX, barY, 80 * pl.stamina, 10);
  if (power >= 0) {
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.fillRect(barX + 100, barY, 80, 10);
    ctx.fillStyle = "#ffd23f";
    ctx.fillRect(barX + 100, barY, 80 * power, 10);
  }
  if (goal) {
    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold 64px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("GOAL!", w / 2, oy);
    ctx.textAlign = "start";
  }
}

import type { Intent } from "../intent";
import { skill, type SimParams } from "../params";
import type { MatchState, PlayerState } from "../state";
import { clamp } from "../vec";

/**
 * Move every player towards what their intent asks for, then separate overlapping players. Sent-off players
 * stay where they are, off the pitch.
 */
export function stepPlayers(
  state: MatchState,
  intents: readonly Intent[],
  params: SimParams,
  dt: number,
): void {
  const p = params.player;
  state.players.forEach((pl, i) => {
    if (pl.sentOff) return;
    const intent = intents[i];
    let mx = intent ? clamp(intent.moveX, -1, 1) : 0;
    let mz = intent ? clamp(intent.moveZ, -1, 1) : 0;
    const mag = Math.sqrt(mx * mx + mz * mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }
    // Busy players (sliding, getting up, heading) don't follow the stick.
    const act = pl.action.kind;
    const busy =
      act === "slide" ||
      act === "recover" ||
      act === "stumble" ||
      act === "header" ||
      act === "bicycle" ||
      act === "volley" ||
      act === "dive";
    if (busy) mx = mz = 0;
    const moving = mag > 0.05 && !busy;

    const wantsSprint = !!intent?.sprint && moving;
    const sprinting = wantsSprint && pl.stamina >= p.minSprintStamina;
    pl.stamina = clamp(pl.stamina + (sprinting ? -p.staminaDrain : p.staminaRecovery) * dt, 0, 1);

    let top = sprinting ? p.sprintSpeed : p.runSpeed;
    if (state.ball.owner === i) top *= p.dribbleSpeedFactor;
    if (act === "tackle") top *= 0.5;
    if (act === "slide" || act === "dive") {
      // A slide or dive can't be steered: it carries on in its direction, slowing down.
      const k = pl.action.ticks / pl.action.total;
      const launch = act === "slide" ? params.action.slideSpeed : skill(params, pl.team).keeper.diveSpeed;
      pl.vel.x = pl.action.dir.x * launch * k;
      pl.vel.z = pl.action.dir.z * launch * k;
    } else {
      accelerate(pl, mx * top, mz * top, moving ? p.accel : p.decel, dt);
    }

    if (moving) turn(pl, mx, mz, p.turnRate * dt);

    pl.pos.x += pl.vel.x * dt;
    pl.pos.z += pl.vel.z * dt;
  });
  separate(state, params);
  keepInBounds(state, params);
}

/** Change velocity towards the target by at most `rate × dt`. */
function accelerate(pl: PlayerState, tx: number, tz: number, rate: number, dt: number): void {
  const dx = tx - pl.vel.x;
  const dz = tz - pl.vel.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  const max = rate * dt;
  if (d <= max) {
    pl.vel.x = tx;
    pl.vel.z = tz;
  } else {
    pl.vel.x += (dx / d) * max;
    pl.vel.z += (dz / d) * max;
  }
}

/** Turn the facing vector towards (dx, dz) by blending, then re-normalise (no trigonometry). */
function turn(pl: PlayerState, dx: number, dz: number, amount: number): void {
  const len = Math.sqrt(dx * dx + dz * dz);
  const k = amount < 1 ? amount : 1;
  let fx = pl.facing.x + (dx / len - pl.facing.x) * k;
  let fz = pl.facing.z + (dz / len - pl.facing.z) * k;
  const fl = Math.sqrt(fx * fx + fz * fz);
  if (fl < 1e-6) {
    // Exactly opposite: turn sideways first.
    fx = -pl.facing.z;
    fz = pl.facing.x;
  } else {
    fx /= fl;
    fz /= fl;
  }
  pl.facing.x = fx;
  pl.facing.z = fz;
}

/** Push overlapping players apart equally. Pairs are visited in index order, so the result is deterministic. */
function separate(state: MatchState, params: SimParams): void {
  const minDist = params.player.radius * 2;
  const players = state.players;
  for (let i = 0; i < players.length; i++) {
    if (players[i].sentOff) continue;
    for (let j = i + 1; j < players.length; j++) {
      if (players[j].sentOff) continue;
      const a = players[i].pos;
      const b = players[j].pos;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minDist * minDist) continue;
      const dist = Math.sqrt(distSq);
      // Same spot: separate along x, by index, so the result stays deterministic.
      const nx = dist > 1e-9 ? dx / dist : 1;
      const nz = dist > 1e-9 ? dz / dist : 0;
      const push = (minDist - dist) / 2;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
    }
  }
}

function keepInBounds(state: MatchState, params: SimParams): void {
  const mx = state.pitch.length / 2 + params.player.boundsMargin;
  const mz = state.pitch.width / 2 + params.player.boundsMargin;
  for (const pl of state.players) {
    if (pl.sentOff) continue;
    if (pl.pos.x < -mx || pl.pos.x > mx) {
      pl.pos.x = clamp(pl.pos.x, -mx, mx);
      pl.vel.x = 0;
    }
    if (pl.pos.z < -mz || pl.pos.z > mz) {
      pl.pos.z = clamp(pl.pos.z, -mz, mz);
      pl.vel.z = 0;
    }
  }
}

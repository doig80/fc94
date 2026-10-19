import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial } from "@babylonjs/core";
import { attackSign, offsideLine, type MatchEvent, type MatchState } from "../sim";
import type { PlayerRig, Signal } from "./players";

/** How long an official holds a signal after a call. */
const SIGNAL_SECONDS = 2.4;
/** The whistle comes first, for this long, before a foul is signalled. */
const WHISTLE_SECONDS = 0.35;
/** The referee stays about this far from the ball: close enough to see, out of the way. */
const REF_DISTANCE = 11;
const REF_SPEED = 7;
const ASSISTANT_SPEED = 6.5;
/** Run-cycle phase per metre, as for the players. */
const STRIDE = 2.6;
/** A sudden jump in where an official should be (a restart, a replay) is a cut, not a sprint. */
const TELEPORT = 35;

interface Official {
  rig: PlayerRig;
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Facing angle (radians, as `root.rotation.y`). */
  yaw: number;
  phase: number;
}

/**
 * The referee and his two assistants (docs/specs/10 §6, #47). Presentation only: worked out from the match state
 * each frame, so the simulation never knows they're there and the ball and players pass straight by.
 * - The referee follows play on a diagonal, a few metres from the ball and towards the middle, facing it, and
 *   signals his calls: the whistle, then pointing the way of a free kick, to the spot for a penalty, both arms
 *   forward for advantage, a card held up.
 * - Each assistant runs one touchline, level with the offside line in their half, and raises the flag for
 *   offside.
 * Hidden when there's no referee (`?ref=0`).
 */
export class Officials {
  private readonly ref: Official;
  private readonly assistants: Official[];
  private readonly card: Mesh;
  private readonly cardMat: StandardMaterial;
  private readonly flags: Mesh[];
  private first = true;

  constructor(scene: Scene, rigs: PlayerRig[]) {
    const make = (rig: PlayerRig, i: number): Official => ({
      rig,
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      yaw: 0,
      phase: i * 1.3,
    });
    this.ref = make(rigs[0], 0);
    this.assistants = [make(rigs[1], 1), make(rigs[2], 2)];

    this.cardMat = new StandardMaterial("refCardMat", scene);
    this.cardMat.disableLighting = true;
    // Larger than life (like the ball), so it reads from the camera.
    this.card = MeshBuilder.CreateBox("refCard", { width: 0.02, height: 0.26, depth: 0.18 }, scene);
    this.card.material = this.cardMat;
    this.card.parent = rigs[0].hand();
    this.card.position.y = -0.1;
    this.card.isPickable = false;
    this.card.setEnabled(false);

    const flagMat = new StandardMaterial("flagMat", scene);
    flagMat.disableLighting = true;
    flagMat.emissiveColor = Color3.FromHexString("#ffb400");
    this.flags = this.assistants.map((a, i) => {
      // The cloth hangs off the end of a short stick, beyond the hand.
      const flag = MeshBuilder.CreateBox(`flag${i}`, { width: 0.32, height: 0.24, depth: 0.015 }, scene);
      flag.material = flagMat;
      flag.parent = a.rig.hand();
      flag.position.set(0.12, -0.42, 0);
      flag.isPickable = false;
      return flag;
    });
  }

  /** Move and pose the officials for this frame; `dt` is seconds since the last frame (0 while paused). */
  update(state: MatchState, ballX: number, ballZ: number, dt: number): void {
    const on = state.rules !== null && state.rules.fouls;
    for (const f of this.flags) f.setEnabled(on);
    this.card.setEnabled(false);
    if (!on) {
      // No referee: out of sight (the body parts are drawn in a batch, so they're moved, not switched off).
      for (const o of [this.ref, ...this.assistants]) o.rig.root.position.y = -50;
      this.first = true;
      return;
    }
    const halfL = state.pitch.length / 2;
    const halfW = state.pitch.width / 2;

    // Referee: on the diagonal, nearer halfway and the middle than the ball.
    const toward = ballX > 0 ? -1 : 1;
    const side = ballZ > 0 ? -1 : 1;
    const refX = clamp(ballX + toward * REF_DISTANCE * 0.55, halfL - 4);
    const refZ = clamp(ballZ + side * REF_DISTANCE * 0.8, halfW - 3);
    this.move(this.ref, refX, refZ, REF_SPEED, dt, state);

    // Assistants: one per half, on opposite touchlines, level with the offside line (or the ball, nearer goal).
    this.assistants.forEach((a, k) => {
      const end = k === 0 ? 1 : -1;
      const attacker: 0 | 1 = attackSign(state, 0) === end ? 0 : 1;
      const line = state.shootout ? halfL * 0.5 : offsideLine(state, attacker);
      const x = end * Math.min(halfL - 1, Math.max(1, line));
      this.move(a, x, end * (halfW + 1.3), ASSISTANT_SPEED, dt, state);
      // Facing the pitch, running sideways.
      this.face(a, 0, -end, dt);
    });

    // The referee watches the ball, unless he's signalling a call.
    const call = this.call(state);
    const look = call?.look ?? { x: ballX, z: ballZ };
    this.face(this.ref, look.x - this.ref.x, look.z - this.ref.z, dt);
    if (call?.signal) this.ref.rig.signal(call.signal, call.time);
    // The assistant's flag goes up at once; the referee's whistle answers it.
    if (call?.flag !== undefined) this.assistants[call.flag].rig.signal("flag", call.since);
    if (call?.card) {
      this.cardMat.emissiveColor = Color3.FromHexString(call.card === "red" ? "#e0201b" : "#f5c400");
      this.card.setEnabled(true);
    }
    this.first = false;
  }

  /** Where each official stands (for the blob shadows on Low quality). */
  positions(): { x: number; z: number }[] {
    return [this.ref, ...this.assistants].map((o) => ({ x: o.x, z: o.z }));
  }

  private move(o: Official, tx: number, tz: number, top: number, dt: number, state: MatchState): void {
    const dx = tx - o.x;
    const dz = tz - o.z;
    const d = Math.hypot(dx, dz);
    if (this.first || d > TELEPORT) {
      o.x = tx;
      o.z = tz;
      o.vx = o.vz = 0;
    } else if (dt > 0) {
      // Ease towards the spot at up to `top`, slowing over the last few metres.
      const speed = Math.min(top, d * 1.2);
      const wantX = d > 0.05 ? (dx / d) * speed : 0;
      const wantZ = d > 0.05 ? (dz / d) * speed : 0;
      const k = Math.min(1, dt * 3);
      o.vx += (wantX - o.vx) * k;
      o.vz += (wantZ - o.vz) * k;
      // Step round players rather than through them.
      for (const p of state.players) {
        const px = o.x - p.pos.x;
        const pz = o.z - p.pos.z;
        const pd = Math.hypot(px, pz);
        if (pd > 0.01 && pd < 1.6 && !p.sentOff) {
          o.vx += (px / pd) * (1.6 - pd) * 40 * dt;
          o.vz += (pz / pd) * (1.6 - pd) * 40 * dt;
        }
      }
      o.x += o.vx * dt;
      o.z += o.vz * dt;
      o.phase += Math.hypot(o.vx, o.vz) * dt * STRIDE;
    }
    o.rig.root.position.set(o.x, 0, o.z);
    o.rig.pose(o.phase, Math.min(1, Math.hypot(o.vx, o.vz) / 8));
  }

  private face(o: Official, dx: number, dz: number, dt: number): void {
    if (Math.hypot(dx, dz) < 0.01) return;
    const want = Math.atan2(-dz, dx);
    let diff = want - o.yaw;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    o.yaw += this.first ? diff : diff * Math.min(1, dt * 8);
    o.rig.root.rotation.y = o.yaw;
  }

  /**
   * What the officials do about the latest call, while it's fresh: the whistle first (for a stoppage), then the
   * referee's signal and where he faces to make it; the assistant's flag for offside; a card held up.
   */
  private call(state: MatchState): {
    signal?: Signal;
    /** Seconds into the signal, and since the call. */
    time: number;
    since: number;
    look?: { x: number; z: number };
    flag?: number;
    card?: "yellow" | "red";
  } | null {
    const e = state.lastEvent;
    if (!e) return null;
    const since = (state.tick - e.tick) / 60;
    if (since >= SIGNAL_SECONDS) return null;
    const flag = e.kind === "offside" ? ((e.line ?? 0) >= 0 ? 0 : 1) : undefined;
    const whistle = e.kind !== "advantage" && e.kind !== "goal" && since < WHISTLE_SECONDS;
    if (whistle) return { signal: "whistle", time: since, since, flag };
    const time = since - (e.kind === "advantage" || e.kind === "goal" ? 0 : WHISTLE_SECONDS);
    if (e.card) {
      const p = state.players[e.card.player];
      return { signal: "card", time, since, look: p.pos, flag, card: e.card.red ? "red" : "yellow" };
    }
    const signal = signalFor(e.kind);
    if (!signal) return flag === undefined ? null : { time, since, flag };
    const spot = state.phase.kind === "restart" ? state.phase.restart.spot : null;
    // Point to the centre after a goal, at the spot for a penalty, corner or goal kick, otherwise the way the
    // team given the call is attacking.
    const look =
      e.kind === "goal"
        ? { x: 0, z: 0 }
        : (e.kind === "penalty" || e.kind === "corner" || e.kind === "goalkick") && spot
          ? spot
          : { x: this.ref.x + attackSign(state, e.team) * 10, z: this.ref.z };
    return { signal, time, since, look, flag };
  }
}

function signalFor(kind: MatchEvent["kind"]): Signal | null {
  switch (kind) {
    case "advantage":
      return "advantage";
    case "freekick":
    case "penalty":
    case "offside":
    case "kickin":
    case "corner":
    case "goalkick":
    case "goal":
      return "point";
    default:
      return null;
  }
}

function clamp(v: number, max: number): number {
  return v > max ? max : v < -max ? -max : v;
}

import { MechState, Obstacle } from '../types/game';
import { NetworkPlayerInput } from '../types/multiplayer';
import { ARENA_HEIGHT, ARENA_WIDTH } from './constants';

export interface PlayerSnapshot {
  seq: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  walkCycle: number;
  isDashing: boolean;
  dashDirX: number;
  dashDirY: number;
  time: number;
}

/**
 * RemotePlayerInterpolator
 *
 * Provides jitter-free, frame-rate independent client-side interpolation
 * for the remote multiplayer opponent:
 * - Stores recent server/client snapshots in a time-ordered buffer
 * - Interpolates position, rotation (shortest angular turn), and velocity
 * - Extrapolates gracefully during network packet jitter or temporary delays
 * - Prevents visual teleporting, rubber-banding, and micro-stuttering
 * - Keeps remote player strictly within arena bounds and out of obstacles
 */
export class RemotePlayerInterpolator {
  private snapshots: PlayerSnapshot[] = [];
  private maxSnapshots = 25;
  private interpolationDelayMs = 90; // Tuned for 20Hz (50ms interval) to ensure 1.8-2 ticks buffer headroom
  private lastReceivedSeq = -1;
  private lastPacketIntervals: number[] = [];
  private lastPacketTime = 0;
  private isInitialized = false;

  // Packet loss detection telemetry
  private packetsExpected = 0;
  private packetsReceived = 0;
  private packetsLost = 0;
  private lastLossDecayTime = 0;

  public reset() {
    this.snapshots = [];
    this.lastReceivedSeq = -1;
    this.lastPacketIntervals = [];
    this.lastPacketTime = 0;
    this.isInitialized = false;
    this.packetsExpected = 0;
    this.packetsReceived = 0;
    this.packetsLost = 0;
    this.lastLossDecayTime = 0;
  }

  public pushSnapshot(input: NetworkPlayerInput, targetMech?: MechState) {
    const now = performance.now();

    // Packet loss tracking based on sequence increments
    if (this.lastReceivedSeq > 0) {
      if (input.seq > this.lastReceivedSeq) {
        const gap = input.seq - this.lastReceivedSeq;
        this.packetsExpected += gap;
        this.packetsReceived += 1;
        if (gap > 1) {
          this.packetsLost += (gap - 1);
        }
      }
    } else {
      this.packetsExpected = 1;
      this.packetsReceived = 1;
    }

    // Decay loss window every 5 seconds to keep metric responsive
    if (now - this.lastLossDecayTime > 5000) {
      this.packetsExpected = Math.round(this.packetsExpected * 0.5);
      this.packetsLost = Math.round(this.packetsLost * 0.5);
      this.lastLossDecayTime = now;
    }

    // Track network packet jitter
    if (this.lastPacketTime > 0) {
      const interval = now - this.lastPacketTime;
      this.lastPacketIntervals.push(interval);
      if (this.lastPacketIntervals.length > 20) {
        this.lastPacketIntervals.shift();
      }
    }
    this.lastPacketTime = now;

    // Discard severely out-of-order packets (older by > 10 frames)
    if (this.lastReceivedSeq > 0 && input.seq < this.lastReceivedSeq - 10) {
      return;
    }
    if (input.seq > this.lastReceivedSeq) {
      this.lastReceivedSeq = input.seq;
    }

    const snapshotTime = now;

    const snapshot: PlayerSnapshot = {
      seq: input.seq,
      x: input.x,
      y: input.y,
      vx: input.vx,
      vy: input.vy,
      angle: input.angle,
      walkCycle: input.walkCycle,
      isDashing: Boolean(input.isDashing),
      dashDirX: input.dashDirX ?? Math.cos(input.angle),
      dashDirY: input.dashDirY ?? Math.sin(input.angle),
      time: snapshotTime,
    };

    // If first snapshot or massive position difference (e.g. round reset / teleport > 180 units)
    if (!this.isInitialized || (targetMech && Math.hypot(input.x - targetMech.x, input.y - targetMech.y) > 180)) {
      this.snapshots = [snapshot];
      this.isInitialized = true;
      if (targetMech) {
        targetMech.x = snapshot.x;
        targetMech.y = snapshot.y;
        targetMech.vx = snapshot.vx;
        targetMech.vy = snapshot.vy;
        targetMech.angle = snapshot.angle;
        targetMech.walkCycle = snapshot.walkCycle;
        targetMech.isDashing = snapshot.isDashing;
      }
      return;
    }

    // Insert snapshot into buffer in chronological order
    let insertIdx = this.snapshots.length;
    while (insertIdx > 0 && this.snapshots[insertIdx - 1].time > snapshot.time) {
      insertIdx--;
    }
    this.snapshots.splice(insertIdx, 0, snapshot);

    // Prune excess historical snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.splice(0, this.snapshots.length - this.maxSnapshots);
    }
  }

  public update(dt: number, remoteMech: MechState, obstacles: Obstacle[] = []) {
    if (this.snapshots.length === 0) return;

    if (this.snapshots.length === 1) {
      const single = this.snapshots[0];
      remoteMech.x = single.x;
      remoteMech.y = single.y;
      remoteMech.vx = single.vx;
      remoteMech.vy = single.vy;
      remoteMech.angle = single.angle;
      remoteMech.walkCycle = single.walkCycle;
      remoteMech.isDashing = single.isDashing;
      this.constrainBounds(remoteMech, obstacles);
      return;
    }

    const now = performance.now();
    // Adapt delay dynamically: minimum 80ms up to 130ms based on measured packet jitter (tuned for 20Hz / 50ms ticks)
    const jitter = this.getJitterMs();
    this.interpolationDelayMs = Math.max(80, Math.min(130, Math.round(jitter * 2 + 75)));
    const renderTime = now - this.interpolationDelayMs;

    // Find two snapshots s0 and s1 such that s0.time <= renderTime <= s1.time
    let s0: PlayerSnapshot | null = null;
    let s1: PlayerSnapshot | null = null;

    for (let i = 0; i < this.snapshots.length - 1; i++) {
      if (this.snapshots[i].time <= renderTime && this.snapshots[i + 1].time >= renderTime) {
        s0 = this.snapshots[i];
        s1 = this.snapshots[i + 1];
        // Prune older snapshots behind s0
        if (i > 0) {
          this.snapshots.splice(0, i);
        }
        break;
      }
    }

    if (s0 && s1) {
      // Normal Interpolation
      const span = s1.time - s0.time;
      const alpha = span > 0 ? Math.max(0, Math.min(1, (renderTime - s0.time) / span)) : 1;

      // Position
      remoteMech.x = s0.x + (s1.x - s0.x) * alpha;
      remoteMech.y = s0.y + (s1.y - s0.y) * alpha;

      // Velocity
      remoteMech.vx = s0.vx + (s1.vx - s0.vx) * alpha;
      remoteMech.vy = s0.vy + (s1.vy - s0.vy) * alpha;

      // Shortest angular turn interpolation
      let angleDiff = (s1.angle - s0.angle) % (Math.PI * 2);
      if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      remoteMech.angle = s0.angle + angleDiff * alpha;

      // Walk cycle & dashing
      remoteMech.walkCycle = s0.walkCycle + (s1.walkCycle - s0.walkCycle) * alpha;
      remoteMech.isDashing = alpha >= 0.5 ? s1.isDashing : s0.isDashing;
      if (remoteMech.isDashing) {
        remoteMech.dashDirX = alpha >= 0.5 ? s1.dashDirX : s0.dashDirX;
        remoteMech.dashDirY = alpha >= 0.5 ? s1.dashDirY : s0.dashDirY;
      }
    } else {
      // Buffer Starvation / High Jitter: renderTime is ahead of newest snapshot
      const latest = this.snapshots[this.snapshots.length - 1];
      const oldest = this.snapshots[0];

      if (renderTime > latest.time) {
        // Dead-reckon extrapolation up to 90ms with smooth damping to avoid overshooting
        const extraSec = Math.min(0.09, (renderTime - latest.time) / 1000);
        const damp = Math.max(0.4, 1 - (extraSec / 0.09) * 0.5);
        remoteMech.x = latest.x + latest.vx * damp * extraSec;
        remoteMech.y = latest.y + latest.vy * damp * extraSec;
        remoteMech.vx = latest.vx * damp;
        remoteMech.vy = latest.vy * damp;
        remoteMech.angle = latest.angle;
        if (Math.hypot(latest.vx, latest.vy) > 10) {
          remoteMech.walkCycle += dt * 14;
        }
        remoteMech.isDashing = latest.isDashing;
      } else {
        // renderTime is behind oldest snapshot (buffer just created)
        remoteMech.x = oldest.x;
        remoteMech.y = oldest.y;
        remoteMech.vx = oldest.vx;
        remoteMech.vy = oldest.vy;
        remoteMech.angle = oldest.angle;
        remoteMech.walkCycle = oldest.walkCycle;
        remoteMech.isDashing = oldest.isDashing;
      }
    }

    this.constrainBounds(remoteMech, obstacles);
  }

  private constrainBounds(mech: MechState, obstacles: Obstacle[]) {
    // 1. Resolve obstacles
    for (const obs of obstacles) {
      const closestX = Math.max(obs.x, Math.min(mech.x, obs.x + obs.width));
      const closestY = Math.max(obs.y, Math.min(mech.y, obs.y + obs.height));
      const dx = mech.x - closestX;
      const dy = mech.y - closestY;
      const dist = Math.hypot(dx, dy);

      if (dist < mech.radius && dist > 0.0001) {
        const overlap = mech.radius - dist;
        mech.x += (dx / dist) * overlap;
        mech.y += (dy / dist) * overlap;
      }
    }

    // 2. Arena boundaries
    const r = mech.radius;
    mech.x = Math.max(r + 10, Math.min(ARENA_WIDTH - r - 10, mech.x));
    mech.y = Math.max(r + 10, Math.min(ARENA_HEIGHT - r - 10, mech.y));
  }

  public getBufferSize(): number {
    return this.snapshots.length;
  }

  public getJitterMs(): number {
    if (this.lastPacketIntervals.length < 2) return 0;
    const avg =
      this.lastPacketIntervals.reduce((a, b) => a + b, 0) /
      this.lastPacketIntervals.length;
    const variance =
      this.lastPacketIntervals.reduce((a, b) => a + Math.abs(b - avg), 0) /
      this.lastPacketIntervals.length;
    return Math.round(variance * 10) / 10;
  }

  public getPacketLossPct(): number {
    if (this.packetsExpected === 0) return 0;
    const loss = Math.round((this.packetsLost / this.packetsExpected) * 100);
    return Math.max(0, Math.min(100, loss));
  }
}

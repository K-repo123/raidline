import { MOVE } from "./config";
import type { AABB } from "./map";

export type MoveInput = {
  forward: number;
  right: number;
  jump: boolean;
  walk: boolean;
  crouch: boolean;
  onGround: boolean;
};

export function wishDirection(
  yaw: number,
  forward: number,
  right: number,
  out: { x: number; z: number },
): number {
  const s = Math.sin(yaw);
  const c = Math.cos(yaw);
  // Forward matches look dir (sin, 0, cos). Right matches Three.js camera +X
  // after lookAt: (-cos, 0, sin). The old +right*c / -right*s sign was inverted.
  out.x = forward * s - right * c;
  out.z = forward * c + right * s;
  const mag = Math.hypot(out.x, out.z);
  if (mag > 1e-6) {
    out.x /= mag;
    out.z /= mag;
  }
  return mag;
}

export function maxSpeed(input: MoveInput): number {
  if (input.crouch) return MOVE.crouch;
  if (input.walk) return MOVE.walk;
  return MOVE.run;
}

/** Source-style accelerate: counter-strafe dumps speed when wish opposes velocity. */
export function accelerate(
  vx: number,
  vz: number,
  wx: number,
  wz: number,
  wishSpeed: number,
  accel: number,
  dt: number,
): { vx: number; vz: number } {
  const current = vx * wx + vz * wz;
  const add = wishSpeed - current;
  if (add <= 0) return { vx, vz };
  const acc = Math.min(add, accel * dt * wishSpeed);
  return { vx: vx + wx * acc, vz: vz + wz * acc };
}

export function applyFriction(vx: number, vz: number, dt: number): { vx: number; vz: number } {
  const speed = Math.hypot(vx, vz);
  if (speed < 0.04) return { vx: 0, vz: 0 };
  const control = speed < MOVE.stopSpeed ? MOVE.stopSpeed : speed;
  const drop = control * MOVE.friction * dt;
  const ns = Math.max(speed - drop, 0);
  const scale = ns / speed;
  return { vx: vx * scale, vz: vz * scale };
}

export function stepMovement(
  vx: number,
  vz: number,
  vy: number,
  input: MoveInput,
  yaw: number,
  dt: number,
): { vx: number; vz: number; vy: number; jumped: boolean } {
  const wish = { x: 0, z: 0 };
  const wishMag = wishDirection(yaw, input.forward, input.right, wish);
  const speed = maxSpeed(input);
  let jumped = false;

  if (input.onGround) {
    ({ vx, vz } = applyFriction(vx, vz, dt));
    if (wishMag > 0) {
      const spd = Math.hypot(vx, vz);
      const along = spd > 1e-6 ? (vx * wish.x + vz * wish.z) / spd : 0;
      if (spd > 0.25 && along < -0.25) {
        vx *= 0.1;
        vz *= 0.1;
      }
      ({ vx, vz } = accelerate(vx, vz, wish.x, wish.z, speed, MOVE.accel, dt));
    }
    const horiz = Math.hypot(vx, vz);
    if (horiz > speed) {
      const s = speed / horiz;
      vx *= s;
      vz *= s;
    }
    if (input.jump) {
      vy = MOVE.jump;
      jumped = true;
    } else {
      vy = 0;
    }
  } else {
    vy -= MOVE.gravity * dt;
    if (wishMag > 0) {
      ({ vx, vz } = accelerate(vx, vz, wish.x, wish.z, speed * 0.22, MOVE.airAccel, dt));
    }
  }
  return { vx, vz, vy, jumped };
}

export function collideCircleBoxes(
  x: number,
  z: number,
  radius: number,
  boxes: AABB[],
): { x: number; z: number } {
  let px = x;
  let pz = z;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const minX = b.minX - radius;
    const maxX = b.maxX + radius;
    const minZ = b.minZ - radius;
    const maxZ = b.maxZ + radius;
    if (px <= minX || px >= maxX || pz <= minZ || pz >= maxZ) continue;
    const left = px - minX;
    const right = maxX - px;
    const down = pz - minZ;
    const up = maxZ - pz;
    const m = Math.min(left, right, down, up);
    if (m === left) px = minX;
    else if (m === right) px = maxX;
    else if (m === down) pz = minZ;
    else pz = maxZ;
  }
  return { x: px, z: pz };
}

export function segmentHitsBoxes(
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  boxes: AABB[],
): number {
  let best = 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dz = z1 - z0;
  for (let i = 0; i < boxes.length; i++) {
    const b = boxes[i];
    const t = aabbRay(x0, y0, z0, dx, dy, dz, b);
    if (t >= 0 && t < best) best = t;
  }
  return best;
}

function aabbRay(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  b: AABB,
): number {
  let tmin = 0;
  let tmax = 1;
  if (!slab(ox, dx, b.minX, b.maxX, tmin, tmax)) return -1;
  [tmin, tmax] = lastSlab;
  if (!slab(oy, dy, b.minY, b.maxY, tmin, tmax)) return -1;
  [tmin, tmax] = lastSlab;
  if (!slab(oz, dz, b.minZ, b.maxZ, tmin, tmax)) return -1;
  [tmin, tmax] = lastSlab;
  return tmin;
}

let lastSlab: [number, number] = [0, 1];

function slab(
  o: number,
  d: number,
  min: number,
  max: number,
  tmin: number,
  tmax: number,
): boolean {
  if (Math.abs(d) < 1e-9) {
    if (o < min || o > max) return false;
    lastSlab = [tmin, tmax];
    return true;
  }
  const inv = 1 / d;
  let t1 = (min - o) * inv;
  let t2 = (max - o) * inv;
  if (t1 > t2) {
    const tmp = t1;
    t1 = t2;
    t2 = tmp;
  }
  tmin = Math.max(tmin, t1);
  tmax = Math.min(tmax, t2);
  lastSlab = [tmin, tmax];
  return tmin <= tmax;
}

export function groundSpeed(vx: number, vz: number): number {
  return Math.hypot(vx, vz);
}

/** Rifle inaccuracy from speed — standing still is tight, walk is quiet/accurate. */
export function moveInaccuracy(speed: number, airborne: boolean, crouch: boolean, walk = false): number {
  if (airborne) return 0.048;
  if (walk && speed <= MOVE.walk + 0.15) return crouch ? 0.0006 : 0.0012;
  const runPenalty = Math.max(0, speed - 1.05) * 0.013;
  const crouchBonus = crouch ? 0.55 : 1;
  return runPenalty * crouchBonus;
}

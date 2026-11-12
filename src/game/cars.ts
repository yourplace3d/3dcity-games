/**
 * Cars: how they look (a few boxes), how they move (speed along the car, grip across it) and how
 * they bump into walls and each other. The player and the traffic drive the same car.
 */

import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import type { PathState } from './roads';
import type { World } from './world';

export type CarKind = 'sedan' | 'sport' | 'van' | 'police';
export type Driver = 'none' | 'ai' | 'cop' | 'player';

interface Spec {
  len: number;
  wid: number;
  body: number;
  top: number;
  acc: number;
}

export const SPECS: Record<CarKind, Spec> = {
  sedan: { len: 4.3, wid: 1.8, body: 0.75, top: 27, acc: 8 },
  sport: { len: 4.4, wid: 1.85, body: 0.6, top: 38, acc: 12 },
  van: { len: 5.3, wid: 2.05, body: 1.35, top: 22, acc: 6 },
  police: { len: 4.5, wid: 1.85, body: 0.75, top: 35, acc: 11 },
};

const PAINT = ['#c8362e', '#2f6fb5', '#e8e6df', '#2d2f33', '#e0a526', '#3f8f5a', '#8a8f96', '#7a3f8f', '#d9703a', '#5fa8b8'];
const box = new BoxGeometry(1, 1, 1);
const mats = new Map<string, MeshStandardMaterial>();
function mat(colour: string, emissive = false): MeshStandardMaterial {
  const k = colour + (emissive ? '!' : '');
  let m = mats.get(k);
  if (!m) {
    m = new MeshStandardMaterial({ color: colour, roughness: 0.55, metalness: 0.1, emissive: emissive ? colour : '#000', emissiveIntensity: emissive ? 1.4 : 0 });
    mats.set(k, m);
  }
  return m;
}

function part(colour: string, sx: number, sy: number, sz: number, x: number, y: number, z: number, emissive = false): Mesh {
  const m = new Mesh(box, mat(colour, emissive));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/** A car's mesh, nose along +x. */
function buildMesh(kind: CarKind, colour: string): { group: Group; lights: Mesh[] } {
  const s = SPECS[kind];
  const g = new Group();
  const lights: Mesh[] = [];
  const paint = kind === 'police' ? '#f2f2ee' : colour;
  g.add(part(paint, s.len, s.body, s.wid, 0, 0.35 + s.body / 2, 0));
  if (kind === 'van') {
    g.add(part('#20242b', 0.9, 0.5, s.wid * 0.92, s.len / 2 - 0.9, 0.35 + s.body + 0.02, 0));
  } else {
    const cab = kind === 'sport' ? 1.7 : 2.1;
    g.add(part('#20242b', cab, 0.55, s.wid * 0.86, -0.25, 0.35 + s.body + 0.27, 0));
    g.add(part(paint, cab - 0.7, 0.06, s.wid * 0.8, -0.25, 0.35 + s.body + 0.57, 0));
  }
  if (kind === 'police') {
    g.add(part('#1d3f8f', 1.5, s.body + 0.02, s.wid + 0.02, 0.1, 0.35 + s.body / 2, 0));
    const red = part('#ff2a2a', 0.3, 0.16, 0.6, -0.25, 0.35 + s.body + 0.68, -0.36, true);
    const blue = part('#2a6bff', 0.3, 0.16, 0.6, -0.25, 0.35 + s.body + 0.68, 0.36, true);
    red.material = (red.material as MeshStandardMaterial).clone();
    blue.material = (blue.material as MeshStandardMaterial).clone();
    lights.push(red, blue);
    g.add(red, blue);
  }
  if (kind === 'sport') g.add(part('#f5f5f0', s.len * 0.9, 0.02, 0.32, 0, 0.35 + s.body + 0.01, 0));
  for (const z of [-1, 1]) {
    g.add(part('#fff6c8', 0.08, 0.18, 0.4, s.len / 2, 0.35 + s.body * 0.6, z * (s.wid / 2 - 0.3), true));
    g.add(part('#c01818', 0.08, 0.18, 0.4, -s.len / 2, 0.35 + s.body * 0.6, z * (s.wid / 2 - 0.3), true));
    for (const x of [-1, 1]) g.add(part('#17181a', 0.7, 0.66, 0.26, x * (s.len / 2 - 0.85), 0.33, z * (s.wid / 2 - 0.05)));
  }
  return { group: g, lights };
}

export interface Controls {
  /** 1 full ahead … -1 brake, then reverse */
  throttle: number;
  /** 1 full left … -1 full right */
  steer: number;
  handbrake: boolean;
}

export class Car {
  x = 0;
  y = 0;
  th = 0;
  vx = 0;
  vy = 0;
  hp = 100;
  driver: Driver = 'none';
  path: PathState | null = null;
  readonly controls: Controls = { throttle: 0, steer: 0, handbrake: false };
  readonly spec: Spec;
  readonly mesh: Group;
  readonly lights: Mesh[];
  /** radius of the two circles the car collides as, and how far each sits from the middle */
  readonly r: number;
  readonly a: number;
  /** seconds the driver has wanted to move without moving, and seconds left of backing out */
  stuck = 0;
  backing = 0;
  /** seconds of ignoring what's ahead, to get out of a jam */
  pushy = 0;
  /** seconds a police car has sat far from you without moving */
  stale = 0;
  /** the hardest knock this step (m/s), for sounds, damage and the law */
  knock = 0;
  gone = false;

  constructor(readonly kind: CarKind, colour = PAINT[Math.floor(Math.random() * PAINT.length)]) {
    this.spec = SPECS[kind];
    const m = buildMesh(kind, colour);
    this.mesh = m.group;
    this.lights = m.lights;
    this.r = this.spec.wid / 2 + 0.05;
    this.a = this.spec.len / 2 - this.r;
  }

  get speed(): number {
    return Math.hypot(this.vx, this.vy);
  }

  /** Speed along the car: negative when rolling backwards. */
  get forward(): number {
    return this.vx * Math.cos(this.th) + this.vy * Math.sin(this.th);
  }

  get asleep(): boolean {
    return this.driver === 'none' && this.vx === 0 && this.vy === 0;
  }

  step(dt: number, world: World): void {
    const c = this.controls;
    const dead = this.hp <= 0;
    let fx = Math.cos(this.th);
    let fy = Math.sin(this.th);
    const v0 = this.vx * fx + this.vy * fy;
    // steering: the faster, the less the wheels turn (about 2 g sideways at most)
    const maxSteer = Math.min(0.55, Math.atan(57 / Math.max(1, v0 * v0)));
    this.th += ((v0 * Math.tan(c.steer * maxSteer)) / 2.6) * dt;
    fx = Math.cos(this.th);
    fy = Math.sin(this.th);
    let vf = this.vx * fx + this.vy * fy;
    let vl = this.vx * fy - this.vy * fx;
    const top = this.spec.top * (this.hp < 35 ? 0.7 : 1);
    if (c.throttle > 0 && !dead) {
      if (vf < top) vf += this.spec.acc * c.throttle * dt * (1 - 0.55 * Math.max(0, vf) / top);
    } else if (c.throttle < 0) {
      if (vf > 0.4) vf = Math.max(0, vf + 20 * c.throttle * dt);
      else if (!dead) vf = Math.max(-8, vf + 6 * c.throttle * dt);
    }
    const roll = (c.throttle === 0 || dead ? 2.2 : 0.4) + (c.handbrake ? 9 : 0);
    vf -= vf * 0.12 * dt;
    vf -= Math.sign(vf) * Math.min(Math.abs(vf), roll * dt);
    vl *= Math.exp(-(c.handbrake ? 1.8 : 7.5) * dt);
    if (Math.abs(vf) < 0.02 && Math.abs(vl) < 0.02) {
      vf = 0;
      vl = 0;
    }
    this.vx = fx * vf + fy * vl;
    this.vy = fy * vf - fx * vl;
    const x0 = this.x;
    const y0 = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // the water's edge is railed: you bounce off it instead of going in
    if (world.inWater(this.x, this.y)) {
      if (!world.inWater(x0, y0)) {
        this.x = x0;
        this.y = y0;
        this.hit(this.speed * 0.5);
        this.vx *= -0.3;
        this.vy *= -0.3;
      }
    }

    // walls: push the two circles out, then stand the car between them again
    const front = { x: this.x + fx * this.a, y: this.y + fy * this.a };
    const rear = { x: this.x - fx * this.a, y: this.y - fy * this.a };
    const hf = world.solids.push(front, this.r);
    const hr = world.solids.push(rear, this.r);
    if (hf || hr) {
      this.x = (front.x + rear.x) / 2;
      this.y = (front.y + rear.y) / 2;
      this.th = Math.atan2(front.y - rear.y, front.x - rear.x);
      for (const h of [hf, hr]) {
        if (!h) continue;
        const vn = this.vx * h.nx + this.vy * h.ny;
        if (vn < 0) {
          this.vx -= 1.15 * vn * h.nx;
          this.vy -= 1.15 * vn * h.ny;
          this.hit(-vn);
        }
      }
      this.vx *= 0.99;
      this.vy *= 0.99;
    }
    const edge = world.half - 4;
    if (Math.abs(this.x) > edge) {
      this.x = Math.sign(this.x) * edge;
      this.vx = 0;
    }
    if (Math.abs(this.y) > edge) {
      this.y = Math.sign(this.y) * edge;
      this.vy = 0;
    }
  }

  /** A knock of `dv` m/s: dents above a hard bump. */
  hit(dv: number): void {
    this.knock = Math.max(this.knock, dv);
    if (dv > 8) this.hp = Math.max(0, this.hp - (dv - 8) * 2);
  }

  place(world: World): void {
    this.mesh.position.set(this.x, world.groundY(this.x, this.y), -this.y);
    this.mesh.rotation.y = this.th;
  }
}

/** Two cars that overlap are pushed apart and trade speed along the line between them. */
export function collideCars(p: Car, q: Car): number {
  const reach = p.a + p.r + q.a + q.r;
  if (Math.abs(p.x - q.x) > reach || Math.abs(p.y - q.y) > reach) return 0;
  let impact = 0;
  for (const sp of [1, -1]) {
    for (const sq of [1, -1]) {
      const pfx = Math.cos(p.th);
      const pfy = Math.sin(p.th);
      const qfx = Math.cos(q.th);
      const qfy = Math.sin(q.th);
      const dx = q.x + qfx * q.a * sq - (p.x + pfx * p.a * sp);
      const dy = q.y + qfy * q.a * sq - (p.y + pfy * p.a * sp);
      const d = Math.hypot(dx, dy);
      const overlap = p.r + q.r - d;
      if (overlap <= 0 || d < 1e-6) continue;
      const nx = dx / d;
      const ny = dy / d;
      const h = overlap / 2;
      p.x -= nx * h;
      p.y -= ny * h;
      q.x += nx * h;
      q.y += ny * h;
      // a push at one end turns the car
      p.th += ((pfx * -ny - pfy * -nx) * h * sp * 0.35) / p.a;
      q.th += ((qfx * ny - qfy * nx) * h * sq * 0.35) / q.a;
      const rel = (q.vx - p.vx) * nx + (q.vy - p.vy) * ny;
      if (rel < 0) {
        const j = (-1.2 * rel) / 2;
        p.vx -= j * nx;
        p.vy -= j * ny;
        q.vx += j * nx;
        q.vy += j * ny;
        impact = Math.max(impact, -rel);
      }
    }
  }
  if (impact > 0) {
    p.hit(impact * 0.8);
    q.hit(impact * 0.8);
  }
  return impact;
}

import type { Vec2 } from '../core/vec';
import type { SurfaceLike } from './contact';

/**
 * Cuerpos rígidos en 2D. Cada cuerpo tiene forma, masa, centro de masa, ángulo θ y velocidad
 * angular ω. Se mueven de una de tres maneras:
 *
 * - **con eje**: giran en torno a un punto fijo (balancín, palanca, péndulo físico);
 * - **rodando** por una superficie, sin deslizar (una caja desliza sin roce);
 * - **libres**: caen girando, sin contacto.
 *
 * No hay choques entre cuerpos rígidos: los rastros no los necesitan y piden un motor de contactos
 * completo. Este módulo no toca el motor de partículas; avanza en el mismo paso fijo que él.
 */

export type BodyShape = 'rod' | 'disc' | 'ring' | 'box';

/** Masa puntual fija sobre una barra (una pesa en el balancín). */
export interface Load {
  id: string;
  /** posición a lo largo de la barra, desde su centro, m */
  s: number;
  mass: number;
  /** parte del escenario: no se mueve ni se borra */
  locked?: boolean;
}

export interface Pivot {
  /** punto fijo del mundo */
  at: Vec2;
  /** dónde está ese punto en el cuerpo (coordenadas del cuerpo, m) */
  local: Vec2;
  /** el jugador puede correr el eje a lo largo de la barra (la palanca) */
  movable?: boolean;
  /** tope del giro respecto de la horizontal, rad (el balancín toca el suelo) */
  limit?: number;
}

export interface Rolling {
  /** superficie por la que rueda */
  surface: string;
  /** distancia recorrida a lo largo de la superficie, desde su extremo alto, m */
  s: number;
  /** rapidez a lo largo de la superficie, m/s */
  v: number;
  /** instante en que llegó al extremo bajo (null si todavía rueda) */
  arrived: number | null;
}

export interface RigidBody {
  id: string;
  label: string;
  shape: BodyShape;
  /** largo (barra), radio (disco, aro) o ancho (caja), m */
  size: number;
  /** alto de la caja, m */
  size2?: number;
  /** masa propia (sin las cargas), kg */
  mass: number;
  pos: Vec2;
  vel: Vec2;
  /** ángulo del eje x del cuerpo respecto del x global, rad */
  angle: number;
  omega: number;
  loads: Load[];
  pivot?: Pivot;
  roll?: Rolling;
  /** parte del escenario: no se borra (sus cargas pueden ser editables) */
  locked?: boolean;
  /** se le pueden poner cargas con la herramienta Partícula (el balancín) */
  loadable?: boolean;
  /** barra sin masa que se dibuja como un hilo (el péndulo simple) */
  thread?: boolean;
}

/** Lo que el módulo necesita del mundo. */
export interface RigidWorld {
  bodies: RigidBody[];
  surfaces: readonly SurfaceLike[];
  gAt(p: Vec2): Vec2 | null;
}

const rot = (q: Vec2, th: number): Vec2 => {
  const c = Math.cos(th);
  const s = Math.sin(th);
  return { x: c * q.x - s * q.y, y: s * q.x + c * q.y };
};

/** Momento de inercia propio respecto del centro de masa, kg·m². */
export function ownInertia(b: Pick<RigidBody, 'shape' | 'size' | 'size2' | 'mass'>): number {
  const m = b.mass;
  switch (b.shape) {
    case 'rod':
      return (m * b.size * b.size) / 12;
    case 'disc':
      return (m * b.size * b.size) / 2;
    case 'ring':
      return m * b.size * b.size;
    case 'box': {
      const h = b.size2 ?? b.size;
      return (m * (b.size * b.size + h * h)) / 12;
    }
  }
}

/** I/(m R²): cuánto de la energía se va en girar al rodar (disco ½, aro 1, caja que desliza 0). */
export const rollFactor = (shape: BodyShape): number => (shape === 'disc' ? 0.5 : shape === 'ring' ? 1 : 0);

/** Masas puntuales del cuerpo en coordenadas del cuerpo: el propio centro y cada carga. */
function massPoints(b: RigidBody): { q: Vec2; m: number }[] {
  return [{ q: { x: 0, y: 0 }, m: b.mass }, ...b.loads.map((l) => ({ q: { x: l.s, y: 0 }, m: l.mass }))];
}

export const totalMass = (b: RigidBody): number => b.mass + b.loads.reduce((a, l) => a + l.mass, 0);

/** Punto del cuerpo en coordenadas del mundo. */
export const toWorld = (b: RigidBody, q: Vec2): Vec2 => {
  const r = rot(q, b.angle);
  return { x: b.pos.x + r.x, y: b.pos.y + r.y };
};

/** Centro de masa del conjunto (cuerpo y cargas), en el mundo. */
export function centerOfMass(b: RigidBody): Vec2 {
  const M = totalMass(b);
  let x = 0;
  let y = 0;
  for (const { q, m } of massPoints(b)) {
    const p = toWorld(b, q);
    x += m * p.x;
    y += m * p.y;
  }
  return M > 0 ? { x: x / M, y: y / M } : { ...b.pos };
}

/** Momento de inercia respecto del eje (o del centro de masa si no tiene), kg·m². */
export function inertiaAboutPivot(b: RigidBody): number {
  const c = b.pivot?.local ?? { x: 0, y: 0 };
  let I = ownInertia(b);
  for (const { q, m } of massPoints(b)) I += m * ((q.x - c.x) ** 2 + (q.y - c.y) ** 2);
  return I;
}

/** Torque de la gravedad respecto del eje (positivo: antihorario), N·m, con el cuerpo en el ángulo th. */
export function gravityTorque(b: RigidBody, world: RigidWorld, th = b.angle): number {
  if (!b.pivot) return 0;
  const at = b.pivot.at;
  let tau = 0;
  for (const { q, m } of massPoints(b)) {
    const r = rot({ x: q.x - b.pivot.local.x, y: q.y - b.pivot.local.y }, th);
    const g = world.gAt({ x: at.x + r.x, y: at.y + r.y });
    if (!g) continue;
    tau += r.x * m * g.y - r.y * m * g.x;
  }
  return tau;
}

/** Con eje: el centro del cuerpo queda donde lo dejan el eje y el ángulo. */
export function placeOnPivot(b: RigidBody): void {
  if (!b.pivot) return;
  const r = rot(b.pivot.local, b.angle);
  b.pos = { x: b.pivot.at.x - r.x, y: b.pivot.at.y - r.y };
  const w = b.omega;
  b.vel = { x: w * r.y, y: -w * r.x };
}

/** Geometría de una rodadura: punto de partida, dirección pendiente abajo, normal hacia fuera y largo útil. */
export function rollGeometry(b: RigidBody, world: RigidWorld): { start: Vec2; t: Vec2; n: Vec2; length: number; slope: number } | null {
  const surf = world.surfaces.find((s) => s.id === b.roll?.surface);
  if (!surf) return null;
  const mid = { x: (surf.a.x + surf.b.x) / 2, y: (surf.a.y + surf.b.y) / 2 };
  const g = world.gAt(mid) ?? { x: 0, y: 0 };
  let a = surf.a;
  let c = surf.b;
  let L = Math.hypot(c.x - a.x, c.y - a.y);
  if (L < 1e-9) return null;
  let t = { x: (c.x - a.x) / L, y: (c.y - a.y) / L };
  if (t.x * g.x + t.y * g.y < 0) {
    [a, c] = [c, a];
    t = { x: -t.x, y: -t.y };
  }
  let n = { x: -t.y, y: t.x };
  if (n.x * g.x + n.y * g.y > 0) n = { x: -n.x, y: -n.y };
  const R = b.shape === 'box' ? (b.size2 ?? b.size) / 2 : b.size;
  const reach = b.shape === 'box' ? b.size / 2 : R;
  L = Math.max(0, L - reach);
  return { start: { x: a.x + n.x * R + t.x * reach, y: a.y + n.y * R + t.y * reach }, t, n, length: L - reach, slope: t.x * g.x + t.y * g.y };
}

/** Rodando: posición, velocidad y ángulo a partir de lo recorrido. */
export function placeOnSurface(b: RigidBody, world: RigidWorld): void {
  const geo = rollGeometry(b, world);
  if (!geo || !b.roll) return;
  const { s, v } = b.roll;
  b.pos = { x: geo.start.x + geo.t.x * s, y: geo.start.y + geo.t.y * s };
  b.vel = { x: geo.t.x * v, y: geo.t.y * v };
  if (b.shape === 'box') {
    b.angle = Math.atan2(geo.t.y, geo.t.x);
    b.omega = 0;
  } else {
    // rodar sin deslizar: lo que avanza el centro es lo que gira el borde, ω = v / R
    const sign = geo.t.x * geo.n.y - geo.t.y * geo.n.x > 0 ? -1 : 1;
    b.omega = (sign * v) / b.size;
    b.angle = (sign * s) / b.size;
  }
}

/** Aceleración a lo largo de la superficie al rodar: a = g sen α / (1 + I/(m R²)). */
export function rollAcceleration(b: RigidBody, world: RigidWorld): number {
  const geo = rollGeometry(b, world);
  if (!geo) return 0;
  return geo.slope / (1 + rollFactor(b.shape));
}

/** Estado de un cuerpo que basta para volver a un instante. */
export interface BodyState {
  pos: Vec2;
  vel: Vec2;
  angle: number;
  omega: number;
  roll?: { s: number; v: number; arrived: number | null };
}

export const bodyState = (b: RigidBody): BodyState => ({
  pos: { ...b.pos },
  vel: { ...b.vel },
  angle: b.angle,
  omega: b.omega,
  ...(b.roll ? { roll: { s: b.roll.s, v: b.roll.v, arrived: b.roll.arrived } } : {}),
});

export function applyState(b: RigidBody, s: BodyState): void {
  b.pos = { ...s.pos };
  b.vel = { ...s.vel };
  b.angle = s.angle;
  b.omega = s.omega;
  if (b.roll && s.roll) b.roll = { ...b.roll, ...s.roll };
}

/**
 * Avanza todos los cuerpos un paso dt (RK4 en el ángulo para los que tienen eje, exacto para la
 * rodadura y la caída libre, que tienen aceleración constante en cada paso).
 */
export function stepBodies(world: RigidWorld, dt: number, t: number): void {
  for (const b of world.bodies) {
    if (b.pivot) stepPivot(b, world, dt);
    else if (b.roll) stepRoll(b, world, dt, t);
    else stepFree(b, world, dt);
  }
}

function stepPivot(b: RigidBody, world: RigidWorld, dt: number): void {
  const I = inertiaAboutPivot(b);
  if (I <= 0) return;
  const alpha = (th: number) => gravityTorque(b, world, th) / I;
  const th0 = b.angle;
  const w0 = b.omega;
  const k1t = w0;
  const k1w = alpha(th0);
  const k2t = w0 + (dt / 2) * k1w;
  const k2w = alpha(th0 + (dt / 2) * k1t);
  const k3t = w0 + (dt / 2) * k2w;
  const k3w = alpha(th0 + (dt / 2) * k2t);
  const k4t = w0 + dt * k3w;
  const k4w = alpha(th0 + dt * k3t);
  b.angle = th0 + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
  b.omega = w0 + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w);
  // tope: el balancín toca el suelo y se queda ahí
  const lim = b.pivot!.limit;
  if (lim !== undefined && Math.abs(b.angle) >= lim) {
    b.angle = Math.sign(b.angle) * lim;
    b.omega = 0;
  }
  placeOnPivot(b);
}

function stepRoll(b: RigidBody, world: RigidWorld, dt: number, t: number): void {
  const r = b.roll!;
  if (r.arrived !== null) return;
  const geo = rollGeometry(b, world);
  if (!geo) return;
  const a = geo.slope / (1 + rollFactor(b.shape));
  r.s += r.v * dt + 0.5 * a * dt * dt;
  r.v += a * dt;
  if (r.s >= geo.length) {
    r.s = geo.length;
    r.v = 0;
    r.arrived = t + dt;
  }
  placeOnSurface(b, world);
}

function stepFree(b: RigidBody, world: RigidWorld, dt: number): void {
  const g = world.gAt(b.pos) ?? { x: 0, y: 0 };
  b.pos = { x: b.pos.x + b.vel.x * dt + 0.5 * g.x * dt * dt, y: b.pos.y + b.vel.y * dt + 0.5 * g.y * dt * dt };
  b.vel = { x: b.vel.x + g.x * dt, y: b.vel.y + g.y * dt };
  b.angle += b.omega * dt;
}

/** Energía del cuerpo: cinética de traslación y de rotación, y potencial gravitatoria medida desde origin. */
export function bodyEnergy(b: RigidBody, g: Vec2 | null, origin: Vec2): { K: number; Ug: number } {
  const M = totalMass(b);
  let K: number;
  if (b.pivot) {
    K = 0.5 * inertiaAboutPivot(b) * b.omega * b.omega;
  } else {
    K = 0.5 * M * (b.vel.x * b.vel.x + b.vel.y * b.vel.y) + 0.5 * ownInertia(b) * b.omega * b.omega;
  }
  const c = centerOfMass(b);
  const Ug = g ? -M * (g.x * (c.x - origin.x) + g.y * (c.y - origin.y)) : 0;
  return { K, Ug };
}

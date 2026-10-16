// Vectores 2D. Todo el motor trabaja en metros y unidades SI, en coordenadas globales.

export interface Vec2 {
  x: number;
  y: number;
}

export const vec = (x = 0, y = 0): Vec2 => ({ x, y });
export const clone = (a: Vec2): Vec2 => ({ x: a.x, y: a.y });
export const add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec2, k: number): Vec2 => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec2, b: Vec2): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec2): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

export function norm(a: Vec2): Vec2 {
  const L = len(a);
  return L > 0 ? { x: a.x / L, y: a.y / L } : { x: 0, y: 0 };
}

/** Rota a en un ángulo θ (rad, antihorario). */
export function rotate(a: Vec2, th: number): Vec2 {
  const c = Math.cos(th);
  const s = Math.sin(th);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
}

/** Ángulo de a respecto al eje x, en grados, en (−180°, 180°]. */
export const angleDeg = (a: Vec2): number => (Math.atan2(a.y, a.x) * 180) / Math.PI;

/** Distancia de p al segmento ab. */
export function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const bx = b.x - a.x;
  const by = b.y - a.y;
  const L2 = bx * bx + by * by || 1;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * bx + (p.y - a.y) * by) / L2));
  return Math.hypot(a.x + u * bx - p.x, a.y + u * by - p.y);
}

/** Diferencia angular mínima |a − b| en rad, en [0, π]. */
export function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % (2 * Math.PI);
  if (d > Math.PI) d = 2 * Math.PI - d;
  return d;
}

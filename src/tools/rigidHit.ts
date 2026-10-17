import { segmentDistance, type Vec2 } from '../core/vec';
import { toWorld, type Load, type RigidBody } from '../physics/rigid';
import { particleRadiusPx } from '../render/scales';
import type { View } from '../render/view';
import type { World } from '../world/world';

// Búsqueda de cuerpos rígidos bajo el puntero, y la posición a lo largo de una barra.

/** Paso al que se ajustan las cargas y el eje sobre una barra, m. */
export const ROD_SNAP = 0.25;

/** Extremos de una barra en el mundo. */
export function rodEnds(b: RigidBody): [Vec2, Vec2] {
  return [toWorld(b, { x: -b.size / 2, y: 0 }), toWorld(b, { x: b.size / 2, y: 0 })];
}

/** Posición a lo largo de la barra (desde su centro) del punto más cercano a p, ajustada a ROD_SNAP. */
export function rodS(b: RigidBody, p: Vec2): number {
  const c = Math.cos(b.angle);
  const s = Math.sin(b.angle);
  const along = (p.x - b.pos.x) * c + (p.y - b.pos.y) * s;
  const half = b.size / 2;
  return Math.max(-half, Math.min(half, Math.round(along / ROD_SNAP) * ROD_SNAP));
}

export function hitBody(world: World, p: Vec2, tol: number): RigidBody | undefined {
  for (let i = world.bodies.length - 1; i >= 0; i--) {
    const b = world.bodies[i];
    if (b.shape === 'rod') {
      const [a, c] = rodEnds(b);
      if (segmentDistance(p, a, c) <= Math.max(tol, 0.15)) return b;
    } else if (b.shape === 'box') {
      const c = Math.cos(-b.angle);
      const s = Math.sin(-b.angle);
      const dx = p.x - b.pos.x;
      const dy = p.y - b.pos.y;
      const u = dx * c - dy * s;
      const v = dx * s + dy * c;
      if (Math.abs(u) <= b.size / 2 + tol && Math.abs(v) <= (b.size2 ?? b.size) / 2 + tol) return b;
    } else if (Math.hypot(p.x - b.pos.x, p.y - b.pos.y) <= b.size + tol) {
      return b;
    }
  }
  return undefined;
}

/** Carga bajo el puntero (las más pesadas se dibujan más grandes y se toman más fácil). */
export function hitLoad(world: World, view: View, p: Vec2, tol: number): { body: RigidBody; load: Load } | undefined {
  for (const b of world.bodies) {
    for (const l of b.loads) {
      const q = toWorld(b, { x: l.s, y: 0 });
      if (Math.hypot(p.x - q.x, p.y - q.y) <= Math.max(tol, view.m(particleRadiusPx(l.mass) + 4))) return { body: b, load: l };
    }
  }
  return undefined;
}

/** Eje que el jugador puede correr (la palanca). */
export function hitMovablePivot(world: World, p: Vec2, tol: number): RigidBody | undefined {
  return world.bodies.find((b) => b.pivot?.movable && Math.hypot(p.x - b.pivot.at.x, p.y - b.pivot.at.y) <= tol * 1.4);
}

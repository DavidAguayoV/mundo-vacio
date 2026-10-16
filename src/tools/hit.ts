import { dist, segmentDistance, type Vec2 } from '../core/vec';
import { HANDLE_DIST, VEL_SCALE, particleRadiusPx } from '../render/scales';
import type { View } from '../render/view';
import { surfaceCoords, surfaceFrame } from '../physics/contact';
import type { FreeVector, Particle, SpringLink, Surface, VectorSum, World } from '../world/world';

// Búsqueda de objetos bajo el puntero. Se recorre de atrás hacia adelante: gana lo dibujado encima.

export function hitParticle(world: World, view: View, p: Vec2, tol: number): Particle | undefined {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const q = world.particles[i];
    if (dist(q.pos, p) <= Math.max(tol, view.m(particleRadiusPx(q.mass) + 4))) return q;
  }
  return undefined;
}

/** Partícula cuya punta de flecha de velocidad está bajo el puntero. */
export function hitVelocityTip(world: World, p: Vec2, tol: number): Particle | undefined {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const q = world.particles[i];
    if (!q.vel.x && !q.vel.y) continue;
    const tip = { x: q.pos.x + q.vel.x * VEL_SCALE, y: q.pos.y + q.vel.y * VEL_SCALE };
    if (dist(tip, p) <= tol) return q;
  }
  return undefined;
}

export function hitVectorTip(world: World, p: Vec2, tol: number): FreeVector | undefined {
  for (let i = world.vectors.length - 1; i >= 0; i--) {
    if (dist(world.vectors[i].tip, p) <= tol) return world.vectors[i];
  }
  return undefined;
}

export function hitVectorBody(world: World, p: Vec2, tol: number): FreeVector | undefined {
  for (let i = world.vectors.length - 1; i >= 0; i--) {
    const v = world.vectors[i];
    if (segmentDistance(p, v.tail, v.tip) <= tol * 0.8) return v;
  }
  return undefined;
}

export function hitSum(world: World, p: Vec2, tol: number): VectorSum | undefined {
  for (let i = world.sums.length - 1; i >= 0; i--) {
    const geo = world.sumGeometry(world.sums[i]);
    if (geo && segmentDistance(p, geo.tail, geo.tip) <= tol * 0.8) return world.sums[i];
  }
  return undefined;
}

export function handlePos(world: World): Vec2 | null {
  const f = world.frame;
  if (!f) return null;
  const ex = f.ex;
  return { x: f.origin.x + HANDLE_DIST * ex.x, y: f.origin.y + HANDLE_DIST * ex.y };
}

/** Extremo de superficie bajo el puntero. */
export function hitSurfaceEnd(world: World, p: Vec2, tol: number): { s: Surface; end: 'a' | 'b' } | undefined {
  for (let i = world.surfaces.length - 1; i >= 0; i--) {
    const s = world.surfaces[i];
    if (dist(s.b, p) <= tol) return { s, end: 'b' };
    if (dist(s.a, p) <= tol) return { s, end: 'a' };
  }
  return undefined;
}

export function hitSurfaceBody(world: World, p: Vec2, tol: number): Surface | undefined {
  for (let i = world.surfaces.length - 1; i >= 0; i--) {
    const s = world.surfaces[i];
    if (segmentDistance(p, s.a, s.b) <= tol * 0.8) return s;
  }
  return undefined;
}

/**
 * Si p está a menos de tol de alguna superficie (dentro del segmento), lo lleva exactamente sobre ella:
 * así una partícula soltada cerca de una superficie queda apoyada al lanzar.
 */
export function snapToSurface(world: World, p: Vec2, tol: number): Vec2 {
  for (const s of world.surfaces) {
    const f = surfaceFrame(s);
    const { d, u } = surfaceCoords(s, f, p);
    if (Math.abs(d) <= tol && u >= 0 && u <= f.length) return { x: s.a.x + u * f.t.x, y: s.a.y + u * f.t.y };
  }
  return p;
}

/** Punto fijo de un resorte bajo el puntero. */
export function hitSpringAnchor(world: World, p: Vec2, tol: number): { sp: SpringLink; end: 'a' | 'b' } | undefined {
  for (let i = world.springs.length - 1; i >= 0; i--) {
    const sp = world.springs[i];
    if ('anchor' in sp.b && dist(sp.b.anchor, p) <= tol) return { sp, end: 'b' };
    if ('anchor' in sp.a && dist(sp.a.anchor, p) <= tol) return { sp, end: 'a' };
  }
  return undefined;
}

export function hitSpring(world: World, p: Vec2, tol: number): SpringLink | undefined {
  for (let i = world.springs.length - 1; i >= 0; i--) {
    const sp = world.springs[i];
    const a = world.endPos(sp.a);
    const b = world.endPos(sp.b);
    if (a && b && segmentDistance(p, a, b) <= tol) return sp;
  }
  return undefined;
}

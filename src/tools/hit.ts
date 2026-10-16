import { dist, segmentDistance, type Vec2 } from '../core/vec';
import { HANDLE_DIST, VEL_SCALE, particleRadiusPx } from '../render/scales';
import type { View } from '../render/view';
import type { FreeVector, Particle, VectorSum, World } from '../world/world';

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

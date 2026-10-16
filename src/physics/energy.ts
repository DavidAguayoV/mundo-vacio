import type { Vec2 } from '../core/vec';
import { SOFTENING } from './forces/gravitation';
import type { SpringLike } from './forces/springs';
import type { Endpoint } from './forces/force';

/** Energías del sistema completo, en J. */
export interface EnergyBreakdown {
  /** cinética, Σ ½ m v² */
  K: number;
  /** potencial gravitatoria del campo uniforme, Σ m g h (h medida a lo largo de −g desde el origen) */
  Ug: number;
  /** elástica de los resortes, Σ ½ k ΔL² */
  Ue: number;
  /** potencial de la atracción entre masas, Σ_{i<j} −G mᵢ mⱼ / √(r² + ε²) */
  UG: number;
  total: number;
}

export interface EnergyWorld {
  particles: readonly { id: string; pos: Vec2; vel: Vec2; mass: number }[];
  g: Vec2 | null;
  springs: readonly SpringLike[];
  gravitation: { G: number } | null;
}

/**
 * Energía mecánica del sistema. La potencial gravitatoria se mide desde `origin`
 * (el origen del jugador): el cero es una elección, y moverlo cambia Ug en una constante.
 * La potencial entre masas usa el mismo suavizado que la fuerza, para que sean consistentes.
 */
export function systemEnergy(w: EnergyWorld, origin: Vec2 = { x: 0, y: 0 }): EnergyBreakdown {
  let K = 0;
  let Ug = 0;
  for (const p of w.particles) {
    K += 0.5 * p.mass * (p.vel.x * p.vel.x + p.vel.y * p.vel.y);
    // h·|g| = −g · (r − O): m g h sin depender de hacia dónde apunte g
    if (w.g) Ug -= p.mass * (w.g.x * (p.pos.x - origin.x) + w.g.y * (p.pos.y - origin.y));
  }

  const byId = new Map(w.particles.map((p) => [p.id, p]));
  const at = (e: Endpoint): Vec2 | null => ('anchor' in e ? e.anchor : (byId.get(e.particle)?.pos ?? null));
  let Ue = 0;
  for (const s of w.springs) {
    const a = at(s.a);
    const b = at(s.b);
    if (!a || !b) continue;
    const dL = Math.hypot(b.x - a.x, b.y - a.y) - s.restLength;
    Ue += 0.5 * s.k * dL * dL;
  }

  let UG = 0;
  if (w.gravitation) {
    const eps2 = SOFTENING * SOFTENING;
    const ps = w.particles;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const dx = ps[j].pos.x - ps[i].pos.x;
        const dy = ps[j].pos.y - ps[i].pos.y;
        UG -= (w.gravitation.G * ps[i].mass * ps[j].mass) / Math.sqrt(dx * dx + dy * dy + eps2);
      }
    }
  }

  return { K, Ug, Ue, UG, total: K + Ug + Ue + UG };
}

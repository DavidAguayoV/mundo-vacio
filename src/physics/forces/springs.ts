import type { Vec2 } from '../../core/vec';
import type { SystemState } from '../state';
import { ZERO, type Endpoint, type Force } from './force';

/** Un resorte del mundo: dos extremos (partícula o punto fijo), constante k y largo natural. */
export interface SpringLike {
  id: string;
  a: Endpoint;
  b: Endpoint;
  /** constante del resorte, N/m */
  k: number;
  /** largo natural L₀, m */
  restLength: number;
  /** parte del escenario de un rastro (el resorte que marca el ritmo): no se cambia ni se borra */
  locked?: boolean;
}

/** Posición de un extremo en el estado s (null si la partícula ya no existe). */
export function endpointPos(e: Endpoint, s: SystemState): Vec2 | null {
  if ('anchor' in e) return e.anchor;
  const j = s.index.get(e.particle);
  return j === undefined ? null : s.pos[j];
}

/**
 * Fuerza de Hooke de todos los resortes del mundo sobre la partícula i:
 * F = −k (L − L₀) û, con û desde el otro extremo hacia la partícula.
 * Lee la lista de resortes en cada evaluación: agregar o quitar uno no requiere tocar el motor.
 */
export class SpringForces implements Force {
  readonly kind = 'spring' as const;

  constructor(private springs: () => readonly SpringLike[]) {}

  force(i: number, s: SystemState): Vec2 {
    const id = s.ids[i];
    let fx = 0;
    let fy = 0;
    for (const sp of this.springs()) {
      const isA = 'particle' in sp.a && sp.a.particle === id;
      const isB = 'particle' in sp.b && sp.b.particle === id;
      if (isA === isB) continue; // no la toca (o un resorte de una partícula consigo misma)
      const self = s.pos[i];
      const other = endpointPos(isA ? sp.b : sp.a, s);
      if (!other) continue;
      const dx = self.x - other.x;
      const dy = self.y - other.y;
      const L = Math.hypot(dx, dy);
      if (L === 0) continue;
      const mag = -sp.k * (L - sp.restLength);
      fx += (mag * dx) / L;
      fy += (mag * dy) / L;
    }
    return fx || fy ? { x: fx, y: fy } : ZERO;
  }

  toJSON(): null {
    return null;
  }
}

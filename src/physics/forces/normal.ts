import type { Vec2 } from '../../core/vec';
import type { ContactSet } from '../contact';
import type { SystemState } from '../state';
import { ZERO, type Force } from './force';

/**
 * Fuerza normal de una superficie rígida sobre una partícula apoyada:
 * cancela exactamente la componente de las demás fuerzas que empuja contra la superficie,
 * N = −(F·n) n si F·n < 0. Si las fuerzas la alejan de la superficie, N = 0 (la superficie no tira).
 */
export class NormalForce implements Force {
  readonly kind = 'normal' as const;
  readonly reaction = true;

  constructor(private contacts: ContactSet) {}

  force(i: number, s: SystemState, _w: unknown, applied: Vec2 = ZERO): Vec2 {
    const c = this.contacts.get(s.ids[i]);
    if (!c) return ZERO;
    const Fn = applied.x * c.n.x + applied.y * c.n.y;
    if (Fn >= 0) return ZERO;
    return { x: -Fn * c.n.x, y: -Fn * c.n.y };
  }

  toJSON(): null {
    return null;
  }
}

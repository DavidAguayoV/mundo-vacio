import type { Vec2 } from '../../core/vec';
import { contactTangent, type Contact, type ContactSet } from '../contact';
import type { SystemState } from '../state';
import { ZERO, type Force } from './force';

type Regime = { kind: 'estático' | 'cinético'; f: number } | null;

/**
 * Roce seco de Coulomb sobre una partícula apoyada (N = magnitud de la normal):
 * - si desliza: cinético, |f| = μc N, opuesto al deslizamiento;
 * - si no desliza: estático, cancela la componente tangencial de las demás fuerzas
 *   mientras no supere μₛ N; si la supera, empieza a deslizar y rige el cinético.
 * El sentido del deslizamiento lo fija la restricción de superficies al comienzo de cada paso.
 */
export class FrictionForce implements Force {
  readonly kind = 'friction' as const;
  readonly reaction = true;
  readonly dissipative = true;

  constructor(private contacts: ContactSet) {}

  /** Componente del roce a lo largo de la tangente del contacto. */
  private regime(c: Contact, applied: Vec2): Regime {
    const N = -(applied.x * c.n.x + applied.y * c.n.y);
    if (N <= 0) return null;
    if (c.slide !== 0) return { kind: 'cinético', f: -c.slide * c.surface.muK * N };
    const t = contactTangent(c.n);
    const Ft = applied.x * t.x + applied.y * t.y;
    if (Math.abs(Ft) <= c.surface.muS * N) return { kind: 'estático', f: -Ft };
    return { kind: 'cinético', f: -Math.sign(Ft) * c.surface.muK * N };
  }

  force(i: number, s: SystemState, _w: unknown, applied: Vec2 = ZERO): Vec2 {
    const c = this.contacts.get(s.ids[i]);
    if (!c) return ZERO;
    const r = this.regime(c, applied);
    if (!r || r.f === 0) return ZERO;
    const t = contactTangent(c.n);
    return { x: r.f * t.x, y: r.f * t.y };
  }

  describe(i: number, s: SystemState, applied: Vec2): string | undefined {
    const c = this.contacts.get(s.ids[i]);
    return c ? this.regime(c, applied)?.kind : undefined;
  }

  toJSON(): null {
    return null;
  }
}

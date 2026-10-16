import type { Vec2 } from '../../core/vec';
import type { SystemState } from '../state';
import { ZERO, type Endpoint, type Force, type ForceJSON } from './force';

/**
 * Resorte ideal de Hooke entre dos extremos (partícula–partícula o partícula–punto fijo):
 * F = −k (|d| − L₀) d̂ sobre cada partícula conectada.
 * Todavía no está en la caja de herramientas (nivel V del árbol); se usa en los tests.
 */
export class Spring implements Force {
  readonly kind = 'spring' as const;

  constructor(
    public a: Endpoint,
    public b: Endpoint,
    public k: number,
    public restLength = 0,
  ) {}

  private point(e: Endpoint, s: SystemState): Vec2 | null {
    if ('anchor' in e) return e.anchor;
    const j = s.index.get(e.particle);
    return j === undefined ? null : s.pos[j];
  }

  force(i: number, s: SystemState): Vec2 {
    const id = s.ids[i];
    const isA = 'particle' in this.a && this.a.particle === id;
    const isB = 'particle' in this.b && this.b.particle === id;
    if (!isA && !isB) return ZERO;
    const pa = this.point(this.a, s);
    const pb = this.point(this.b, s);
    if (!pa || !pb) return ZERO;
    // d va desde el otro extremo hacia esta partícula
    const self = isA ? pa : pb;
    const other = isA ? pb : pa;
    const dx = self.x - other.x;
    const dy = self.y - other.y;
    const L = Math.hypot(dx, dy);
    if (L === 0) return ZERO;
    const mag = -this.k * (L - this.restLength);
    return { x: (mag * dx) / L, y: (mag * dy) / L };
  }

  toJSON(): ForceJSON {
    return { kind: 'spring', a: this.a, b: this.b, k: this.k, restLength: this.restLength };
  }
}

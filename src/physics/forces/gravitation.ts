import type { Vec2 } from '../../core/vec';
import type { SystemState } from '../state';
import type { Force, ForceJSON } from './force';

/**
 * Gravitación entre todas las masas: F_i = Σ_j G m_i m_j (r_j − r_i) / (|r_j − r_i|² + ε²)^{3/2}.
 * G es un parámetro del juego (no 6,67·10⁻¹¹) para que las órbitas se vean a escala de metros.
 * ε suaviza el choque frontal. Preparado para el nivel V del árbol; todavía no se registra.
 */
export class Gravitation implements Force {
  readonly kind = 'gravitation' as const;

  constructor(
    public G: number,
    public softening = 0.05,
  ) {}

  force(i: number, s: SystemState): Vec2 {
    const pi = s.pos[i];
    const eps2 = this.softening * this.softening;
    let fx = 0;
    let fy = 0;
    for (let j = 0; j < s.pos.length; j++) {
      if (j === i) continue;
      const dx = s.pos[j].x - pi.x;
      const dy = s.pos[j].y - pi.y;
      const r2 = dx * dx + dy * dy + eps2;
      const k = (this.G * s.mass[i] * s.mass[j]) / (r2 * Math.sqrt(r2));
      fx += k * dx;
      fy += k * dy;
    }
    return { x: fx, y: fy };
  }

  toJSON(): ForceJSON {
    return { kind: 'gravitation', G: this.G, softening: this.softening };
  }
}

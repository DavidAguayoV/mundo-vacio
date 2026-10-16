import type { Vec2 } from '../../core/vec';
import type { SystemState } from '../state';
import { ZERO, type Force, type ForceJSON } from './force';

/** G del juego, N·m²/kg². La real es 6,67·10⁻¹¹: con masas de kilogramos no se notaría nada. */
export const G_GAME = 0.5;
/** Suavizado, m: evita fuerzas enormes cuando dos partículas casi se tocan. */
export const SOFTENING = 0.25;

/** F_i = Σ_j G m_i m_j (r_j − r_i) / (|r_j − r_i|² + ε²)^{3/2} */
function pull(G: number, eps: number, i: number, s: SystemState): Vec2 {
  const pi = s.pos[i];
  const eps2 = eps * eps;
  let fx = 0;
  let fy = 0;
  for (let j = 0; j < s.pos.length; j++) {
    if (j === i) continue;
    const dx = s.pos[j].x - pi.x;
    const dy = s.pos[j].y - pi.y;
    const r2 = dx * dx + dy * dy + eps2;
    const k = (G * s.mass[i] * s.mass[j]) / (r2 * Math.sqrt(r2));
    fx += k * dx;
    fy += k * dy;
  }
  return { x: fx, y: fy };
}

/**
 * Gravitación entre todas las masas, con G y ε fijos.
 * G es un parámetro del juego (no 6,67·10⁻¹¹) para que las órbitas se vean a escala de metros.
 */
export class Gravitation implements Force {
  readonly kind = 'gravitation' as const;

  constructor(
    public G: number,
    public softening = 0.05,
  ) {}

  force(i: number, s: SystemState): Vec2 {
    return pull(this.G, this.softening, i, s);
  }

  toJSON(): ForceJSON {
    return { kind: 'gravitation', G: this.G, softening: this.softening };
  }
}

/** Gravitación entre masas que se enciende y apaga desde el mundo (el interruptor «Atracción»). */
export class WorldGravitation implements Force {
  readonly kind = 'gravitation' as const;

  constructor(private settings: () => { G: number } | null) {}

  force(i: number, s: SystemState): Vec2 {
    const g = this.settings();
    if (!g || s.pos.length < 2) return ZERO;
    return pull(g.G, SOFTENING, i, s);
  }

  toJSON(): null {
    return null;
  }
}

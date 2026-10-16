import type { Vec2 } from '../../core/vec';
import type { SystemState } from '../state';
import { ZERO, type Force, type ForceJSON } from './force';

/**
 * Arrastre de un fluido: F = −b v − c |v| v.
 * No depende de la masa (para partículas del mismo tamaño): por eso, con aire, la más masiva cae más rápido.
 */
export class Drag implements Force {
  readonly kind = 'drag' as const;

  constructor(
    public linear: number, // b, kg/s
    public quadratic: number, // c, kg/m
  ) {}

  force(i: number, s: SystemState): Vec2 {
    return dragOn(this.linear, this.quadratic, s.vel[i]);
  }

  toJSON(): ForceJSON {
    return { kind: 'drag', linear: this.linear, quadratic: this.quadratic };
  }
}

function dragOn(b: number, c: number, v: Vec2): Vec2 {
  const speed = Math.hypot(v.x, v.y);
  if (speed === 0) return ZERO;
  const k = b + c * speed;
  return { x: -k * v.x, y: -k * v.y };
}

export type MediumId = 'aire' | 'agua';

export interface Medium {
  name: string;
  /** c, kg/m: arrastre cuadrático, el que domina a velocidades cotidianas */
  quadratic: number;
}

/**
 * Medios del juego. Los coeficientes son de juego, elegidos para que la velocidad terminal
 * se alcance dentro de la pantalla (1 kg: unos 4 m/s en aire y 1,3 m/s en agua).
 * En agua se ignora el empuje, que en partículas muy densas es pequeño.
 */
export const MEDIA: Record<MediumId, Medium> = {
  aire: { name: 'aire', quadratic: 0.6 },
  agua: { name: 'agua', quadratic: 6 },
};

/** Arrastre del medio en que está el mundo (el interruptor «Medio»). */
export class WorldDrag implements Force {
  readonly kind = 'drag' as const;

  constructor(private medium: () => MediumId | null) {}

  force(i: number, s: SystemState): Vec2 {
    const m = this.medium();
    return m ? dragOn(0, MEDIA[m].quadratic, s.vel[i]) : ZERO;
  }

  toJSON(): null {
    return null;
  }
}

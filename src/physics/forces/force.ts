import type { Vec2 } from '../../core/vec';
import type { AccelFn } from '../integrator';
import type { ForceWorld, SystemState } from '../state';

export type ForceKind = 'gravity' | 'spring' | 'drag' | 'gravitation' | 'normal' | 'friction';

/** Extremo de un resorte: otra partícula o un punto fijo del espacio. */
export type Endpoint = { particle: string } | { anchor: Vec2 };

export type ForceJSON =
  | { kind: 'gravity' }
  | { kind: 'spring'; a: Endpoint; b: Endpoint; k: number; restLength: number }
  | { kind: 'drag'; linear: number; quadratic: number }
  | { kind: 'gravitation'; G: number; softening: number };

/**
 * Una interacción. Devuelve la fuerza (N, coordenadas globales) sobre la partícula i
 * cuando el sistema está en el estado s.
 */
export interface Force {
  readonly kind: ForceKind;
  force(i: number, s: SystemState, world: ForceWorld): Vec2;
  toJSON(): ForceJSON;
}

/** Fuerza nula compartida: evita crear un objeto cada vez que una fuerza no actúa sobre una partícula. */
export const ZERO: Readonly<Vec2> = Object.freeze({ x: 0, y: 0 });

/** Construye a_i = ΣF_i / m_i a partir de la lista de fuerzas activas. */
export function makeAccel(forces: readonly Force[], world: ForceWorld): AccelFn {
  return (s, out) => {
    for (let i = 0; i < s.pos.length; i++) {
      let fx = 0;
      let fy = 0;
      for (const f of forces) {
        const F = f.force(i, s, world);
        fx += F.x;
        fy += F.y;
      }
      const m = s.mass[i];
      out[i].x = fx / m;
      out[i].y = fy / m;
    }
  };
}

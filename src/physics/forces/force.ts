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
 *
 * Las fuerzas de reacción (normal, roce) dependen de las demás: reciben en `applied`
 * la suma de las fuerzas que no son de reacción sobre esa misma partícula.
 */
export interface Force {
  readonly kind: ForceKind;
  readonly reaction?: boolean;
  force(i: number, s: SystemState, world: ForceWorld, applied?: Vec2): Vec2;
  /** nota breve para el inspector (por ejemplo, "estático" o "cinético" en el roce) */
  describe?(i: number, s: SystemState, applied: Vec2): string | undefined;
  /** null para fuerzas que viven con otra entidad (la normal y el roce vienen con las superficies) */
  toJSON(): ForceJSON | null;
}

/** Fuerza nula compartida: evita crear un objeto cada vez que una fuerza no actúa sobre una partícula. */
export const ZERO: Readonly<Vec2> = Object.freeze({ x: 0, y: 0 });

/** Construye a_i = ΣF_i / m_i a partir de la lista de fuerzas activas. */
export function makeAccel(forces: readonly Force[], world: ForceWorld): AccelFn {
  const applied = forces.filter((f) => !f.reaction);
  const reactions = forces.filter((f) => f.reaction);
  const sum = { x: 0, y: 0 };
  return (s, out) => {
    for (let i = 0; i < s.pos.length; i++) {
      sum.x = 0;
      sum.y = 0;
      for (const f of applied) {
        const F = f.force(i, s, world);
        sum.x += F.x;
        sum.y += F.y;
      }
      let fx = sum.x;
      let fy = sum.y;
      for (const f of reactions) {
        const F = f.force(i, s, world, sum);
        fx += F.x;
        fy += F.y;
      }
      const m = s.mass[i];
      out[i].x = fx / m;
      out[i].y = fy / m;
    }
  };
}

export interface ForcePart {
  kind: ForceKind;
  F: Vec2;
  /** para el roce: si es estático o cinético */
  note?: string;
}

/** Desglose de las fuerzas sobre la partícula i (para dibujar el diagrama de cuerpo libre). */
export function forceParts(forces: readonly Force[], i: number, s: SystemState, world: ForceWorld): ForcePart[] {
  const parts: ForcePart[] = [];
  const sum = { x: 0, y: 0 };
  for (const f of forces) {
    if (f.reaction) continue;
    const F = f.force(i, s, world);
    sum.x += F.x;
    sum.y += F.y;
    if (F.x || F.y) parts.push({ kind: f.kind, F: { x: F.x, y: F.y } });
  }
  for (const f of forces) {
    if (!f.reaction) continue;
    const F = f.force(i, s, world, sum);
    const note = f.describe?.(i, s, sum);
    if (F.x || F.y || note) parts.push({ kind: f.kind, F: { x: F.x, y: F.y }, note });
  }
  return parts;
}

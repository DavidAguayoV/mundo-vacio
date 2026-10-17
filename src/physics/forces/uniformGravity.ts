import type { Vec2 } from '../../core/vec';
import type { ForceWorld, SystemState } from '../state';
import { ZERO, type Force, type ForceJSON } from './force';

/** Peso: F = m g. Lee g del mundo (que el jugador puede orientar) o de la región donde está la partícula. */
export class UniformGravity implements Force {
  readonly kind = 'gravity' as const;

  force(i: number, s: SystemState, world: ForceWorld): Vec2 {
    const g = world.gAt ? world.gAt(s.pos[i]) : world.g;
    if (!g) return ZERO;
    return { x: s.mass[i] * g.x, y: s.mass[i] * g.y };
  }

  toJSON(): ForceJSON {
    return { kind: 'gravity' };
  }
}

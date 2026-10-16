import type { Vec2 } from '../../core/vec';
import type { ForceWorld, SystemState } from '../state';

/**
 * Restricciones y colisiones: se aplican después de cada paso del integrador
 * y pueden corregir posición y velocidad.
 */
export interface Constraint {
  readonly kind: 'surface';
  /** al empezar un lanzamiento (estado inicial) */
  begin?(s: SystemState, world: ForceWorld): void;
  /** al olvidar el lanzamiento */
  reset?(): void;
  apply(s: SystemState, world: ForceWorld, dt: number): void;
  /** normal de contacto si la partícula está apoyada */
  contactNormal?(id: string): Vec2 | null;
}

export { SurfaceConstraint } from './surface';

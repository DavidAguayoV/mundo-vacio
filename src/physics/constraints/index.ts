import type { ForceWorld, SystemState } from '../state';

/**
 * Restricciones y colisiones (fase 2: superficies con normal y roce).
 * Se aplican después de cada paso del integrador y pueden corregir posición y velocidad.
 */
export interface Constraint {
  readonly kind: 'surface';
  apply(s: SystemState, world: ForceWorld, dt: number): void;
}

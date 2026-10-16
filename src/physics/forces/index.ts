import type { Force, ForceJSON } from './force';
import { Drag } from './drag';
import { FrictionForce } from './friction';
import { Gravitation } from './gravitation';
import { NormalForce } from './normal';
import { Spring } from './spring';
import { UniformGravity } from './uniformGravity';

export * from './force';
export { Drag, FrictionForce, Gravitation, NormalForce, Spring, UniformGravity };

/** Reconstruye una fuerza desde su JSON (guardar/cargar experimentos). */
export function forceFromJSON(j: ForceJSON): Force {
  switch (j.kind) {
    case 'gravity':
      return new UniformGravity();
    case 'spring':
      return new Spring(j.a, j.b, j.k, j.restLength);
    case 'drag':
      return new Drag(j.linear, j.quadratic);
    case 'gravitation':
      return new Gravitation(j.G, j.softening);
  }
}

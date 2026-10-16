import type { Force, ForceJSON } from './force';
import { Drag } from './drag';
import { Gravitation } from './gravitation';
import { Spring } from './spring';
import { UniformGravity } from './uniformGravity';

export * from './force';
export { Drag, Gravitation, Spring, UniformGravity };

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

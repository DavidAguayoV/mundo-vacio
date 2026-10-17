// Claves de localStorage. El juego completo usa «mundoVacio.»; la demo, «mundoVacio.demo.», para
// que un avance nunca pise al otro. El prefijo se fija antes de crear el juego y se lee en cada
// acceso (por eso las claves son funciones y no constantes).

export const FULL_NAMESPACE = 'mundoVacio.';
export const DEMO_NAMESPACE = 'mundoVacio.demo.';

let namespace = FULL_NAMESPACE;

export function useNamespace(prefix: string): void {
  namespace = prefix;
}

export const storageNamespace = (): string => namespace;

/** «progress» → «mundoVacio.progress» (o «mundoVacio.demo.progress» en la demo). */
export const storageKey = (name: string): string => namespace + name;

// Borrar la demo: todo lo guardado con el prefijo de la demo (avance, mundos, lentes, experimentos)
// y volver a la pantalla de entrada. El juego completo y el tema no se tocan.

import { DEMO_NAMESPACE } from '../state/storage';

/** Aviso para la próxima carga: al salir, el juego autoguarda su mundo, así que se borra al volver. */
const RESET_KEY = 'mundoVacio.demo.reset';

/** Claves guardadas por la demo. */
export function demoKeys(storage: Storage): string[] {
  const out: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k?.startsWith(DEMO_NAMESPACE)) out.push(k);
  }
  return out;
}

export function clearDemo(storage: Storage | null = safeStorage()): void {
  if (!storage) return;
  for (const k of demoKeys(storage)) storage.removeItem(k);
}

function safeStorage(): Storage | null {
  try {
    return localStorage;
  } catch {
    return null;
  }
}

/** Antes de crear el juego: si la carga anterior pidió empezar de nuevo, se borra la demo. */
export function applyPendingReset(): void {
  try {
    if (sessionStorage.getItem(RESET_KEY) !== '1') return;
    sessionStorage.removeItem(RESET_KEY);
  } catch {
    return;
  }
  clearDemo();
}

/** Borra la demo y recarga: la próxima persona parte en la pantalla de entrada. */
export function resetDemo(): void {
  clearDemo();
  try {
    sessionStorage.setItem(RESET_KEY, '1');
  } catch {
    /* sin sessionStorage basta con lo ya borrado */
  }
  // sin el #exp= de un experimento compartido, si lo hubiera
  location.replace(location.pathname + location.search);
}

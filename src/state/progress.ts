// Progreso del relato en localStorage. Si el almacenamiento no está disponible, el juego funciona igual sin recordar.

export interface Progress {
  version: 2;
  /** id del capítulo (no su número: así se pueden reordenar sin romper el avance guardado) */
  chapter: string;
  step: number;
  /** modo libre: todas las herramientas, sin relato (laboratorio para clase) */
  free: boolean;
  /** respuestas a las predicciones, por clave */
  predictions: Record<string, string>;
}

const KEY = 'mundoVacio.progress';
const LEGACY_KEY = 'mundoVacio'; // prototipo de un archivo: { ch, st, free }

/** Orden de los capítulos en las versiones 1 (fases 1–3) y en el prototipo, y adónde corresponde cada uno ahora. */
const V1_CHAPTERS = ['vacio', 'particula', 'vectores', 'abajo', 'blanco', 'superficies'];

export const freshProgress = (first = 'vacio'): Progress => ({ version: 2, chapter: first, step: 0, free: false, predictions: {} });

export function loadProgress(chapterIds: readonly string[]): Progress {
  const first = chapterIds[0];
  const valid = (id: unknown): id is string => typeof id === 'string' && chapterIds.includes(id);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>;
      if (p?.version === 2 && valid(p.chapter) && Number.isInteger(p.step)) {
        return {
          version: 2,
          chapter: p.chapter,
          step: Math.max(0, p.step as number),
          free: !!p.free,
          predictions: p.predictions && typeof p.predictions === 'object' ? (p.predictions as Record<string, string>) : {},
        };
      }
      // versión 1: capítulo por número. Se retoma desde el comienzo del mismo capítulo.
      if (p?.version === 1 && Number.isInteger(p.chapter)) {
        const id = V1_CHAPTERS[p.chapter as number];
        return { ...freshProgress(first), chapter: valid(id) ? id : first, free: !!p.free };
      }
    }
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null') as { ch?: number; free?: boolean } | null;
    if (old && typeof old.ch === 'number') {
      const id = V1_CHAPTERS[old.ch];
      return { ...freshProgress(first), chapter: valid(id) ? id : first, free: !!old.free };
    }
  } catch {
    /* almacenamiento bloqueado o JSON dañado: se parte de cero */
  }
  return freshProgress(first);
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sin almacenamiento */
  }
}

// Progreso del relato en localStorage. Si el almacenamiento no está disponible, el juego funciona igual sin recordar.

export interface Progress {
  version: 1;
  chapter: number;
  step: number;
  /** modo libre: todas las herramientas, sin relato (laboratorio para clase) */
  free: boolean;
}

const KEY = 'mundoVacio.progress';
const LEGACY_KEY = 'mundoVacio'; // prototipo de un archivo: { ch, st, free }

export const freshProgress = (): Progress => ({ version: 1, chapter: 0, step: 0, free: false });

export function loadProgress(chapterCount: number): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      if (p && p.version === 1 && Number.isInteger(p.chapter) && Number.isInteger(p.step)) {
        return clamp({ version: 1, chapter: p.chapter!, step: p.step!, free: !!p.free }, chapterCount);
      }
    }
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null') as { ch?: number; st?: number; free?: boolean } | null;
    if (old && typeof old.ch === 'number') {
      return clamp({ version: 1, chapter: old.ch, step: old.st ?? 0, free: !!old.free }, chapterCount);
    }
  } catch {
    /* almacenamiento bloqueado o JSON dañado: se parte de cero */
  }
  return freshProgress();
}

function clamp(p: Progress, chapterCount: number): Progress {
  if (p.chapter < 0 || p.chapter >= chapterCount) return { ...freshProgress(), free: p.free };
  return { ...p, step: Math.max(0, p.step) };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sin almacenamiento */
  }
}

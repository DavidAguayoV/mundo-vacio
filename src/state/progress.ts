// Progreso en localStorage (y en un archivo .json, si el jugador lo descarga). Si el almacenamiento no
// está disponible, el juego funciona igual sin recordar.

import type { Grant } from '../story/types';

/** Un rastro resuelto: sus estrellas, lo que midió el estudiante y cuándo. */
export interface SolvedSite {
  stars: string[];
  measured?: string;
  at: number;
}

export interface Progress {
  version: 3;
  /** rastro en curso (null = en el mapa) */
  site: string | null;
  /** paso dentro del rastro; igual al número de pasos cuando ya se resolvió y se mira su página */
  step: number;
  /** modo libre: todas las herramientas, sin relato (laboratorio para clase) */
  free: boolean;
  /** respuestas a las predicciones, por clave */
  predictions: Record<string, string>;
  /** herramientas y habilidades ganadas (no se pierden al salir de un rastro) */
  have: Grant[];
  /** rastros resueltos, por id */
  solved: Record<string, SolvedSite>;
  /** estrellas de maestría ganadas en el intento en curso, por rastro */
  earned: Record<string, string[]>;
}

const KEY = 'mundoVacio.progress';
const LEGACY_KEY = 'mundoVacio'; // prototipo de un archivo: { ch, st, free }

/** El primer rastro: quien abre el juego por primera vez empieza ahí, sin mapa. */
export const FIRST_SITE = 'vacio';

export const freshProgress = (): Progress => ({
  version: 3,
  site: FIRST_SITE,
  step: 0,
  free: false,
  predictions: {},
  have: [],
  solved: {},
  earned: {},
});

/**
 * Cómo se traduce el relato lineal (versión 2) al mapa: cada capítulo corresponde a uno o más rastros.
 * Los capítulos que siguen siendo un rastro conservan su id; «Vectores» y «El tiempo» se rehicieron.
 */
export const LEGACY_CHAPTERS: { chapter: string; sites: string[]; grants: Grant[] }[] = [
  { chapter: 'vacio', sites: ['vacio'], grants: ['tool:origin'] },
  { chapter: 'particula', sites: ['particula'], grants: ['tool:particle', 'tool:move'] },
  { chapter: 'vectores', sites: ['dos-saltos', 'atajo', 'escalar', 'ejes-ajenos'], grants: ['tool:vector', 'tool:sum'] },
  { chapter: 'tiempo', sites: ['desde-siempre', 'cuadro-a-cuadro', 'boya'], grants: ['time:flow', 'tool:velocity', 'time:rewind', 'time:step', 'lens:graphs'] },
  { chapter: 'abajo', sites: ['abajo'], grants: ['tool:gravity', 'time:slow'] },
  { chapter: 'blanco', sites: ['blanco'], grants: ['time:timeline'] },
  { chapter: 'superficies', sites: ['suelo', 'quedarse', 'mu'], grants: ['tool:surface'] },
  { chapter: 'resortes', sites: ['hooke', 'periodo'], grants: ['tool:spring'] },
  { chapter: 'gravitacion', sites: ['atraccion', 'orbita', 'escape'], grants: ['force:gravitation'] },
  { chapter: 'arrastre', sites: ['aire', 'terminal'], grants: ['force:drag'] },
  { chapter: 'energia', sites: ['conserva', 'cero', 'intercambio'], grants: ['lens:energy'] },
];

/** Orden de los capítulos en la versión 1 (fases 1–3) y en el prototipo. */
const V1_CHAPTERS = ['vacio', 'particula', 'vectores', 'abajo', 'blanco', 'superficies'];

/**
 * Avance de la versión 2 (o anterior) → mapa: lo de los capítulos ya terminados queda resuelto
 * y ganado; si el capítulo en curso sigue existiendo como rastro, se retoma ahí desde el comienzo.
 */
export function migrateChapter(chapter: string, free: boolean, predictions: Record<string, string>, siteIds: readonly string[]): Progress {
  const p: Progress = { ...freshProgress(), free, predictions, site: null };
  const idx = Math.max(0, LEGACY_CHAPTERS.findIndex((c) => c.chapter === chapter));
  const have = new Set<Grant>();
  for (let i = 0; i < idx; i++) {
    const c = LEGACY_CHAPTERS[i];
    c.grants.forEach((g) => have.add(g));
    for (const s of c.sites) if (siteIds.includes(s)) p.solved[s] = { stars: ['resuelto'], at: 0 };
  }
  const current = LEGACY_CHAPTERS[idx];
  // en el capítulo en curso solo se conserva lo que se gana al entrar a su rastro
  if (current && current.sites.length === 1 && current.sites[0] === current.chapter && siteIds.includes(current.chapter)) {
    p.site = current.chapter;
  }
  if (idx === 0) p.site = FIRST_SITE;
  p.have = [...have];
  return p;
}

export function loadProgress(siteIds: readonly string[]): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Record<string, unknown>;
      if (p?.version === 3) return sanitize(p, siteIds);
      if (p?.version === 2 && typeof p.chapter === 'string') {
        const preds = p.predictions && typeof p.predictions === 'object' ? (p.predictions as Record<string, string>) : {};
        return migrateChapter(p.chapter, !!p.free, preds, siteIds);
      }
      // versión 1: capítulo por número
      if (p?.version === 1 && Number.isInteger(p.chapter)) {
        return migrateChapter(V1_CHAPTERS[p.chapter as number] ?? FIRST_SITE, !!p.free, {}, siteIds);
      }
    }
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? 'null') as { ch?: number; free?: boolean } | null;
    if (old && typeof old.ch === 'number') return migrateChapter(V1_CHAPTERS[old.ch] ?? FIRST_SITE, !!old.free, {}, siteIds);
  } catch {
    /* almacenamiento bloqueado o JSON dañado: se parte de cero */
  }
  return freshProgress();
}

/**
 * Dónde se entra al abrir la página: sin nada resuelto, donde quedó (al comienzo, «El vacío»); con
 * avance, en el mapa con todo lo ganado, en vez de caer a mitad de un rastro o en el laboratorio.
 */
export function openingProgress(p: Progress): Progress {
  if (!Object.keys(p.solved).length) return p;
  return { ...p, site: null, step: 0, free: false };
}

/** Marca del archivo de avance (para no confundirlo con un experimento del laboratorio). */
const FILE_KIND = 'mundo-vacio/avance';

/** El avance como archivo .json: se descarga para llevarlo a otro navegador o guardarlo aparte. */
export function progressFile(p: Progress, now = new Date()): string {
  return JSON.stringify({ kind: FILE_KIND, savedAt: now.toISOString(), progress: p }, null, 2);
}

/** Nombre del archivo: mundo-vacio-avance-2026-10-17.json */
export const progressFileName = (now = new Date()): string => {
  const d = (n: number) => String(n).padStart(2, '0');
  return `mundo-vacio-avance-${now.getFullYear()}-${d(now.getMonth() + 1)}-${d(now.getDate())}.json`;
};

/**
 * Lee un archivo de avance. Acepta el que descarga el juego y también un progreso suelto (lo que
 * guarda el navegador). Devuelve null si no es un avance; lo que no calza se descarta, como al cargar.
 */
export function readProgressFile(text: string, siteIds: readonly string[]): Progress | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const p = (d.kind === FILE_KIND ? d.progress : d) as Record<string, unknown> | undefined;
  if (!p || typeof p !== 'object' || p.version !== 3 || !p.solved || typeof p.solved !== 'object') return null;
  return sanitize(p, siteIds);
}

/** Revisa un progreso v3 leído del almacenamiento: lo que no calza se descarta en vez de romper el juego. */
function sanitize(p: Record<string, unknown>, siteIds: readonly string[]): Progress {
  const out = freshProgress();
  out.site = typeof p.site === 'string' && siteIds.includes(p.site) ? p.site : null;
  out.step = Number.isInteger(p.step) ? Math.max(0, p.step as number) : 0;
  out.free = !!p.free;
  if (p.predictions && typeof p.predictions === 'object') out.predictions = p.predictions as Record<string, string>;
  if (Array.isArray(p.have)) out.have = p.have.filter((g): g is Grant => typeof g === 'string' && g.includes(':'));
  if (p.solved && typeof p.solved === 'object') {
    for (const [id, v] of Object.entries(p.solved as Record<string, SolvedSite>)) {
      if (siteIds.includes(id) && v && Array.isArray(v.stars)) out.solved[id] = { stars: v.stars.filter((x) => typeof x === 'string'), measured: typeof v.measured === 'string' ? v.measured : undefined, at: Number(v.at) || 0 };
    }
  }
  if (p.earned && typeof p.earned === 'object') {
    for (const [id, v] of Object.entries(p.earned as Record<string, string[]>)) if (Array.isArray(v)) out.earned[id] = v.filter((x) => typeof x === 'string');
  }
  return giveRewind(splitDrift(out, siteIds));
}

/**
 * t = 0 se gana ahora al final de «Desde siempre» (antes, solo en «Cuadro a cuadro»): quien ya lo
 * había resuelto lo recibe al cargar, porque la boya, el pozo y el astro lo piden.
 */
export function giveRewind(p: Progress): Progress {
  if (p.solved['desde-siempre'] && !p.have.includes('time:rewind')) p.have = [...p.have, 'time:rewind'];
  return p;
}

/**
 * Paso de «Desde siempre» antes de dividirse → paso de «Cuadro a cuadro»: el 5 era el paso a paso,
 * el 6 los gráficos y el 7 la página del rastro resuelto.
 */
const DRIFT_STEPS: Record<number, number> = { 5: 0, 6: 2, 7: 3 };
const DRIFT_SPLIT_AT = 5;

/**
 * «Desde siempre» se dividió en dos rastros: la inercia y la apuesta quedaron en él; el paso a paso
 * y los gráficos pasaron a «Cuadro a cuadro». Quien lo había resuelto tiene los dos resueltos, y
 * quien iba en la segunda mitad sigue en el rastro nuevo, en el paso que le corresponde.
 */
export function splitDrift(p: Progress, siteIds: readonly string[]): Progress {
  const OLD = 'desde-siempre';
  const NEW = 'cuadro-a-cuadro';
  if (!siteIds.includes(NEW)) return p;
  const done = p.solved[OLD];
  // antes de dividirlo, resolver «Desde siempre» entregaba el paso a paso y los gráficos
  if (done && !p.solved[NEW] && p.have.includes('lens:graphs')) p.solved[NEW] = { stars: ['resuelto'], at: done.at };
  if (p.site === OLD && p.step >= DRIFT_SPLIT_AT) {
    // la inercia y la apuesta ya estaban hechas: «Desde siempre» queda resuelto
    if (!done) p.solved[OLD] = { stars: ['resuelto', ...(p.earned[OLD] ?? [])], at: Date.now() };
    p.site = NEW;
    p.step = DRIFT_STEPS[Math.min(p.step, 7)];
  }
  return p;
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* sin almacenamiento */
  }
}

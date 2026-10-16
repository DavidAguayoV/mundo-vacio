import type { WorldJSON } from '../world/serialize';
import { parseExperiment, type Experiment } from './experiment';

export interface SavedExperiment extends Experiment {
  id: string;
}

export type WorldSlot = 'story' | 'lab';

const LIST_KEY = 'mundoVacio.experiments';
const AUTOSAVE_KEY: Record<WorldSlot, string> = { story: 'mundoVacio.world.story', lab: 'mundoVacio.world.lab' };

/** localStorage puede no existir o lanzar (modo privado, almacenamiento bloqueado). */
function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * Experimentos guardados en este navegador, más el autoguardado del mundo de cada modo
 * (el del relato y el del laboratorio no se mezclan).
 * Nada de esto viaja a otro equipo: para eso están el archivo .json y el enlace.
 */
export class ExperimentLibrary {
  constructor(private storage: Storage | null = defaultStorage()) {}

  private read(key: string): unknown {
    try {
      const raw = this.storage?.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /** Devuelve false si no se pudo guardar (sin espacio o sin almacenamiento). */
  private write(key: string, value: unknown): boolean {
    try {
      if (!this.storage) return false;
      this.storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  /** Experimentos guardados, del más reciente al más antiguo. Los dañados se omiten. */
  list(): SavedExperiment[] {
    const raw = this.read(LIST_KEY);
    if (!Array.isArray(raw)) return [];
    const out: SavedExperiment[] = [];
    for (const item of raw) {
      try {
        const exp = parseExperiment(item);
        out.push({ ...exp, id: typeof item.id === 'string' ? item.id : exp.savedAt });
      } catch {
        /* entrada dañada: se ignora */
      }
    }
    return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  /** Guarda; si ya hay uno con el mismo nombre, lo reemplaza. */
  save(exp: Experiment): SavedExperiment | null {
    const list = this.list();
    const same = list.find((e) => e.name.trim().toLowerCase() === exp.name.trim().toLowerCase());
    const saved: SavedExperiment = { ...exp, id: same?.id ?? `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
    const next = [saved, ...list.filter((e) => e.id !== saved.id)];
    return this.write(LIST_KEY, next) ? saved : null;
  }

  get(id: string): SavedExperiment | undefined {
    return this.list().find((e) => e.id === id);
  }

  remove(id: string): void {
    this.write(
      LIST_KEY,
      this.list().filter((e) => e.id !== id),
    );
  }

  // ---------- autoguardado ----------

  autosave(slot: WorldSlot, world: WorldJSON): void {
    this.write(AUTOSAVE_KEY[slot], world);
  }

  loadAutosave(slot: WorldSlot): WorldJSON | null {
    const raw = this.read(AUTOSAVE_KEY[slot]);
    if (!raw) return null;
    try {
      return parseExperiment(raw).world;
    } catch {
      return null;
    }
  }

  clearAutosave(slot: WorldSlot): void {
    try {
      this.storage?.removeItem(AUTOSAVE_KEY[slot]);
    } catch {
      /* sin almacenamiento */
    }
  }
}

// Preferencias de vista del laboratorio (modo libre). No forman parte del experimento:
// son de quien mira, y en el relato siempre se usan los valores por defecto.

import { storageKey } from './storage';

export type TimeScale = 1 | 0.5 | 0.25;

export interface LabPrefs {
  /** cámara lenta: tiempo simulado por segundo real */
  timeScale: TimeScale;
  /** dibujar los vectores posición r desde el origen */
  showPositions: boolean;
  /** dibujar la trayectoria estroboscópica */
  showTrails: boolean;
}

export const DEFAULT_PREFS: LabPrefs = { timeScale: 1, showPositions: true, showTrails: true };

const KEY = () => storageKey('prefs');

export function loadPrefs(): LabPrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY()) ?? 'null') as Partial<LabPrefs> | null;
    if (!p) return { ...DEFAULT_PREFS };
    return {
      timeScale: p.timeScale === 0.5 || p.timeScale === 0.25 ? p.timeScale : 1,
      showPositions: p.showPositions !== false,
      showTrails: p.showTrails !== false,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: LabPrefs): void {
  try {
    localStorage.setItem(KEY(), JSON.stringify(p));
  } catch {
    /* sin almacenamiento */
  }
}

// Paleta física leída de los tokens CSS, para que el lienzo use exactamente los colores de la UI.

export interface Palette {
  bg: string;
  ink: string;
  muted: string;
  grid: string;
  line: string;
  /** posición: neutro */
  pos: string;
  /** vectores y fuerzas: ámbar */
  vec: string;
  /** velocidad: cian */
  vel: string;
  /** aceleración y g: rosa */
  acc: string;
  mono: string;
}

export function readPalette(el: HTMLElement = document.documentElement): Palette {
  const cs = getComputedStyle(el);
  const v = (k: string) => cs.getPropertyValue(`--${k}`).trim();
  return {
    bg: v('bg'),
    ink: v('ink'),
    muted: v('muted'),
    grid: v('grid'),
    line: v('line'),
    pos: v('pos'),
    vec: v('vec'),
    vel: v('vel'),
    acc: v('acc'),
    mono: v('mono'),
  };
}

export type ThemeName = 'dark' | 'light';
const KEY = 'mundoVacio.theme';

/** Oscuro por defecto; el claro se elige a mano y se recuerda. */
export function loadTheme(): ThemeName {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(t: ThemeName): void {
  document.documentElement.dataset.theme = t;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'light' ? '#f3f5f7' : '#0d1015');
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* sin almacenamiento: el tema vale solo para esta visita */
  }
}

// Paleta física leída de los tokens CSS, para que el lienzo use exactamente los colores de la UI.

export interface Palette {
  bg: string;
  /** luz tenue que enciende el origen */
  glow: string;
  /** opacidad de esa luz en su centro */
  glowAlpha: number;
  /** halo de las partículas */
  halo: string;
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
  /** serif de pizarra: símbolos físicos (v, g, r₁, mg…) */
  serif: string;
  /** sans de la interfaz: rótulos de masa y números de los ejes */
  sans: string;
  mono: string;
}

export function readPalette(el: HTMLElement = document.documentElement): Palette {
  const cs = getComputedStyle(el);
  const v = (k: string) => cs.getPropertyValue(`--${k}`).trim();
  return {
    bg: v('bg'),
    glow: v('glow'),
    glowAlpha: Number.parseFloat(v('glow-a')) || 0.1,
    halo: v('halo'),
    ink: v('ink'),
    muted: v('muted'),
    grid: v('grid'),
    line: v('line'),
    pos: v('pos'),
    vec: v('vec'),
    vel: v('vel'),
    acc: v('acc'),
    serif: v('display'),
    sans: v('body'),
    mono: v('mono'),
  };
}

/** Un color de la paleta (#rrggbb o #rgb) con opacidad a, para degradados del lienzo. */
export function withAlpha(color: string, a: number): string {
  let h = color.trim().replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return color;
  const n = parseInt(h, 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
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
  if (meta) meta.setAttribute('content', t === 'light' ? '#eef1f6' : '#070a12');
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* sin almacenamiento: el tema vale solo para esta visita */
  }
}

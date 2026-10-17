import type { Vec2 } from '../core/vec';

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export const ZOOM_MIN = 0.3;
export const ZOOM_MAX = 4;

/**
 * Cámara: convierte metros (globales, y hacia arriba) a píxeles CSS del lienzo (y hacia abajo).
 * La escala base depende del tamaño de la pantalla; zoom y center permiten acercarse y recorrer el mundo.
 */
export class View {
  W = 0; // px CSS
  H = 0;
  dpr = 1;
  /** píxeles por metro con zoom 1 */
  base = 40;
  /** píxeles por metro */
  S = 40;
  zoom = 1;
  /** punto del mundo que queda en el centro de referencia de la pantalla */
  center: Vec2 = { x: 0, y: 0 };

  /** altura del centro como fracción de la pantalla (null: algo bajo la mitad, para dejar sitio a la tarjeta) */
  cyRatio: number | null = null;

  /** @param unitsAcross cuántas unidades caben en el lado menor de la pantalla con zoom 1 */
  constructor(public unitsAcross = 13) {}

  resize(W: number, H: number, dpr: number): void {
    this.W = W;
    this.H = H;
    this.dpr = Math.min(2, dpr || 1);
    this.base = Math.max(26 * (13 / this.unitsAcross), Math.min(W, H) / this.unitsAcross);
    this.S = this.base * this.zoom;
  }

  /** Acerca o aleja (factor > 1 acerca) dejando fijo el punto de la pantalla (px, py). */
  zoomAt(px: number, py: number, factor: number): void {
    const before = this.toWorld(px, py);
    this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, this.zoom * factor));
    this.S = this.base * this.zoom;
    const after = this.toWorld(px, py);
    this.center = { x: this.center.x + before.x - after.x, y: this.center.y + before.y - after.y };
  }

  /** Desplaza la vista: el contenido se mueve dx, dy píxeles. */
  panPx(dx: number, dy: number): void {
    this.center = { x: this.center.x - dx / this.S, y: this.center.y + dy / this.S };
  }

  /** Vista a la que vuelve «Centrar la vista» (la del rastro, si se ajustó al entrar). */
  home: { center: Vec2; zoom: number } = { center: { x: 0, y: 0 }, zoom: 1 };

  /** Vuelve a la vista de inicio (o a la que se indique). */
  reset(center: Vec2 = this.home.center, zoom = this.home.zoom): void {
    this.center = { ...center };
    this.zoom = zoom;
    this.S = this.base * zoom;
  }

  /** ¿Se movió la cámara respecto de la vista de inicio? */
  get moved(): boolean {
    return Math.abs(this.zoom / this.home.zoom - 1) > 0.02 || Math.hypot(this.center.x - this.home.center.x, this.center.y - this.home.center.y) * this.S > 24;
  }

  /**
   * Encuadra una caja del mundo en una franja de la pantalla (entre top y bottom, en px) sin acercar
   * más que el zoom 1. Queda como la vista de inicio.
   */
  fit(b: Bounds, top: number, bottom: number, pad = 28): void {
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    const zoom = Math.max(ZOOM_MIN, Math.min(1, (this.W - 2 * pad) / (w * this.base), (bottom - top - 2 * pad) / (h * this.base)));
    const S = this.base * zoom;
    const cx = (b.minX + b.maxX) / 2;
    const cyWorld = (b.minY + b.maxY) / 2;
    const py = (top + bottom) / 2;
    this.home = { center: { x: cx, y: cyWorld - (this.cy - py) / S }, zoom };
    this.reset();
  }

  /** Límites de la vista inicial (sin paneo ni zoom), para decidir cuándo algo «salió del mundo visible». */
  homeBounds(marginPx = 0): Bounds {
    const S = this.base;
    const cy = this.cy;
    return {
      minX: (-marginPx - this.W / 2) / S,
      maxX: (this.W + marginPx - this.W / 2) / S,
      minY: (cy - this.H - marginPx) / S,
      maxY: (cy + marginPx) / S,
    };
  }

  get narrow(): boolean {
    return this.W < 700;
  }

  /** Altura en pantalla del centro: algo bajo la mitad para dejar sitio a la tarjeta de relato. */
  private get cy(): number {
    return this.H * (this.cyRatio ?? (this.narrow ? 0.58 : 0.53));
  }

  sx(x: number): number {
    return this.W / 2 + (x - this.center.x) * this.S;
  }

  sy(y: number): number {
    return this.cy - (y - this.center.y) * this.S;
  }

  toWorld(px: number, py: number): Vec2 {
    return { x: (px - this.W / 2) / this.S + this.center.x, y: (this.cy - py) / this.S + this.center.y };
  }

  /** Convierte una distancia en píxeles a metros. */
  m(px: number): number {
    return px / this.S;
  }

  bounds(marginPx = 0): Bounds {
    const a = this.toWorld(-marginPx, this.H + marginPx);
    const b = this.toWorld(this.W + marginPx, -marginPx);
    return { minX: a.x, maxX: b.x, minY: a.y, maxY: b.y };
  }
}

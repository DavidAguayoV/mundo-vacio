import type { Vec2 } from '../core/vec';

export interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * Cámara: convierte metros (globales, y hacia arriba) a píxeles CSS del lienzo (y hacia abajo).
 * Vista fija como en el prototipo; scale y center quedan listos para agregar zoom y paneo.
 */
export class View {
  W = 0; // px CSS
  H = 0;
  dpr = 1;
  /** píxeles por metro */
  S = 40;
  /** punto del mundo que queda en el centro de referencia de la pantalla */
  center: Vec2 = { x: 0, y: 0 };

  resize(W: number, H: number, dpr: number): void {
    this.W = W;
    this.H = H;
    this.dpr = Math.min(2, dpr || 1);
    this.S = Math.max(26, Math.min(W, H) / 13);
  }

  get narrow(): boolean {
    return this.W < 700;
  }

  /** Altura en pantalla del centro: algo bajo la mitad para dejar sitio a la tarjeta de relato. */
  private get cy(): number {
    return this.H * (this.narrow ? 0.58 : 0.53);
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

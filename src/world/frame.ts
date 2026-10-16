import type { Vec2 } from '../core/vec';

/**
 * Sistema de referencia del usuario: un origen y un ángulo (rad) del eje x respecto al eje global.
 * La física corre en coordenadas globales; todo lo que se muestra pasa por toUser().
 */
export class ReferenceFrame {
  constructor(
    public origin: Vec2 = { x: 0, y: 0 },
    public angle = 0,
  ) {}

  /** Versor del eje x del usuario, en coordenadas globales. */
  get ex(): Vec2 {
    return { x: Math.cos(this.angle), y: Math.sin(this.angle) };
  }

  /** Versor del eje y del usuario (ex girado 90° antihorario). */
  get ey(): Vec2 {
    return { x: -Math.sin(this.angle), y: Math.cos(this.angle) };
  }

  /** Componentes de un vector libre (velocidad, g, desplazamiento) en los ejes del usuario. */
  toUser(v: Vec2): Vec2 {
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    return { x: v.x * c + v.y * s, y: -v.x * s + v.y * c };
  }

  toGlobal(u: Vec2): Vec2 {
    const c = Math.cos(this.angle);
    const s = Math.sin(this.angle);
    return { x: u.x * c - u.y * s, y: u.x * s + u.y * c };
  }

  /** Coordenadas de un punto medidas desde el origen del usuario: el vector posición r. */
  pointToUser(p: Vec2): Vec2 {
    return this.toUser({ x: p.x - this.origin.x, y: p.y - this.origin.y });
  }

  pointToGlobal(u: Vec2): Vec2 {
    const g = this.toGlobal(u);
    return { x: g.x + this.origin.x, y: g.y + this.origin.y };
  }

  toJSON(): { origin: Vec2; angle: number } {
    return { origin: { ...this.origin }, angle: this.angle };
  }
}

/** Marco identidad, para mostrar algo antes de que el jugador fije un origen. */
export const IDENTITY_FRAME = new ReferenceFrame();

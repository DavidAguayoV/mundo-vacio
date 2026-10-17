import type { Vec2 } from '../core/vec';

/** Superficie plana y rígida: un segmento ab fijo en el espacio, con sus coeficientes de roce. */
export interface SurfaceLike {
  id: string;
  a: Vec2;
  b: Vec2;
  /** coeficiente de roce estático μₛ */
  muS: number;
  /** coeficiente de roce cinético μc (≤ μₛ) */
  muK: number;
  /** parte del escenario de un rastro (un muro): no se mueve ni se borra */
  locked?: boolean;
  /** su roce no se muestra: el jugador lo tiene que medir */
  secret?: boolean;
}

export interface SurfaceFrame {
  /** versor tangente, de a hacia b */
  t: Vec2;
  /** versor normal "izquierdo" (t girado 90° antihorario) */
  n: Vec2;
  length: number;
}

export function surfaceFrame(s: SurfaceLike): SurfaceFrame {
  const dx = s.b.x - s.a.x;
  const dy = s.b.y - s.a.y;
  const L = Math.hypot(dx, dy) || 1;
  return { t: { x: dx / L, y: dy / L }, n: { x: -dy / L, y: dx / L }, length: L };
}

/** Distancia con signo de p a la recta de la superficie (positiva del lado de n) y posición u a lo largo de ella. */
export function surfaceCoords(s: SurfaceLike, f: SurfaceFrame, p: Vec2): { d: number; u: number } {
  const rx = p.x - s.a.x;
  const ry = p.y - s.a.y;
  return { d: rx * f.n.x + ry * f.n.y, u: rx * f.t.x + ry * f.t.y };
}

/** Una partícula apoyada en una superficie. */
export interface Contact {
  surface: SurfaceLike;
  /** normal que apunta desde la superficie hacia el lado donde está la partícula */
  n: Vec2;
  /**
   * Sentido del deslizamiento al empezar el paso, a lo largo de contactTangent(n): +1, −1, o 0 si no desliza.
   * Queda fijo durante las cuatro etapas de RK4: si el roce cinético cambiara de sentido entre etapas,
   * la partícula quedaría temblando en torno a v = 0 en vez de detenerse.
   */
  slide: number;
}

/** Tangente de un contacto: la normal girada −90°. */
export const contactTangent = (n: Vec2): Vec2 => ({ x: n.y, y: -n.x });

/**
 * Qué partículas están apoyadas y en qué superficie.
 * La escribe la restricción de superficies (después de cada paso) y la leen la normal y el roce
 * (durante el paso, en las cuatro etapas de RK4): el conjunto de contactos queda fijo dentro de un paso.
 */
export class ContactSet {
  private map = new Map<string, Contact>();

  get(id: string): Contact | undefined {
    return this.map.get(id);
  }

  set(id: string, c: Contact): void {
    this.map.set(id, c);
  }

  delete(id: string): void {
    this.map.delete(id);
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }

  entries(): IterableIterator<[string, Contact]> {
    return this.map.entries();
  }
}

/** Bajo esta rapidez tangencial (m/s) se considera que la partícula no desliza: rige el roce estático. */
export const STICK_SPEED = 1e-4;

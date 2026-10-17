import type { Vec2 } from '../core/vec';

/**
 * Estado del sistema completo en un instante (o en una etapa intermedia de RK4).
 * Las fuerzas reciben el estado de TODAS las partículas: así un resorte o la gravitación
 * entre masas ven posiciones consistentes en cada etapa k1…k4.
 */
export interface SystemState {
  ids: string[];
  pos: Vec2[]; // m
  vel: Vec2[]; // m/s
  mass: number[]; // kg
  t: number; // s
  /** id de partícula → índice en los arreglos */
  index: Map<string, number>;
}

/** Lo mínimo que una fuerza necesita saber del mundo. World lo implementa. */
export interface ForceWorld {
  /** campo gravitacional uniforme, m/s² (null = sin gravedad) */
  g: Vec2 | null;
  /** g en un punto, si el mundo tiene regiones con su propia gravedad (si no, vale g) */
  gAt?(p: Vec2): Vec2 | null;
}

export interface Body {
  id: string;
  pos: Vec2;
  vel: Vec2;
  mass: number;
}

/** Crea un estado que comparte los objetos pos/vel de los cuerpos: integrar el estado mueve los cuerpos. */
export function stateFromBodies(bodies: readonly Body[], t = 0): SystemState {
  const index = new Map<string, number>();
  bodies.forEach((b, i) => index.set(b.id, i));
  return {
    ids: bodies.map((b) => b.id),
    pos: bodies.map((b) => b.pos),
    vel: bodies.map((b) => b.vel),
    mass: bodies.map((b) => b.mass),
    t,
    index,
  };
}

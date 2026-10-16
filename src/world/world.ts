import type { Vec2 } from '../core/vec';
import type { Body, ForceWorld } from '../physics/state';
import { ReferenceFrame } from './frame';

export const G_EARTH = 9.8; // m/s²

export interface Particle extends Body {
  label: string; // "1", "2", …
}

/** Vector libre dibujado por el jugador (cola y punta en coordenadas globales). */
export interface FreeVector {
  id: string;
  label: string; // "A", "B", …
  tail: Vec2;
  tip: Vec2;
}

/** Suma A + B: B se traslada a la punta de A. Guarda referencias, no copias: si A o B cambian, la suma también. */
export interface VectorSum {
  id: string;
  a: string;
  b: string;
}

export interface Target {
  id: string;
  pos: Vec2;
  radius: number; // m
}

/** Superficie plana (segmento). Fase 2: normal y roce. */
export interface Surface {
  id: string;
  a: Vec2;
  b: Vec2;
  muS: number;
  muK: number;
}

export type EntityRef =
  | { kind: 'particle'; id: string }
  | { kind: 'vector'; id: string }
  | { kind: 'sum'; id: string };

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Todo lo que existe en el universo del jugador. Las entidades son datos planos
 * (serializables a JSON); la lógica de física vive en physics/ y la de dibujo en render/.
 */
export class World implements ForceWorld {
  frame: ReferenceFrame | null = null;
  particles: Particle[] = [];
  vectors: FreeVector[] = [];
  sums: VectorSum[] = [];
  g: Vec2 | null = null;
  targets: Target[] = [];
  surfaces: Surface[] = [];

  private nextId = 1;

  newId(prefix: string): string {
    return `${prefix}${this.nextId++}`;
  }

  /** Para que los ids nuevos no choquen con los de un experimento cargado. */
  bumpIds(ids: string[]): void {
    for (const id of ids) {
      const n = Number(id.replace(/^\D+/, ''));
      if (Number.isFinite(n) && n >= this.nextId) this.nextId = n + 1;
    }
  }

  clear(): void {
    this.frame = null;
    this.particles = [];
    this.vectors = [];
    this.sums = [];
    this.g = null;
    this.targets = [];
    this.surfaces = [];
  }

  // ----- partículas -----

  addParticle(pos: Vec2, mass = 1, vel: Vec2 = { x: 0, y: 0 }): Particle {
    const used = new Set(this.particles.map((p) => p.label));
    let n = 1;
    while (used.has(String(n))) n++;
    const p: Particle = { id: this.newId('p'), label: String(n), pos: { ...pos }, vel: { ...vel }, mass };
    this.particles.push(p);
    return p;
  }

  particle(id: string): Particle | undefined {
    return this.particles.find((p) => p.id === id);
  }

  removeParticle(id: string): void {
    this.particles = this.particles.filter((p) => p.id !== id);
  }

  // ----- vectores -----

  addVector(tail: Vec2, tip: Vec2): FreeVector {
    const used = new Set(this.vectors.map((v) => v.label));
    let k = 0;
    while (used.has(LETTERS[k % LETTERS.length]) && k < LETTERS.length) k++;
    const v: FreeVector = { id: this.newId('v'), label: LETTERS[k % LETTERS.length], tail: { ...tail }, tip: { ...tip } };
    this.vectors.push(v);
    return v;
  }

  vector(id: string): FreeVector | undefined {
    return this.vectors.find((v) => v.id === id);
  }

  removeVector(id: string): void {
    this.vectors = this.vectors.filter((v) => v.id !== id);
    this.sums = this.sums.filter((s) => s.a !== id && s.b !== id);
  }

  addSum(a: string, b: string): VectorSum {
    const s: VectorSum = { id: this.newId('s'), a, b };
    this.sums.push(s);
    return s;
  }

  sum(id: string): VectorSum | undefined {
    return this.sums.find((s) => s.id === id);
  }

  removeSum(id: string): void {
    this.sums = this.sums.filter((s) => s.id !== id);
  }

  /** Geometría de una suma: B trasladado a la punta de A, y la resultante. */
  sumGeometry(s: VectorSum): { A: FreeVector; B: FreeVector; tail: Vec2; tip: Vec2; bTail: Vec2 } | null {
    const A = this.vector(s.a);
    const B = this.vector(s.b);
    if (!A || !B) return null;
    const bx = B.tip.x - B.tail.x;
    const by = B.tip.y - B.tail.y;
    return { A, B, tail: A.tail, bTail: A.tip, tip: { x: A.tip.x + bx, y: A.tip.y + by } };
  }

  // ----- selección -----

  exists(ref: EntityRef | null): boolean {
    if (!ref) return false;
    if (ref.kind === 'particle') return !!this.particle(ref.id);
    if (ref.kind === 'vector') return !!this.vector(ref.id);
    return !!this.sum(ref.id);
  }

  remove(ref: EntityRef): void {
    if (ref.kind === 'particle') this.removeParticle(ref.id);
    else if (ref.kind === 'vector') this.removeVector(ref.id);
    else this.removeSum(ref.id);
  }
}

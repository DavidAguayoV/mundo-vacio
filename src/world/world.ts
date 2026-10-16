import type { Vec2 } from '../core/vec';
import type { SurfaceLike } from '../physics/contact';
import type { Endpoint } from '../physics/forces/force';
import type { MediumId } from '../physics/forces/drag';
import type { SpringLike } from '../physics/forces/springs';
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

/** Superficie plana y rígida (segmento) con roce estático μₛ y cinético μc. */
export type Surface = SurfaceLike;

/** Resorte ideal entre dos extremos (partícula o punto fijo). */
export type SpringLink = SpringLike;

export const DEFAULT_K = 20; // N/m
export const DEFAULT_MU_S = 0.6;
export const DEFAULT_MU_K = 0.4;

export type EntityRef =
  | { kind: 'particle'; id: string }
  | { kind: 'vector'; id: string }
  | { kind: 'sum'; id: string }
  | { kind: 'surface'; id: string }
  | { kind: 'spring'; id: string };

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
  springs: SpringLink[] = [];
  /** atracción gravitacional entre todas las masas (null = apagada) */
  gravitation: { G: number } | null = null;
  /** fluido que llena el espacio (null = vacío): produce arrastre */
  medium: MediumId | null = null;

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
    this.springs = [];
    this.gravitation = null;
    this.medium = null;
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
    this.springs = this.springs.filter((sp) => !(('particle' in sp.a && sp.a.particle === id) || ('particle' in sp.b && sp.b.particle === id)));
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

  // ----- superficies -----

  addSurface(a: Vec2, b: Vec2, muS = DEFAULT_MU_S, muK = DEFAULT_MU_K): Surface {
    const s: Surface = { id: this.newId('f'), a: { ...a }, b: { ...b }, muS, muK };
    this.surfaces.push(s);
    return s;
  }

  surface(id: string): Surface | undefined {
    return this.surfaces.find((s) => s.id === id);
  }

  removeSurface(id: string): void {
    this.surfaces = this.surfaces.filter((s) => s.id !== id);
  }

  // ----- resortes -----

  /** Crea un resorte; si no se da el largo natural, es el largo actual (sin estirar). */
  addSpring(a: Endpoint, b: Endpoint, k = DEFAULT_K, restLength?: number): SpringLink {
    const L = restLength ?? Math.hypot(...this.endDelta(a, b));
    const sp: SpringLink = { id: this.newId('k'), a: copyEnd(a), b: copyEnd(b), k, restLength: L };
    this.springs.push(sp);
    return sp;
  }

  spring(id: string): SpringLink | undefined {
    return this.springs.find((s) => s.id === id);
  }

  removeSpring(id: string): void {
    this.springs = this.springs.filter((s) => s.id !== id);
  }

  /** Posición de un extremo (null si su partícula ya no existe). */
  endPos(e: Endpoint): Vec2 | null {
    if ('anchor' in e) return e.anchor;
    return this.particle(e.particle)?.pos ?? null;
  }

  private endDelta(a: Endpoint, b: Endpoint): [number, number] {
    const pa = this.endPos(a);
    const pb = this.endPos(b);
    return pa && pb ? [pb.x - pa.x, pb.y - pa.y] : [0, 0];
  }

  /** Largo actual de un resorte. */
  springLength(sp: SpringLink): number {
    return Math.hypot(...this.endDelta(sp.a, sp.b));
  }

  /** Resortes que tocan una partícula. */
  springsOf(particleId: string): SpringLink[] {
    return this.springs.filter((s) => ('particle' in s.a && s.a.particle === particleId) || ('particle' in s.b && s.b.particle === particleId));
  }

  // ----- selección -----

  exists(ref: EntityRef | null): boolean {
    if (!ref) return false;
    if (ref.kind === 'particle') return !!this.particle(ref.id);
    if (ref.kind === 'vector') return !!this.vector(ref.id);
    if (ref.kind === 'surface') return !!this.surface(ref.id);
    if (ref.kind === 'spring') return !!this.spring(ref.id);
    return !!this.sum(ref.id);
  }

  remove(ref: EntityRef): void {
    if (ref.kind === 'particle') this.removeParticle(ref.id);
    else if (ref.kind === 'vector') this.removeVector(ref.id);
    else if (ref.kind === 'surface') this.removeSurface(ref.id);
    else if (ref.kind === 'spring') this.removeSpring(ref.id);
    else this.removeSum(ref.id);
  }
}

const copyEnd = (e: Endpoint): Endpoint => ('anchor' in e ? { anchor: { ...e.anchor } } : { particle: e.particle });

import { dist, segmentsIntersect, type Vec2 } from '../core/vec';
import type { SurfaceLike } from '../physics/contact';
import type { Endpoint } from '../physics/forces/force';
import type { MediumId } from '../physics/forces/drag';
import type { SpringLike } from '../physics/forces/springs';
import type { Body, ForceWorld } from '../physics/state';
import { ReferenceFrame } from './frame';

export const G_EARTH = 9.8; // m/s²

export interface Particle extends Body {
  label: string; // "1", "2", …
  /** su velocidad no se puede cambiar (la boya de un rastro) */
  locked?: boolean;
}

/** Vector libre dibujado por el jugador (cola y punta en coordenadas globales). */
export interface FreeVector {
  id: string;
  label: string; // "A", "B", …
  tail: Vec2;
  tip: Vec2;
  /** tarjeta de la sonda: se traslada y se puede invertir, pero no estirar */
  fixed?: boolean;
}

/** Baliza: el lugar al que tiene que llegar la sonda (o que hay que encontrar, si está oculta). */
export interface Beacon {
  id: string;
  pos: Vec2;
  radius: number; // m
  hidden?: boolean;
}

/** Cadena de vectores que parte de la sonda, cola con punta. */
export interface ProbeChain {
  vectors: FreeVector[];
  /** sonda, punta del primero, punta del segundo… */
  points: Vec2[];
  /** algún tramo atraviesa un muro */
  blocked: boolean;
}

/**
 * Región con su propia gravedad (un rincón donde «abajo» es hacia el lado, la Luna junto a la Tierra).
 * Dentro de ella manda su g (null = sin gravedad); afuera, la g del mundo.
 */
export interface GRegion {
  id: string;
  min: Vec2;
  max: Vec2;
  g: Vec2 | null;
  /** nombre que se muestra en la esquina («Luna», «Tierra») */
  name?: string;
}

/** Distancia (m) a la que la cola de una tarjeta se pega a la sonda o a la punta de otra. */
export const SNAP_DIST = 0.4;

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
  /** sonda que salta siguiendo vectores (posición de partida); null si el rastro no la usa */
  probe: Vec2 | null = null;
  beacons: Beacon[] = [];
  /** regiones con su propia gravedad */
  regions: GRegion[] = [];
  /** con qué cadenas llegó la sonda a una baliza en este rastro («A,B», «B,A»…), para los retos */
  probeLog: string[] = [];

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
    this.probe = null;
    this.beacons = [];
    this.probeLog = [];
    this.regions = [];
  }

  /** La región que contiene un punto (la última, si se superponen). */
  regionAt(p: Vec2): GRegion | undefined {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i];
      if (p.x >= r.min.x && p.x <= r.max.x && p.y >= r.min.y && p.y <= r.max.y) return r;
    }
    return undefined;
  }

  /** g en un punto: la de su región, o la del mundo. */
  gAt(p: Vec2): Vec2 | null {
    const r = this.regions.length ? this.regionAt(p) : undefined;
    return r ? r.g : this.g;
  }

  /** ¿Hay gravedad en alguna parte? */
  get anyG(): boolean {
    return !!this.g || this.regions.some((r) => !!r.g);
  }

  // ----- sonda -----

  /** Sigue la cadena desde la sonda: cada tarjeta cuya cola está en la punta de la anterior. */
  probeChain(): ProbeChain {
    const chain: ProbeChain = { vectors: [], points: [], blocked: false };
    if (!this.probe) return chain;
    let cur = this.probe;
    chain.points.push(cur);
    const used = new Set<string>();
    for (;;) {
      // solo las tarjetas cuentan: una flecha dibujada a mano no es una instrucción de la sonda
      const next = this.vectors.find((v) => v.fixed && !used.has(v.id) && dist(v.tail, cur) < 0.02);
      if (!next) break;
      used.add(next.id);
      chain.vectors.push(next);
      if (this.surfaces.some((s) => segmentsIntersect(next.tail, next.tip, s.a, s.b))) chain.blocked = true;
      cur = next.tip;
      chain.points.push(cur);
    }
    return chain;
  }

  /** Pega la cola de un vector a la sonda o a la punta de otro vector, si quedó cerca. */
  snapVector(v: FreeVector, tol = SNAP_DIST): boolean {
    if (!this.probe) return false;
    const spots = [this.probe, ...this.vectors.filter((o) => o !== v).map((o) => o.tip)];
    let best: Vec2 | null = null;
    let bestD = tol;
    for (const s of spots) {
      const d = dist(s, v.tail);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    if (!best) return false;
    const dx = best.x - v.tail.x;
    const dy = best.y - v.tail.y;
    v.tail = { x: best.x, y: best.y };
    v.tip = { x: v.tip.x + dx, y: v.tip.y + dy };
    return true;
  }

  /** Lo que es parte del escenario de un rastro no se borra (la boya, las tarjetas, los muros). */
  isProtected(ref: EntityRef): boolean {
    if (ref.kind === 'particle') return !!this.particle(ref.id)?.locked;
    if (ref.kind === 'vector') return !!this.vector(ref.id)?.fixed;
    if (ref.kind === 'surface') return !!this.surface(ref.id)?.locked;
    if (ref.kind === 'spring') return !!this.spring(ref.id)?.locked;
    return false;
  }

  /** Invierte una tarjeta: A → −A (misma cola, punta del otro lado). */
  flipVector(v: FreeVector): void {
    v.tip = { x: 2 * v.tail.x - v.tip.x, y: 2 * v.tail.y - v.tip.y };
    v.label = v.label.startsWith('−') ? v.label.slice(1) : `−${v.label}`;
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

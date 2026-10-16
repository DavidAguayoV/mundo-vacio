import type { Vec2 } from '../core/vec';
import { ReferenceFrame } from './frame';
import { World, type FreeVector, type Particle, type Surface, type Target, type VectorSum } from './world';

/** Formato de un experimento guardado. Cambiar `version` si cambia la forma. */
export interface WorldJSON {
  version: 1;
  frame: { origin: Vec2; angle: number } | null;
  g: Vec2 | null;
  particles: Particle[];
  vectors: FreeVector[];
  sums: VectorSum[];
  targets: Target[];
  surfaces: Surface[];
}

const v2 = (v: Vec2): Vec2 => ({ x: v.x, y: v.y });

export function worldToJSON(w: World): WorldJSON {
  return {
    version: 1,
    frame: w.frame ? w.frame.toJSON() : null,
    g: w.g ? v2(w.g) : null,
    particles: w.particles.map((p) => ({ id: p.id, label: p.label, pos: v2(p.pos), vel: v2(p.vel), mass: p.mass })),
    vectors: w.vectors.map((v) => ({ id: v.id, label: v.label, tail: v2(v.tail), tip: v2(v.tip) })),
    sums: w.sums.map((s) => ({ ...s })),
    targets: w.targets.map((t) => ({ id: t.id, pos: v2(t.pos), radius: t.radius })),
    surfaces: w.surfaces.map((s) => ({ ...s, a: v2(s.a), b: v2(s.b) })),
  };
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isVec = (v: unknown): v is Vec2 => !!v && typeof v === 'object' && isNum((v as Vec2).x) && isNum((v as Vec2).y);
const isStr = (s: unknown): s is string => typeof s === 'string' && s.length > 0;

/** Carga un experimento en `into` (o en un mundo nuevo). Lanza Error con un mensaje legible si el JSON no sirve. */
export function worldFromJSON(data: unknown, into = new World()): World {
  const d = data as Partial<WorldJSON>;
  if (!d || typeof d !== 'object' || d.version !== 1) throw new Error('No es un experimento de Mundo Vacío (versión 1).');
  const arr = <T>(a: unknown, ok: (x: any) => boolean, what: string): T[] => {
    if (a === undefined) return [];
    if (!Array.isArray(a) || !a.every(ok)) throw new Error(`El experimento tiene ${what} con datos inválidos.`);
    return a as T[];
  };
  const particles = arr<Particle>(d.particles, (p) => isStr(p?.id) && isVec(p.pos) && isVec(p.vel) && isNum(p.mass) && p.mass > 0, 'partículas');
  const vectors = arr<FreeVector>(d.vectors, (v) => isStr(v?.id) && isVec(v.tail) && isVec(v.tip), 'vectores');
  const sums = arr<VectorSum>(d.sums, (s) => isStr(s?.id) && isStr(s.a) && isStr(s.b), 'sumas');
  const targets = arr<Target>(d.targets, (t) => isStr(t?.id) && isVec(t.pos) && isNum(t.radius), 'blancos');
  const surfaces = arr<Surface>(d.surfaces, (s) => isStr(s?.id) && isVec(s.a) && isVec(s.b), 'superficies');
  if (d.frame && !(isVec(d.frame.origin) && isNum(d.frame.angle))) throw new Error('El sistema de referencia es inválido.');
  if (d.g && !isVec(d.g)) throw new Error('El campo g es inválido.');

  const w = into;
  w.clear();
  w.frame = d.frame ? new ReferenceFrame(v2(d.frame.origin), d.frame.angle) : null;
  w.g = d.g ? v2(d.g) : null;
  w.particles = particles.map((p, i) => ({ id: p.id, label: isStr(p.label) ? p.label : String(i + 1), pos: v2(p.pos), vel: v2(p.vel), mass: p.mass }));
  w.vectors = vectors.map((v, i) => ({ id: v.id, label: isStr(v.label) ? v.label : 'ABCDEFGH'[i % 8], tail: v2(v.tail), tip: v2(v.tip) }));
  const vecIds = new Set(w.vectors.map((v) => v.id));
  w.sums = sums.filter((s) => vecIds.has(s.a) && vecIds.has(s.b)).map((s) => ({ ...s }));
  w.targets = targets.map((t) => ({ id: t.id, pos: v2(t.pos), radius: t.radius }));
  w.surfaces = surfaces.map((s) => ({ id: s.id, a: v2(s.a), b: v2(s.b), muS: isNum(s.muS) ? s.muS : 0, muK: isNum(s.muK) ? s.muK : 0 }));
  w.bumpIds([...w.particles, ...w.vectors, ...w.sums, ...w.targets, ...w.surfaces].map((e) => e.id));
  return w;
}

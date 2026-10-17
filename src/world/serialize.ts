import type { Vec2 } from '../core/vec';
import { ReferenceFrame } from './frame';
import { MEDIA, type MediumId } from '../physics/forces/drag';
import type { Endpoint } from '../physics/forces/force';
import type { RigidBody } from '../physics/rigid';
import { World, type Beacon, type GRegion, type FreeVector, type Particle, type SpringLink, type Surface, type Target, type VectorSum } from './world';

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
  /** desde la fase B; los experimentos anteriores no lo traen */
  springs?: SpringLink[];
  /** desde la fase C */
  gravitation?: { G: number } | null;
  /** desde la fase D */
  medium?: MediumId | null;
  /** desde el mundo abierto: la sonda y sus balizas */
  probe?: Vec2 | null;
  beacons?: Beacon[];
  /** regiones con su propia gravedad */
  regions?: GRegion[];
  /** cuerpos rígidos */
  bodies?: RigidBody[];
}

const v2 = (v: Vec2): Vec2 => ({ x: v.x, y: v.y });

export function worldToJSON(w: World): WorldJSON {
  return {
    version: 1,
    frame: w.frame ? w.frame.toJSON() : null,
    g: w.g ? v2(w.g) : null,
    particles: w.particles.map((p) => ({ id: p.id, label: p.label, pos: v2(p.pos), vel: v2(p.vel), mass: p.mass, ...(p.locked ? { locked: true } : {}) })),
    vectors: w.vectors.map((v) => ({ id: v.id, label: v.label, tail: v2(v.tail), tip: v2(v.tip), ...(v.fixed ? { fixed: true } : {}) })),
    sums: w.sums.map((s) => ({ ...s })),
    targets: w.targets.map((t) => ({ id: t.id, pos: v2(t.pos), radius: t.radius })),
    surfaces: w.surfaces.map((s) => ({ ...s, a: v2(s.a), b: v2(s.b) })),
    springs: w.springs.map((s) => ({ id: s.id, a: endJSON(s.a), b: endJSON(s.b), k: s.k, restLength: s.restLength, ...(s.locked ? { locked: true } : {}) })),
    gravitation: w.gravitation ? { G: w.gravitation.G } : null,
    medium: w.medium,
    ...(w.probe ? { probe: v2(w.probe) } : {}),
    ...(w.bodies.length ? { bodies: w.bodies.map((b) => JSON.parse(JSON.stringify(b)) as RigidBody) } : {}),
    ...(w.regions.length ? { regions: w.regions.map((r) => ({ id: r.id, min: v2(r.min), max: v2(r.max), g: r.g ? v2(r.g) : null, ...(r.name ? { name: r.name } : {}) })) } : {}),
    ...(w.beacons.length ? { beacons: w.beacons.map((b) => ({ id: b.id, pos: v2(b.pos), radius: b.radius, ...(b.hidden ? { hidden: true } : {}) })) } : {}),
  };
}

const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
const isVec = (v: unknown): v is Vec2 => !!v && typeof v === 'object' && isNum((v as Vec2).x) && isNum((v as Vec2).y);
const isStr = (s: unknown): s is string => typeof s === 'string' && s.length > 0;
const isEnd = (e: unknown): e is Endpoint =>
  !!e && typeof e === 'object' && (isVec((e as { anchor?: unknown }).anchor) || isStr((e as { particle?: unknown }).particle));
const endJSON = (e: Endpoint): Endpoint => ('anchor' in e ? { anchor: v2(e.anchor) } : { particle: e.particle });

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
  const springs = arr<SpringLink>(d.springs, (s) => isStr(s?.id) && isEnd(s.a) && isEnd(s.b) && isNum(s.k) && s.k > 0 && isNum(s.restLength) && s.restLength >= 0, 'resortes');
  if (d.frame && !(isVec(d.frame.origin) && isNum(d.frame.angle))) throw new Error('El sistema de referencia es inválido.');
  if (d.g && !isVec(d.g)) throw new Error('El campo g es inválido.');
  if (d.gravitation && !(isNum(d.gravitation.G) && d.gravitation.G > 0)) throw new Error('La gravitación es inválida.');
  if (d.medium && !(d.medium in MEDIA)) throw new Error('El medio es inválido.');

  const w = into;
  w.clear();
  w.frame = d.frame ? new ReferenceFrame(v2(d.frame.origin), d.frame.angle) : null;
  w.g = d.g ? v2(d.g) : null;
  w.gravitation = d.gravitation ? { G: d.gravitation.G } : null;
  w.medium = d.medium ?? null;
  w.particles = particles.map((p, i) => ({ id: p.id, label: isStr(p.label) ? p.label : String(i + 1), pos: v2(p.pos), vel: v2(p.vel), mass: p.mass, ...(p.locked ? { locked: true } : {}) }));
  w.vectors = vectors.map((v, i) => ({ id: v.id, label: isStr(v.label) ? v.label : 'ABCDEFGH'[i % 8], tail: v2(v.tail), tip: v2(v.tip), ...(v.fixed ? { fixed: true } : {}) }));
  w.probe = isVec(d.probe) ? v2(d.probe) : null;
  w.regions = arr<GRegion>(d.regions, (r) => isStr(r?.id) && isVec(r.min) && isVec(r.max) && (r.g === null || isVec(r.g)), 'regiones').map((r) => ({
    id: r.id,
    min: v2(r.min),
    max: v2(r.max),
    g: r.g ? v2(r.g) : null,
    ...(isStr(r.name) ? { name: r.name } : {}),
  }));
  const shapes = ['rod', 'disc', 'ring', 'box'];
  w.bodies = arr<RigidBody>(
    d.bodies,
    (b) => isStr(b?.id) && shapes.includes(b.shape) && isNum(b.size) && b.size > 0 && isNum(b.mass) && b.mass >= 0 && isVec(b.pos) && isNum(b.angle) && Array.isArray(b.loads ?? []),
    'cuerpos',
  ).map((b) => ({
    ...(JSON.parse(JSON.stringify(b)) as RigidBody),
    vel: isVec(b.vel) ? v2(b.vel) : { x: 0, y: 0 },
    omega: isNum(b.omega) ? b.omega : 0,
    loads: (b.loads ?? []).filter((l) => isStr(l?.id) && isNum(l.s) && isNum(l.mass) && l.mass > 0),
  }));
  w.beacons = arr<Beacon>(d.beacons, (b) => isStr(b?.id) && isVec(b.pos) && isNum(b.radius), 'balizas').map((b) => ({ id: b.id, pos: v2(b.pos), radius: b.radius, ...(b.hidden ? { hidden: true } : {}) }));
  const vecIds = new Set(w.vectors.map((v) => v.id));
  w.sums = sums.filter((s) => vecIds.has(s.a) && vecIds.has(s.b)).map((s) => ({ ...s }));
  w.targets = targets.map((t) => ({ id: t.id, pos: v2(t.pos), radius: t.radius }));
  w.surfaces = surfaces.map((s) => ({ id: s.id, a: v2(s.a), b: v2(s.b), muS: isNum(s.muS) ? s.muS : 0, muK: isNum(s.muK) ? s.muK : 0, ...(s.locked ? { locked: true } : {}) }));
  const ids = new Set(w.particles.map((p) => p.id));
  const alive = (e: Endpoint) => 'anchor' in e || ids.has(e.particle);
  w.springs = springs.filter((s) => alive(s.a) && alive(s.b)).map((s) => ({ id: s.id, a: endJSON(s.a), b: endJSON(s.b), k: s.k, restLength: s.restLength, ...(s.locked ? { locked: true } : {}) }));
  w.bumpIds([...w.particles, ...w.vectors, ...w.sums, ...w.targets, ...w.surfaces, ...w.springs, ...w.beacons, ...w.regions, ...w.bodies, ...w.bodies.flatMap((b) => b.loads)].map((e) => e.id));
  return w;
}

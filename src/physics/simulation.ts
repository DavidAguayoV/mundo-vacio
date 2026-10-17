import type { Vec2 } from '../core/vec';
import type { Constraint } from './constraints';
import { forceParts, makeAccel, type Force, type ForcePart } from './forces';
import { RK4Integrator } from './integrator';
import { applyState, bodyState, stepBodies, type BodyState, type RigidWorld } from './rigid';
import { stateFromBodies, type Body, type ForceWorld, type SystemState } from './state';

export interface SimWorld extends ForceWorld {
  particles: Body[];
  /** cuerpos rígidos (opcional: los tests de partículas no los usan) */
  bodies?: RigidWorld['bodies'];
  surfaces?: RigidWorld['surfaces'];
}

interface Snapshot {
  pos: Vec2;
  vel: Vec2;
}

/**
 * Corre la física con paso fijo (1/240 s) y un acumulador de tiempo real:
 * el resultado no depende de los fps del dispositivo.
 * Guarda una "foto" del estado inicial de cada lanzamiento para poder volver a t = 0,
 * y la trayectoria estroboscópica (una marca cada 0,1 s).
 *
 * El tiempo se controla como una habilidad del jugador: fluir, detener, volver a t = 0,
 * avanzar paso a paso e ir a cualquier instante ya recorrido (seek). Como el integrador es
 * determinista, ir a un instante es volver a calcular desde t = 0 hasta él: el resultado es
 * idéntico al del primer recorrido, contactos y roce incluidos.
 */
export class Simulation {
  readonly dt = 1 / 240;
  readonly strobeSteps = 24; // 24 · (1/240 s) = 0,1 s, sin errores de redondeo
  /** Tiempo real máximo que se simula por cuadro (evita la "espiral de la muerte" tras una pestaña oculta). */
  maxFrameTime = 0.05;
  /** Cámara lenta: segundos simulados por segundo real (1 = tiempo real). */
  timeScale = 1;
  /** Duración máxima de un lanzamiento, s. */
  maxTime = 10;

  forces: Force[] = [];
  constraints: Constraint[] = [];

  t = 0;
  /** true mientras seek() recalcula el pasado: los observadores de onStep deben ignorar esos pasos */
  replaying = false;
  /** Cambia cada vez que empieza un lanzamiento nuevo (no al reanudar una pausa). */
  runId = 0;
  running = false;
  /** El lanzamiento terminó solo (tiempo máximo o todo fuera de la vista). */
  finished = false;
  trails = new Map<string, Vec2[]>();

  /** Llamado después de cada paso fijo. */
  onStep: ((sim: Simulation) => void)[] = [];
  /** Llamado al quedar en t = 0 de un lanzamiento (al empezar o al volver), no al recalcular para la línea de tiempo. */
  onRestart: ((sim: Simulation) => void)[] = [];
  /** Si devuelve true, el lanzamiento termina. */
  shouldStop: (() => boolean) | null = null;
  /** Avisa cuando cambia running/finished (para la barra de herramientas). */
  onStateChange: (() => void) | null = null;

  private integrator = new RK4Integrator();
  private acc = 0;
  private steps = 0;
  /** pasos del instante más lejano alcanzado en este lanzamiento */
  private furthestSteps = 0;
  private snapshot: Map<string, Snapshot> | null = null;
  /** estado inicial de los cuerpos rígidos del lanzamiento */
  private bodySnapshot = new Map<string, BodyState>();

  constructor(private world: SimWorld) {}

  /** Hay un lanzamiento en curso o pausado que se puede reiniciar. */
  get hasRun(): boolean {
    return this.snapshot !== null;
  }

  initialState(id: string): Snapshot | undefined {
    return this.snapshot?.get(id);
  }

  /** Estado inicial de un cuerpo rígido en el lanzamiento en curso. */
  initialBody(id: string): BodyState | undefined {
    return this.snapshot ? this.bodySnapshot.get(id) : undefined;
  }

  private get rigid(): RigidWorld | null {
    const w = this.world;
    if (!w.bodies?.length) return null;
    return { bodies: w.bodies, surfaces: w.surfaces ?? [], gAt: (p) => (w.gAt ? w.gAt(p) : w.g) };
  }

  /** Instante más lejano alcanzado en este lanzamiento (el largo de la línea de tiempo), s. */
  get duration(): number {
    return this.furthestSteps * this.dt;
  }

  /** Empieza un lanzamiento: foto del estado inicial, trayectoria vacía, contactos iniciales. */
  private begin(): void {
    if (this.finished) this.reset();
    if (this.snapshot) return;
    this.runId++;
    this.snapshot = new Map();
    for (const p of this.world.particles) this.snapshot.set(p.id, { pos: { ...p.pos }, vel: { ...p.vel } });
    this.bodySnapshot = new Map((this.world.bodies ?? []).map((b) => [b.id, bodyState(b)]));
    this.furthestSteps = 0;
    this.restart();
  }

  /** Vuelve al instante inicial del lanzamiento actual sin olvidarlo. */
  private restart(): void {
    if (!this.snapshot) return;
    for (const b of this.world.bodies ?? []) {
      const s = this.bodySnapshot.get(b.id);
      if (s) applyState(b, s);
    }
    for (const p of this.world.particles) {
      const s = this.snapshot.get(p.id);
      if (!s) continue;
      p.pos.x = s.pos.x;
      p.pos.y = s.pos.y;
      p.vel.x = s.vel.x;
      p.vel.y = s.vel.y;
    }
    this.trails.clear();
    for (const p of this.world.particles) this.trails.set(p.id, [{ ...p.pos }]);
    this.t = 0;
    this.steps = 0;
    this.acc = 0;
    const s = stateFromBodies(this.world.particles, 0);
    for (const c of this.constraints) c.begin?.(s, this.world);
    if (!this.replaying) for (const fn of this.onRestart) fn(this);
  }

  start(): void {
    this.begin();
    this.running = true;
    this.onStateChange?.();
  }

  pause(): void {
    if (!this.running) return;
    this.running = false;
    this.onStateChange?.();
  }

  toggle(): void {
    if (this.running) this.pause();
    else this.start();
  }

  /** Vuelve todas las partículas a como estaban al lanzar. */
  reset(): void {
    if (this.snapshot) {
      for (const b of this.world.bodies ?? []) {
        const s = this.bodySnapshot.get(b.id);
        if (s) applyState(b, s);
      }
      for (const p of this.world.particles) {
        const s = this.snapshot.get(p.id);
        if (!s) continue;
        p.pos.x = s.pos.x;
        p.pos.y = s.pos.y;
        p.vel.x = s.vel.x;
        p.vel.y = s.vel.y;
      }
    }
    this.clearRun();
  }

  /** Olvida el lanzamiento actual dejando las partículas donde están (por ejemplo, al editar el mundo). */
  clearRun(): void {
    const changed = this.running || this.finished || this.snapshot !== null;
    this.snapshot = null;
    this.furthestSteps = 0;
    this.trails.clear();
    for (const c of this.constraints) c.reset?.();
    this.t = 0;
    this.steps = 0;
    this.acc = 0;
    this.running = false;
    this.finished = false;
    if (changed) this.onStateChange?.();
  }

  /** Avanza exactamente `seconds` de tiempo simulado (paso a paso) y queda detenido. */
  stepBy(seconds = 0.1): void {
    this.begin();
    this.running = false;
    this.integrate(Math.round(seconds / this.dt));
    this.checkEnd();
    this.onStateChange?.();
  }

  /**
   * Va al instante t (entre 0 y el más lejano ya recorrido), hacia adelante o hacia atrás,
   * recalculando desde t = 0. Queda detenido; si después fluye, sigue desde ahí.
   */
  seek(t: number): void {
    if (!this.snapshot) return;
    const target = Math.max(0, Math.min(this.furthestSteps, Math.round(t / this.dt)));
    const keep = this.furthestSteps;
    this.replaying = true;
    try {
      this.restart();
      this.integrate(target);
    } finally {
      this.replaying = false;
    }
    this.furthestSteps = keep;
    this.running = false;
    this.finished = false;
    this.onStateChange?.();
  }

  private integrate(n: number): void {
    if (n <= 0) return;
    const s = stateFromBodies(this.world.particles, this.t);
    const accel = makeAccel(this.forces, this.world);
    for (let k = 0; k < n; k++) this.stepOnce(s, accel);
  }

  private checkEnd(): void {
    if (this.t >= this.maxTime - 1e-9 || this.shouldStop?.()) {
      this.running = false;
      this.finished = true;
    }
  }

  /** Avanza la simulación según el tiempo real transcurrido. */
  advance(realDt: number): void {
    if (!this.running) return;
    this.acc += Math.min(Math.max(realDt, 0), this.maxFrameTime) * this.timeScale;
    // tolerancia: 1/60 s debe dar exactamente 4 pasos aunque la resta en punto flotante deje 1e-18 de menos
    const due = this.dt * (1 - 1e-9);
    if (this.acc < due) return;
    const s = stateFromBodies(this.world.particles, this.t);
    const accel = makeAccel(this.forces, this.world);
    while (this.acc >= due) {
      this.acc -= this.dt;
      this.stepOnce(s, accel);
    }
    this.checkEnd();
    if (this.finished) this.onStateChange?.();
  }

  /** Normal de contacto si la partícula está apoyada en una superficie. */
  contactNormal(id: string): Vec2 | null {
    for (const c of this.constraints) {
      const n = c.contactNormal?.(id);
      if (n) return n;
    }
    return null;
  }

  /** Fuerzas sobre una partícula en el estado actual y la aceleración resultante. */
  forcesOn(id: string): { parts: ForcePart[]; accel: Vec2 } | null {
    const s = stateFromBodies(this.world.particles, this.t);
    const i = s.index.get(id);
    if (i === undefined) return null;
    const parts = forceParts(this.forces, i, s, this.world);
    const m = s.mass[i];
    const accel = parts.reduce((a, p) => ({ x: a.x + p.F.x / m, y: a.y + p.F.y / m }), { x: 0, y: 0 });
    return { parts, accel };
  }

  private stepOnce(s: SystemState, accel: ReturnType<typeof makeAccel>): void {
    const rigid = this.rigid;
    if (rigid) stepBodies(rigid, this.dt, this.t);
    this.integrator.step(s, this.dt, accel);
    for (const c of this.constraints) c.apply(s, this.world, this.dt);
    this.steps++;
    // el tiempo se cuenta en pasos: así t no acumula error de redondeo y seek() cae en el mismo instante
    this.t = s.t = this.steps * this.dt;
    if (this.steps > this.furthestSteps) this.furthestSteps = this.steps;
    if (this.steps % this.strobeSteps === 0) {
      for (const p of this.world.particles) {
        let tr = this.trails.get(p.id);
        if (!tr) this.trails.set(p.id, (tr = []));
        tr.push({ x: p.pos.x, y: p.pos.y });
      }
    }
    for (const fn of this.onStep) fn(this);
  }
}

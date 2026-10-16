import type { Vec2 } from '../core/vec';
import type { Constraint } from './constraints';
import { forceParts, makeAccel, type Force, type ForcePart } from './forces';
import { RK4Integrator } from './integrator';
import { stateFromBodies, type Body, type ForceWorld, type SystemState } from './state';

export interface SimWorld extends ForceWorld {
  particles: Body[];
}

interface Snapshot {
  pos: Vec2;
  vel: Vec2;
}

/**
 * Corre la física con paso fijo (1/240 s) y un acumulador de tiempo real:
 * el resultado no depende de los fps del dispositivo.
 * Guarda una "foto" del estado inicial de cada lanzamiento para poder reiniciarlo,
 * y la trayectoria estroboscópica (una marca cada 0,1 s).
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
  /** Cambia cada vez que empieza un lanzamiento nuevo (no al reanudar una pausa). */
  runId = 0;
  running = false;
  /** El lanzamiento terminó solo (tiempo máximo o todo fuera de la vista). */
  finished = false;
  trails = new Map<string, Vec2[]>();

  /** Llamado después de cada paso fijo. */
  onStep: ((sim: Simulation) => void)[] = [];
  /** Si devuelve true, el lanzamiento termina. */
  shouldStop: (() => boolean) | null = null;
  /** Avisa cuando cambia running/finished (para la barra de herramientas). */
  onStateChange: (() => void) | null = null;

  private integrator = new RK4Integrator();
  private acc = 0;
  private steps = 0;
  private snapshot: Map<string, Snapshot> | null = null;

  constructor(private world: SimWorld) {}

  /** Hay un lanzamiento en curso o pausado que se puede reiniciar. */
  get hasRun(): boolean {
    return this.snapshot !== null;
  }

  initialState(id: string): Snapshot | undefined {
    return this.snapshot?.get(id);
  }

  start(): void {
    if (this.finished) this.reset();
    if (!this.snapshot) {
      this.runId++;
      this.snapshot = new Map();
      this.trails.clear();
      for (const p of this.world.particles) {
        this.snapshot.set(p.id, { pos: { ...p.pos }, vel: { ...p.vel } });
        this.trails.set(p.id, [{ ...p.pos }]);
      }
      this.t = 0;
      this.steps = 0;
      this.acc = 0;
      const s = stateFromBodies(this.world.particles, 0);
      for (const c of this.constraints) c.begin?.(s, this.world);
    }
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
    this.trails.clear();
    for (const c of this.constraints) c.reset?.();
    this.t = 0;
    this.steps = 0;
    this.acc = 0;
    this.running = false;
    this.finished = false;
    if (changed) this.onStateChange?.();
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
    if (this.t >= this.maxTime - 1e-9 || this.shouldStop?.()) {
      this.running = false;
      this.finished = true;
      this.onStateChange?.();
    }
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
    this.integrator.step(s, this.dt, accel);
    for (const c of this.constraints) c.apply(s, this.world, this.dt);
    this.steps++;
    this.t = s.t;
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

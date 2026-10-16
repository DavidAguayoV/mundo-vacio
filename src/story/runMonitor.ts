import type { GameEvent } from '../core/events';
import { dist } from '../core/vec';
import type { Simulation } from '../physics/simulation';
import type { World } from '../world/world';

/** Inclinación mínima (respecto de la horizontal de g) para que una superficie cuente como pendiente. */
const MIN_INCLINE = (5 * Math.PI) / 180;
const HOLD_TIME = 0.5; // s quieta en la pendiente para "la sostiene el roce"
const SLIDE_TIME = 0.3; // s acelerando pendiente abajo para "desliza"

/**
 * Observa cada lanzamiento y traduce lo que pasa en eventos del relato:
 * fell (se alejó 1 m de donde partió), landed (se apoyó en una superficie),
 * held (quieta en una pendiente) y slid (desliza acelerando por una pendiente).
 * Cada evento se emite a lo más una vez por lanzamiento.
 */
export class RunMonitor {
  private runId = -1;
  private emitted = new Set<GameEvent['type']>();
  private lastT = 0;
  private hold = new Map<string, number>();
  private slide = new Map<string, number>();

  constructor(
    private world: World,
    private sim: Simulation,
    private emit: (ev: GameEvent) => void,
  ) {}

  update(): void {
    const { sim, world } = this;
    if (!sim.hasRun) return;
    if (sim.runId !== this.runId) {
      this.runId = sim.runId;
      this.emitted.clear();
      this.hold.clear();
      this.slide.clear();
      this.lastT = sim.t;
    }
    const dt = sim.t - this.lastT;
    this.lastT = sim.t;

    if (world.particles.some((p) => {
      const s = sim.initialState(p.id);
      return s && dist(p.pos, s.pos) > 1;
    })) this.once('fell');

    if (dt <= 0) return;
    const g = world.g;
    const gL = g ? Math.hypot(g.x, g.y) : 0;
    for (const p of world.particles) {
      const n = sim.contactNormal(p.id);
      if (!n) continue;
      this.once('landed');
      if (!g || !gL) continue;
      // ángulo entre la normal y "arriba" (−g) = inclinación de la superficie
      const incline = Math.acos(Math.max(-1, Math.min(1, -(n.x * g.x + n.y * g.y) / gL)));
      if (incline < MIN_INCLINE) continue;
      const speed = Math.hypot(p.vel.x, p.vel.y);
      this.hold.set(p.id, speed < 1e-3 ? (this.hold.get(p.id) ?? 0) + dt : 0);
      if ((this.hold.get(p.id) ?? 0) >= HOLD_TIME) this.once('held');
      const a = sim.forcesOn(p.id)?.accel;
      const speedingUp = !!a && speed > 0.3 && a.x * p.vel.x + a.y * p.vel.y > 0;
      this.slide.set(p.id, speedingUp ? (this.slide.get(p.id) ?? 0) + dt : 0);
      if ((this.slide.get(p.id) ?? 0) >= SLIDE_TIME) this.once('slid');
    }
  }

  private once(type: GameEvent['type']): void {
    if (this.emitted.has(type)) return;
    this.emitted.add(type);
    this.emit({ type } as GameEvent);
  }
}

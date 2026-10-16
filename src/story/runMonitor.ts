import type { GameEvent } from '../core/events';
import { dist } from '../core/vec';
import type { Simulation } from '../physics/simulation';
import type { World } from '../world/world';

/** Inclinación mínima (respecto de la horizontal de g) para que una superficie cuente como pendiente. */
const MIN_INCLINE = (5 * Math.PI) / 180;
const HOLD_TIME = 0.5; // s quieta en la pendiente para "la sostiene el roce"
const SLIDE_TIME = 0.3; // s acelerando pendiente abajo para "desliza"
/** Más cerca que esto (m) del cuerpo central cuenta como choque: la vuelta no vale. */
const CRASH = 0.4;

interface Orbit {
  /** ángulo anterior de la partícula vista desde el cuerpo más masivo, rad */
  angle: number;
  /** ángulo barrido acumulado, rad */
  swept: number;
  /** distancia inicial al cuerpo central, m */
  r0: number;
}

/**
 * Observa cada lanzamiento y traduce lo que pasa en eventos del relato:
 * fell (se alejó 1 m de donde partió), landed (se apoyó en una superficie),
 * held (quieta en una pendiente), slid (desliza acelerando por una pendiente),
 * orbited (dio una vuelta completa alrededor del cuerpo más masivo sin chocar) y
 * escaped (tiene energía para no volver y ya se alejó al doble de su distancia inicial).
 * Cada evento se emite a lo más una vez por lanzamiento.
 */
export class RunMonitor {
  private runId = -1;
  private emitted = new Set<GameEvent['type']>();
  private lastT = 0;
  private hold = new Map<string, number>();
  private slide = new Map<string, number>();
  private orbits = new Map<string, Orbit>();

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
      this.orbits.clear();
      this.lastT = sim.t;
    }
    const dt = sim.t - this.lastT;
    this.lastT = sim.t;

    if (world.particles.some((p) => {
      const s = sim.initialState(p.id);
      return s && dist(p.pos, s.pos) > 1;
    })) this.once('fell');

    // «sigue de largo»: algo se mueve y el tiempo lleva corriendo al menos 1 s (o el lanzamiento terminó porque salió de la vista)
    if ((sim.t >= 1 || sim.finished) && world.particles.some((p) => Math.hypot(p.vel.x, p.vel.y) > 0.3)) this.once('coasted');

    if (dt <= 0) return;
    this.watchOrbits();
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

  /** Vueltas y escapes alrededor del cuerpo más masivo, cuando hay atracción entre masas. */
  private watchOrbits(): void {
    const { world } = this;
    const grav = world.gravitation;
    if (!grav || world.particles.length < 2) return;
    const center = world.particles.reduce((a, b) => (b.mass > a.mass ? b : a));
    for (const p of world.particles) {
      if (p === center) continue;
      const rx = p.pos.x - center.pos.x;
      const ry = p.pos.y - center.pos.y;
      const r = Math.hypot(rx, ry);
      const angle = Math.atan2(ry, rx);
      let o = this.orbits.get(p.id);
      if (!o) {
        this.orbits.set(p.id, (o = { angle, swept: 0, r0: r }));
        continue;
      }
      if (r < CRASH) {
        o.swept = 0; // chocó: se empieza a contar de nuevo
      } else {
        let d = angle - o.angle;
        if (d > Math.PI) d -= 2 * Math.PI;
        if (d < -Math.PI) d += 2 * Math.PI;
        o.swept += d;
      }
      o.angle = angle;
      if (Math.abs(o.swept) >= 2 * Math.PI) this.once('orbited');
      // energía del movimiento relativo: positiva = no vuelve
      const vx = p.vel.x - center.vel.x;
      const vy = p.vel.y - center.vel.y;
      const energy = 0.5 * (vx * vx + vy * vy) - (grav.G * (p.mass + center.mass)) / r;
      if (energy > 0 && r > 2 * o.r0 && rx * vx + ry * vy > 0) this.once('escaped');
    }
  }

  private once(type: GameEvent['type']): void {
    if (this.emitted.has(type)) return;
    this.emitted.add(type);
    this.emit({ type } as GameEvent);
  }
}

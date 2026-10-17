import { fmt } from '../core/format';
import { dist, type Vec2 } from '../core/vec';
import type { Simulation } from '../physics/simulation';
import type { World } from '../world/world';

/** Distancia a la que se considera que la partícula alcanzó a la boya (m). */
export const CATCH_DIST = 0.4;

/** Qué fallos interesan ahora: los del blanco, los de la boya o ninguno. */
export interface MissWatch {
  targets: boolean;
  buoys: boolean;
}

/** El mayor acercamiento de un lanzamiento a un blanco o a una boya. */
interface Closest {
  /** distancia al borde del blanco o al radio de captura de la boya, m */
  gap: number;
  /** blanco (o boya) y partícula del acercamiento */
  key: string;
  /** frase de respaldo si no hay una mejor («llegó antes que ella», «por arriba») */
  side: string;
}

/** Posición de una partícula respecto de un blanco, medida con g: de lado (hacia el blanco) y hacia arriba. */
interface Frame {
  down: Vec2;
  /** eje de lado, desde donde partió la partícula hacia el blanco (null si partió justo encima o debajo) */
  side: Vec2 | null;
}

/**
 * Fallos que informan: durante un lanzamiento guarda el mayor acercamiento de las partículas del
 * jugador a cada blanco y a cada boya. Si el tiempo se detiene (pausa o salida de la vista) sin
 * haber acertado y el acercamiento ya quedó atrás, avisa a qué distancia pasó y por dónde:
 * «Pasó a 1,3 m del blanco, por arriba».
 *
 * Del blanco se dice por dónde cruzó su vertical (la recta por el blanco a lo largo de g): por
 * arriba o por abajo; si nunca la cruzó, se quedó corta. De la boya, si llegó antes o después que
 * ella a su camino.
 *
 * Las partículas del jugador son las que no están fijas; las boyas, las fijas que se mueven.
 */
export class MissMonitor {
  private runId = -1;
  private wasRunning = false;
  private target: Closest | null = null;
  private buoy: Closest | null = null;
  /** por dónde cruzó cada partícula la vertical de cada blanco (la primera vez) */
  private crossed = new Map<string, 'arriba' | 'abajo'>();
  /** de qué lado de la vertical estaba en el paso anterior */
  private lastSide = new Map<string, number>();
  private hit = false;
  /** lo último que se avisó en este lanzamiento (para no repetirlo en cada pausa) */
  private said = '';

  constructor(
    private world: World,
    private sim: Simulation,
    private report: (msg: string) => void,
    private watching: () => MissWatch,
  ) {}

  /** Cada paso de la simulación (no al recalcular la línea de tiempo). */
  sample(): void {
    const { sim, world } = this;
    if (sim.replaying || !sim.hasRun) return;
    this.syncRun();
    const mine = this.mine();
    for (const t of world.targets) {
      for (const p of mine) {
        const key = `${t.id}|${p.id}`;
        const d = dist(p.pos, t.pos);
        if (d < t.radius) this.hit = true;
        const f = this.frame(p.id, t.pos);
        const rel = { x: p.pos.x - t.pos.x, y: p.pos.y - t.pos.y };
        const up = f ? -(rel.x * f.down.x + rel.y * f.down.y) : 0;
        if (f?.side) {
          const s = rel.x * f.side.x + rel.y * f.side.y;
          const before = this.lastSide.get(key);
          if (before !== undefined && before < 0 && s >= 0 && !this.crossed.has(key)) this.crossed.set(key, up > 0 ? 'arriba' : 'abajo');
          this.lastSide.set(key, s);
        }
        const gap = d - t.radius;
        if (!this.target || gap < this.target.gap) this.target = { gap, key, side: f ? (up > 0 ? ', por arriba' : ', por abajo') : '' };
      }
    }
    for (const b of this.buoys()) {
      for (const p of mine) {
        const d = dist(p.pos, b.pos);
        if (d < CATCH_DIST) this.hit = true;
        const gap = d - CATCH_DIST;
        // adelante de la boya en su camino: llegó antes que ella
        const ahead = (p.pos.x - b.pos.x) * b.vel.x + (p.pos.y - b.pos.y) * b.vel.y;
        if (!this.buoy || gap < this.buoy.gap) this.buoy = { gap, key: `${b.id}|${p.id}`, side: ahead > 0 ? ': llegó antes que ella' : ': llegó después que ella' };
      }
    }
  }

  /** Cada cuadro: si el tiempo acaba de detenerse sin acertar, avisa. */
  update(): void {
    const { sim } = this;
    const running = sim.running;
    const stopped = this.wasRunning && !running;
    this.wasRunning = running;
    if (!stopped || !sim.hasRun) return;
    this.syncRun();
    const msg = this.message();
    if (msg && msg !== this.said) {
      this.said = msg;
      this.report(msg);
    }
  }

  /** El aviso para el lanzamiento en curso, o null si acertó, si no hay nada que avisar o si aún se está acercando. */
  message(): string | null {
    if (this.hit) return null;
    const w = this.watching();
    const parts: string[] = [];
    const t = this.target;
    if (w.targets && t && this.passed(t, this.gapNow('target'))) parts.push(`Pasó a ${dm(t.gap)} del blanco${this.targetSide(t)}`);
    const b = this.buoy;
    if (w.buoys && b && this.passed(b, this.gapNow('buoy'))) parts.push(`Pasó a ${dm(b.gap)} de la boya${b.side}`);
    return parts.length ? `${parts.join('. ')}.` : null;
  }

  private targetSide(c: Closest): string {
    const crossed = this.crossed.get(c.key);
    if (crossed) return `, por ${crossed}`;
    // nunca cruzó la vertical del blanco: no llegó (salvo que haya partido justo encima o debajo)
    return this.lastSide.has(c.key) ? ': se quedó corta' : c.side;
  }

  private syncRun(): void {
    if (this.sim.runId === this.runId) return;
    this.runId = this.sim.runId;
    this.target = null;
    this.buoy = null;
    this.crossed.clear();
    this.lastSide.clear();
    this.hit = false;
    this.said = '';
  }

  private mine() {
    return this.world.particles.filter((p) => !p.locked);
  }

  private buoys() {
    return this.world.particles.filter((b) => b.locked && Math.hypot(b.vel.x, b.vel.y) > 1e-6);
  }

  /** ¿El mayor acercamiento ya quedó atrás? (al pausar justo antes de llegar todavía no se puede decir que falló) */
  private passed(c: Closest, now: number | null): boolean {
    if (this.sim.finished) return true;
    return now !== null && now > c.gap + 0.05;
  }

  private gapNow(kind: 'target' | 'buoy'): number | null {
    const mine = this.mine();
    let best: number | null = null;
    if (kind === 'target') {
      for (const t of this.world.targets) for (const p of mine) best = Math.min(best ?? Infinity, dist(p.pos, t.pos) - t.radius);
    } else {
      for (const b of this.buoys()) for (const p of mine) best = Math.min(best ?? Infinity, dist(p.pos, b.pos) - CATCH_DIST);
    }
    return best;
  }

  /** Ejes para describir el paso por un blanco: abajo según g, y de lado desde el punto de partida hacia el blanco. */
  private frame(id: string, t: Vec2): Frame | null {
    const g = this.world.gAt(t);
    const gL = g ? Math.hypot(g.x, g.y) : 0;
    if (!g || !gL) return null;
    const down = { x: g.x / gL, y: g.y / gL };
    const start = this.sim.initialState(id)?.pos;
    if (!start) return { down, side: null };
    const L = { x: t.x - start.x, y: t.y - start.y };
    const along = L.x * down.x + L.y * down.y;
    const h = { x: L.x - along * down.x, y: L.y - along * down.y };
    const hL = Math.hypot(h.x, h.y);
    return { down, side: hL > 1e-6 ? { x: h.x / hL, y: h.y / hL } : null };
  }
}

/** 1,3 m; bajo 1 m, con dos decimales (0,15 m). */
const dm = (gap: number) => `${fmt(Math.max(0, gap), gap < 1 ? 2 : 1)} m`;

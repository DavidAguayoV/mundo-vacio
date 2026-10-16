import type { Simulation } from './simulation';

interface Track {
  lastL: number;
  /** cambio de largo en el primer paso (para saber si partió del reposo) */
  firstChange: number | null;
  /** +1 si el largo crecía en el paso anterior, −1 si decrecía, 0 al empezar */
  dir: number;
  /** instantes de los máximos y de los mínimos de largo */
  maxima: number[];
  minima: number[];
  minL: number;
  maxL: number;
  period: number | null;
}

/** Bajo esta amplitud (m) no se cuenta como oscilación: evita medir el temblor numérico de algo en reposo. */
const MIN_AMPLITUDE = 0.02;

/**
 * Cronómetro de oscilaciones: mide el período de cada resorte como el tiempo entre dos
 * extremos sucesivos del mismo tipo (dos máximos o dos mínimos de su largo), como haría un
 * estudiante con un cronómetro. Si la partícula parte del reposo, t = 0 ya es un extremo,
 * así que basta una oscilación. Se reinicia en cada lanzamiento e ignora los pasos
 * recalculados por la línea de tiempo.
 */
export class OscillationMeter {
  private tracks = new Map<string, Track>();
  /** instante de la última muestra: si el tiempo salta (línea de tiempo), se retoma sin inventar extremos */
  private lastT = 0;
  /** avisa la primera vez que un resorte completa una oscilación en el lanzamiento */
  onFirstPeriod: ((springId: string, period: number) => void) | null = null;

  constructor(
    private sim: Simulation,
    private lengths: () => { id: string; length: number }[],
  ) {
    sim.onRestart.push(() => this.restart());
    sim.onStep.push(() => this.step());
  }

  /** Período medido del resorte (s), o null si todavía no completa una oscilación. */
  period(springId: string): number | null {
    return this.tracks.get(springId)?.period ?? null;
  }

  /** En t = 0: anota el largo inicial de cada resorte. */
  private restart(): void {
    this.tracks.clear();
    this.lastT = 0;
    for (const { id, length } of this.lengths()) {
      this.tracks.set(id, { lastL: length, firstChange: null, dir: 0, maxima: [], minima: [], minL: length, maxL: length, period: null });
    }
  }

  private step(): void {
    const { sim } = this;
    if (sim.replaying) return;
    const prevT = sim.t - sim.dt; // instante de la muestra anterior
    const jumped = Math.abs(prevT - this.lastT) > sim.dt / 2;
    this.lastT = sim.t;
    for (const { id, length } of this.lengths()) {
      const tr = this.tracks.get(id);
      if (!tr) continue; // resorte creado a mitad de un lanzamiento: se mide en el próximo
      if (jumped) {
        // se siguió desde otro instante: se retoma la medición desde aquí
        tr.lastL = length;
        tr.dir = 0;
        tr.firstChange ??= 0;
        continue;
      }
      tr.minL = Math.min(tr.minL, length);
      tr.maxL = Math.max(tr.maxL, length);
      const change = length - tr.lastL;
      tr.lastL = length;
      if (tr.firstChange === null) {
        tr.firstChange = change;
        tr.dir = Math.sign(change);
        continue;
      }
      if (tr.maxima.length + tr.minima.length === 0 && tr.dir !== 0 && prevT <= sim.dt * 1.5) {
        // segundo paso: desde el reposo, el largo cambia cerca de 3 veces más que en el primero
        // (x ∝ t²); con velocidad inicial, casi lo mismo. Si partió del reposo, t = 0 fue un extremo.
        if (Math.sign(change) === tr.dir && Math.abs(change) > 2 * Math.abs(tr.firstChange)) {
          (tr.dir < 0 ? tr.maxima : tr.minima).push(0);
        }
      }
      const d = Math.sign(change);
      if (d === 0) continue;
      if (tr.dir > 0 && d < 0) {
        tr.maxima.push(prevT);
        this.measure(id, tr, tr.maxima);
      } else if (tr.dir < 0 && d > 0) {
        tr.minima.push(prevT);
        this.measure(id, tr, tr.minima);
      }
      tr.dir = d;
    }
  }

  private measure(id: string, tr: Track, times: number[]): void {
    if (times.length < 2 || tr.maxL - tr.minL < MIN_AMPLITUDE) return;
    const first = tr.period === null;
    tr.period = times[times.length - 1] - times[times.length - 2];
    if (first) this.onFirstPeriod?.(id, tr.period);
  }
}

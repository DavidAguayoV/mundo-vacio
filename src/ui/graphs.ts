import { fmt } from '../core/format';
import type { Vec2 } from '../core/vec';
import type { Simulation } from '../physics/simulation';
import { IDENTITY_FRAME } from '../world/frame';
import type { World } from '../world/world';
import { $, h, setText } from './dom';

const NS = 'http://www.w3.org/2000/svg';
/** Tamaño de cada gráfico (unidades del viewBox; se escala con el panel). */
const W = 120;
const H = 66;
const PAD_L = 4;
/** espacio a la derecha para el máximo y el mínimo, fuera del trazo */
const PAD_R = 22;
const PAD_T = 6;
const PAD_B = 6;
/** Una muestra cada 4 pasos de 1/240 s: 60 por segundo simulado. */
const SAMPLE_STEPS = 4;

/** Lo que se grafica: posición (neutro) o velocidad (cian), en los ejes del jugador. */
interface Series {
  key: 'x' | 'y' | 'vx' | 'vy';
  /** nombre de la magnitud (va en la serif, como en la pizarra) */
  sym: string;
  sub: string;
  unit: string;
  cls: 'pos' | 'vel';
}

const SERIES: Series[] = [
  { key: 'x', sym: 'x', sub: '', unit: 'm', cls: 'pos' },
  { key: 'y', sym: 'y', sub: '', unit: 'm', cls: 'pos' },
  { key: 'vx', sym: 'v', sub: 'x', unit: 'm/s', cls: 'vel' },
  { key: 'vy', sym: 'v', sub: 'y', unit: 'm/s', cls: 'vel' },
];

/** Muestras de un lanzamiento: posición y velocidad globales de cada partícula. */
interface Track {
  t: number[];
  pos: Vec2[];
  vel: Vec2[];
}

interface Chart {
  s: Series;
  svg: SVGSVGElement;
  zero: SVGLineElement;
  line: SVGPathElement;
  now: SVGLineElement;
  dot: SVGCircleElement;
  hover: SVGLineElement;
  hi: SVGTextElement;
  lo: SVGTextElement;
}

/**
 * Lente «Gráficos»: x(t), y(t), vₓ(t) y v_y(t) de la partícula elegida, en tus ejes. La línea de
 * tiempo es el cursor de los cuatro; al pasar el puntero se lee el valor y al tocar se va a ese instante.
 */
export class GraphsPanel {
  private el: HTMLElement;
  private sub = h('span', { class: 'who' });
  private readout = h('p', { class: 'readout' });
  private empty = h('p', { class: 'note' }, 'Deja fluir el tiempo para dibujar los gráficos.');
  private grid = h('div', { class: 'charts' });
  private charts: Chart[] = [];
  private tracks = new Map<string, Track>();
  private runId = -1;
  private lastKey = '';
  /** instante bajo el puntero (null si no está sobre un gráfico) */
  private hoverT: number | null = null;
  private span = 1;

  constructor(
    private sim: Simulation,
    private world: World,
    private onSeek: (t: number) => void,
  ) {
    this.el = h('aside', { class: 'graphs', hidden: '', 'aria-label': 'Gráficos de la partícula elegida' }, h('h2', {}, 'Gráficos ', this.sub));
    for (const s of SERIES) this.charts.push(this.makeChart(s));
    this.el.append(this.empty, this.grid, this.readout);
    $('dock').append(this.el);
    sim.onStep.push(() => this.sample());
  }

  private makeChart(s: Series): Chart {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', `${s.sym}${s.sub ? `_${s.sub}` : ''} en función del tiempo`);
    const el = <K extends keyof SVGElementTagNameMap>(tag: K, cls: string) => {
      const e = document.createElementNS(NS, tag);
      e.setAttribute('class', cls);
      svg.append(e);
      return e;
    };
    const zero = el('line', 'zero');
    const line = el('path', `line ${s.cls}`);
    const hover = el('line', 'hover');
    const now = el('line', 'now');
    const dot = el('circle', `dot ${s.cls}`);
    dot.setAttribute('r', '3');
    const hi = el('text', 'tick');
    const lo = el('text', 'tick');
    hi.setAttribute('x', String(W - PAD_R + 3));
    lo.setAttribute('x', String(W - PAD_R + 3));
    hi.setAttribute('y', String(PAD_T + 3));
    lo.setAttribute('y', String(H - PAD_B));
    const title = h('div', { class: 'chart-title' }, h('i', {}, s.sym), ...(s.sub ? [h('sub', {}, s.sub)] : []), '(', h('i', {}, 't'), ')', h('span', { class: 'unit' }, ` ${s.unit}`));
    const box = h('figure', { class: 'chart' }, title);
    box.append(svg);
    this.grid.append(box);
    // puntero: crosshair y lectura; tocar va a ese instante
    const tAt = (e: PointerEvent | MouseEvent) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      return Math.min(1, Math.max(0, (px - PAD_L) / (W - PAD_L - PAD_R))) * this.span;
    };
    svg.addEventListener('pointermove', (e) => {
      this.hoverT = tAt(e);
      this.lastKey = '';
    });
    svg.addEventListener('pointerleave', () => {
      this.hoverT = null;
      this.lastKey = '';
    });
    svg.addEventListener('click', (e) => this.onSeek(tAt(e)));
    return { s, svg, zero, line, now, dot, hover, hi, lo };
  }

  /** Cada paso de la simulación: una muestra cada 1/60 s, solo hacia adelante (al recalcular el pasado no se duplica). */
  private sample(): void {
    const sim = this.sim;
    if (sim.runId !== this.runId) {
      this.runId = sim.runId;
      this.tracks.clear();
    }
    const steps = Math.round(sim.t / sim.dt);
    if (steps % SAMPLE_STEPS !== 0) return;
    for (const p of this.world.particles) {
      let tr = this.tracks.get(p.id);
      if (!tr) {
        // el punto de partida, para que el gráfico empiece en t = 0
        const s0 = sim.initialState(p.id);
        tr = { t: s0 ? [0] : [], pos: s0 ? [{ ...s0.pos }] : [], vel: s0 ? [{ ...s0.vel }] : [] };
        this.tracks.set(p.id, tr);
      }
      if (tr.t.length && sim.t <= tr.t[tr.t.length - 1] + 1e-9) continue;
      tr.t.push(sim.t);
      tr.pos.push({ ...p.pos });
      tr.vel.push({ ...p.vel });
    }
  }

  /** La partícula que se grafica: la elegida, o la primera. */
  private target(selected: string | null): { id: string; label: string } | null {
    const p = (selected && this.world.particle(selected)) || this.world.particles[0];
    return p ? { id: p.id, label: p.label } : null;
  }

  update(visible: boolean, selected: string | null): void {
    if (this.el.hidden === visible) this.el.hidden = !visible;
    if (!visible) return;
    if (!this.sim.hasRun) this.tracks.clear();
    const who = this.target(selected);
    const tr = who ? this.tracks.get(who.id) : undefined;
    const frame = this.world.frame ?? IDENTITY_FRAME;
    const key = `${who?.id}|${tr?.t.length ?? 0}|${this.sim.t.toFixed(4)}|${this.hoverT?.toFixed(3)}|${frame.angle}|${frame.origin.x}|${frame.origin.y}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    setText(this.sub, who ? `de la partícula ${who.label}` : '');
    const has = !!tr && tr.t.length > 1;
    this.empty.hidden = has;
    this.grid.hidden = !has;
    this.readout.hidden = !has;
    if (!has || !tr) return;

    // en tus ejes, con el sistema de referencia de ahora
    const vals: Record<Series['key'], number[]> = { x: [], y: [], vx: [], vy: [] };
    for (let i = 0; i < tr.t.length; i++) {
      const u = frame.pointToUser(tr.pos[i]);
      const v = frame.toUser(tr.vel[i]);
      vals.x.push(u.x);
      vals.y.push(u.y);
      vals.vx.push(v.x);
      vals.vy.push(v.y);
    }
    this.span = Math.max(this.sim.duration, tr.t[tr.t.length - 1], 0.5);
    const sx = (t: number) => PAD_L + (t / this.span) * (W - PAD_L - PAD_R);
    const tNow = Math.min(this.sim.t, tr.t[tr.t.length - 1]);
    const idx = (t: number) => {
      // la muestra más cercana a t (están ordenadas)
      let lo = 0;
      let hi = tr.t.length - 1;
      while (hi - lo > 1) {
        const m = (lo + hi) >> 1;
        if (tr.t[m] < t) lo = m;
        else hi = m;
      }
      return Math.abs(tr.t[lo] - t) <= Math.abs(tr.t[hi] - t) ? lo : hi;
    };
    const iNow = idx(tNow);
    const iHover = this.hoverT === null ? null : idx(this.hoverT);
    const read: string[] = [`t = ${fmt(iHover === null ? tNow : tr.t[iHover])} s`];
    // cada par «magnitud = valor» en un trozo que no se corta

    for (const c of this.charts) {
      const ys = vals[c.s.key];
      let min = Math.min(...ys);
      let max = Math.max(...ys);
      if (max - min < 0.2) {
        // casi constante: un margen fijo, para que una recta plana se vea plana y no ruidosa
        const mid = (max + min) / 2;
        min = mid - 0.5;
        max = mid + 0.5;
      }
      const sy = (y: number) => H - PAD_B - ((y - min) / (max - min)) * (H - PAD_T - PAD_B);
      let d = '';
      for (let i = 0; i < ys.length; i++) d += `${i ? 'L' : 'M'}${sx(tr.t[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`;
      c.line.setAttribute('d', d);
      const z = min <= 0 && max >= 0 ? sy(0) : -10;
      for (const [a, b] of [
        ['x1', PAD_L],
        ['x2', W - PAD_R],
        ['y1', z],
        ['y2', z],
      ] as const)
        c.zero.setAttribute(a, String(b));
      const xn = sx(tr.t[iNow]);
      setLine(c.now, xn, PAD_T - 2, xn, H - PAD_B + 2);
      c.dot.setAttribute('cx', xn.toFixed(1));
      c.dot.setAttribute('cy', sy(ys[iNow]).toFixed(1));
      if (iHover === null) c.hover.setAttribute('visibility', 'hidden');
      else {
        c.hover.removeAttribute('visibility');
        const xh = sx(tr.t[iHover]);
        setLine(c.hover, xh, PAD_T - 2, xh, H - PAD_B + 2);
      }
      setText(c.hi, fmt(max, 1));
      setText(c.lo, fmt(min, 1));
      const v = ys[iHover ?? iNow];
      read.push(`${c.s.sym}${c.s.sub ? subOf(c.s.sub) : ''} = ${fmt(v)} ${c.s.unit}`);
    }
    const key2 = read.join('|');
    if (this.readout.dataset.k !== key2) {
      this.readout.dataset.k = key2;
      this.readout.replaceChildren(...read.map((r) => h('span', {}, r)));
    }
  }
}

const subOf = (s: string) => ({ x: 'ₓ', y: 'ᵧ' })[s] ?? s;

function setLine(l: SVGLineElement, x1: number, y1: number, x2: number, y2: number): void {
  l.setAttribute('x1', x1.toFixed(1));
  l.setAttribute('y1', y1.toFixed(1));
  l.setAttribute('x2', x2.toFixed(1));
  l.setAttribute('y2', y2.toFixed(1));
}

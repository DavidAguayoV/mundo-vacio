import { fmt } from '../core/format';
import type { Vec2 } from '../core/vec';
import { systemEnergy, type EnergyBreakdown } from '../physics/energy';
import type { Simulation } from '../physics/simulation';
import type { World } from '../world/world';
import { $, h, setText } from './dom';

type BarKey = 'K' | 'Ug' | 'Ue' | 'UG' | 'total';

const BARS: { key: BarKey; label: string; cls: string; title: string }[] = [
  { key: 'K', label: 'K', cls: 'k', title: 'Energía cinética, ½ m v²' },
  { key: 'Ug', label: 'Ug', cls: 'ug', title: 'Energía potencial gravitatoria, m g h (h desde tu origen)' },
  { key: 'Ue', label: 'Ue', cls: 'ue', title: 'Energía elástica de los resortes, ½ k ΔL²' },
  { key: 'UG', label: 'UG', cls: 'uG', title: 'Energía potencial de la atracción entre masas' },
  { key: 'total', label: 'Total', cls: 'tot', title: 'Suma de todas' },
];

const NS = 'http://www.w3.org/2000/svg';
const W = 216;
const H = 104; // alto del área de barras
const PAD = 14; // espacio para los números arriba y abajo

interface BarEls {
  rect: SVGRectElement;
  value: SVGTextElement;
}

/**
 * Medidor de energía del sistema completo (el lente «Energía»). Usa una escala fija durante
 * cada lanzamiento —la mayor energía vista—, así las barras no saltan al mover la línea de tiempo.
 */
export class EnergyMeter {
  private el: HTMLElement;
  private svg: SVGSVGElement;
  private zero: SVGLineElement;
  private bars = new Map<BarKey, BarEls>();
  private shown = '';
  private runKey = '';
  private posMax = 0;
  private negMax = 0;

  constructor() {
    this.svg = document.createElementNS(NS, 'svg');
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H + 2 * PAD + 14}`);
    this.svg.setAttribute('role', 'img');
    this.svg.setAttribute('aria-label', 'Barras de energía del sistema');
    this.zero = document.createElementNS(NS, 'line');
    this.zero.setAttribute('class', 'zero');
    this.el = h('aside', { class: 'energy', hidden: '' }, h('h2', {}, 'Energía del sistema'));
    this.el.append(this.svg);
    $('dock').prepend(this.el);
  }

  update(visible: boolean, world: World, sim: Simulation): void {
    if (this.el.hidden === visible) this.el.hidden = !visible;
    if (!visible) return;
    const origin: Vec2 = world.frame?.origin ?? { x: 0, y: 0 };
    const e = systemEnergy(world, origin);

    const keys = BARS.filter(
      (b) =>
        b.key === 'K' ||
        b.key === 'total' ||
        (b.key === 'Ug' && !!world.g) ||
        (b.key === 'Ue' && world.springs.length > 0) ||
        (b.key === 'UG' && !!world.gravitation && world.particles.length > 1),
    );
    const shown = keys.map((b) => b.key).join(',');
    if (shown !== this.shown) this.build(keys);

    // escala: la de todo el lanzamiento; sin lanzamiento, la del instante
    const runKey = sim.hasRun ? `run${sim.runId}` : 'quieto';
    const vals = keys.map((b) => e[b.key as keyof EnergyBreakdown]);
    const hiNow = Math.max(0, ...vals);
    const loNow = Math.max(0, ...vals.map((v) => -v));
    if (runKey !== this.runKey || runKey === 'quieto' || shown !== this.shown) {
      this.runKey = runKey;
      this.posMax = hiNow;
      this.negMax = loNow;
    } else {
      this.posMax = Math.max(this.posMax, hiNow);
      this.negMax = Math.max(this.negMax, loNow);
    }
    this.shown = shown;

    const span = this.posMax + this.negMax || 1;
    const y0 = PAD + (H * this.posMax) / span;
    this.zero.setAttribute('y1', String(y0));
    this.zero.setAttribute('y2', String(y0));
    for (const b of keys) {
      const v = e[b.key as keyof EnergyBreakdown];
      const els = this.bars.get(b.key)!;
      const len = (H * Math.abs(v)) / span;
      els.rect.setAttribute('y', String(v >= 0 ? y0 - len : y0));
      els.rect.setAttribute('height', String(Math.max(len, 0.5)));
      els.value.setAttribute('y', String(v >= 0 ? y0 - len - 3 : y0 + len + 10));
      setText(els.value, fmt(v, 1));
    }
  }

  private build(keys: typeof BARS): void {
    this.svg.replaceChildren();
    this.bars.clear();
    const n = keys.length;
    const slot = W / n;
    const bw = Math.min(30, slot * 0.6);
    this.zero.setAttribute('x1', '0');
    this.zero.setAttribute('x2', String(W));
    this.svg.append(this.zero);
    keys.forEach((b, i) => {
      const cx = slot * i + slot / 2;
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', String(cx - bw / 2));
      rect.setAttribute('width', String(bw));
      rect.setAttribute('rx', '2');
      rect.setAttribute('class', `bar ${b.cls}`);
      const title = document.createElementNS(NS, 'title');
      title.textContent = b.title;
      rect.append(title);
      const value = document.createElementNS(NS, 'text');
      value.setAttribute('x', String(cx));
      value.setAttribute('class', 'val');
      const label = document.createElementNS(NS, 'text');
      label.setAttribute('x', String(cx));
      label.setAttribute('y', String(H + 2 * PAD + 10));
      label.setAttribute('class', `lab ${b.cls}`);
      label.textContent = b.label;
      this.svg.append(rect, value, label);
      this.bars.set(b.key, { rect, value });
    });
    const unit = document.createElementNS(NS, 'text');
    unit.setAttribute('x', String(W));
    unit.setAttribute('y', '9');
    unit.setAttribute('class', 'unit');
    unit.textContent = 'J';
    this.svg.append(unit);
  }
}

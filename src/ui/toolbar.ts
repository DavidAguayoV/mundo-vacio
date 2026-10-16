import type { ForceSwitch, TimeSkill } from '../story/types';
import { ICONS } from '../tools/icons';
import type { Tool, ToolId } from '../tools/tool';
import { $, h } from './dom';

export interface ToolbarState {
  tools: Tool[];
  active: ToolId;
  /** interruptores de fuerza ganados y si están encendidos */
  switches?: { id: ForceSwitch; on: boolean; label?: string }[];
  /** habilidades del tiempo ganadas: cada una agrega su control */
  time: ReadonlySet<TimeSkill>;
  /** botón Laboratorio (solo en modo libre) */
  labEnabled?: boolean;
  running: boolean;
  timeScale: number;
  /** herramientas o habilidades recién ganadas: brillan un momento */
  fresh?: readonly string[];
}

export interface ToolbarActions {
  selectTool(id: ToolId): void;
  flow(): void;
  rewind(): void;
  step(): void;
  slow(): void;
  toggleForce(id: ForceSwitch): void;
  openTree(): void;
  openLab(): void;
}

export const TIME_NAMES: Record<TimeSkill, string> = {
  flow: 'Tiempo',
  rewind: 'Volver a t = 0',
  step: 'Paso a paso',
  slow: 'Cámara lenta',
  timeline: 'Línea de tiempo',
};

export const SWITCH_NAMES: Record<ForceSwitch, string> = {
  gravitation: 'Atracción',
  drag: 'Medio',
};

const scaleLabel = (k: number) => (k === 0.5 ? '×½' : k === 0.25 ? '×¼' : '×1');

/** Caja de herramientas: herramientas ganadas, controles del tiempo ganados y acceso al árbol. */
export class Toolbar {
  private bar = $('bar');
  private flowBtn: HTMLButtonElement | null = null;
  private slowBtn: HTMLButtonElement | null = null;

  constructor(private actions: ToolbarActions) {}

  private button(icon: string, label: string, fn: () => void, extra: Record<string, string> = {}): HTMLButtonElement {
    const b = h('button', { class: 'tool', type: 'button', ...extra });
    b.innerHTML = icon;
    b.append(h('span', {}, label));
    b.addEventListener('click', fn);
    return b;
  }

  render(s: ToolbarState): void {
    const fresh = new Set(s.fresh ?? []);
    const items: Node[] = [];
    for (const t of s.tools) {
      const b = this.button(t.icon, t.name, () => this.actions.selectTool(t.id), {
        'data-tool': t.id,
        'aria-pressed': String(t.id === s.active),
      });
      if (fresh.has(`tool:${t.id}`)) b.classList.add('new');
      items.push(b);
    }
    if (s.switches?.length) {
      items.push(h('span', { class: 'sep' }));
      for (const sw of s.switches) {
        const b = this.button(ICONS[sw.id], sw.label ?? SWITCH_NAMES[sw.id], () => this.actions.toggleForce(sw.id), {
          'data-switch': sw.id,
          'aria-pressed': String(sw.on),
        });
        b.title = sw.label ?? `${SWITCH_NAMES[sw.id]}: ${sw.on ? 'encendida' : 'apagada'}`;
        if (fresh.has(`force:${sw.id}`)) b.classList.add('new');
        items.push(b);
      }
    }
    this.flowBtn = null;
    this.slowBtn = null;
    if (s.time.size) {
      items.push(h('span', { class: 'sep' }));
      const add = (skill: TimeSkill, b: HTMLButtonElement) => {
        if (fresh.has(`time:${skill}`)) b.classList.add('new');
        b.title = TIME_NAMES[skill];
        items.push(b);
      };
      if (s.time.has('flow')) add('flow', (this.flowBtn = this.button('', '', this.actions.flow, { 'data-cmd': 'flow' })));
      if (s.time.has('rewind')) add('rewind', this.button(ICONS.reset, 't = 0', this.actions.rewind, { 'data-cmd': 'rewind' }));
      if (s.time.has('step')) add('step', this.button(ICONS.step, '+0,1 s', this.actions.step, { 'data-cmd': 'step' }));
      if (s.time.has('slow')) add('slow', (this.slowBtn = this.button('', '', this.actions.slow, { 'data-cmd': 'slow' })));
      this.setRunning(s.running);
      this.setScale(s.timeScale);
    }
    items.push(h('span', { class: 'sep' }));
    if (s.labEnabled) items.push(this.button(ICONS.lab, 'Lab', this.actions.openLab, { 'data-cmd': 'lab' }));
    items.push(this.button(ICONS.tree, 'Árbol', this.actions.openTree, { 'data-cmd': 'tree' }));
    this.bar.replaceChildren(...items);
  }

  setActive(id: ToolId): void {
    this.bar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.tool === id));
    });
  }

  setRunning(running: boolean): void {
    const b = this.flowBtn;
    if (!b) return;
    b.innerHTML = running ? ICONS.pause : ICONS.play;
    b.append(h('span', {}, running ? 'Detener' : 'Tiempo'));
    b.setAttribute('aria-pressed', String(running));
  }

  setSwitch(id: ForceSwitch, on: boolean, label?: string): void {
    const b = this.bar.querySelector<HTMLButtonElement>(`[data-switch="${id}"]`);
    if (!b) return;
    if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
    const span = b.querySelector('span');
    const text = label ?? SWITCH_NAMES[id];
    if (span && span.textContent !== text) span.textContent = text;
    b.title = label ?? `${SWITCH_NAMES[id]}: ${on ? 'encendida' : 'apagada'}`;
  }

  setScale(k: number): void {
    const b = this.slowBtn;
    if (!b) return;
    b.innerHTML = ICONS.slow;
    b.append(h('span', {}, `Lenta ${scaleLabel(k)}`));
    b.setAttribute('aria-pressed', String(k < 1));
  }
}

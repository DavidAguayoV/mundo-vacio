import type { ForceSwitch, Grant, LensId, TimeSkill } from '../story/types';
import { ICONS } from '../tools/icons';
import type { Tool, ToolId } from '../tools/tool';
import { $, h } from './dom';

export interface ToolbarState {
  tools: Tool[];
  active: ToolId;
  /** interruptores de fuerza ganados y si están encendidos */
  switches?: { id: ForceSwitch; on: boolean; label?: string }[];
  /** lentes ganados y si están activos */
  lenses?: { id: LensId; on: boolean }[];
  /** habilidades del tiempo ganadas: cada una agrega su control */
  time: ReadonlySet<TimeSkill>;
  /** botón Laboratorio (solo en modo libre) */
  labEnabled?: boolean;
  /** botón Mapa (dentro de un rastro o en modo libre) */
  mapEnabled?: boolean;
  running: boolean;
  timeScale: number;
  /** herramientas o habilidades recién ganadas: brillan un momento */
  fresh?: readonly string[];
  /** lo que pide la tarjeta (Step.tool): queda a la vista, fuera de «Más», y destacado */
  wanted?: Grant | null;
}

/** El botón de la barra que corresponde a algo que se gana («tool:velocity» → [data-tool="velocity"]). */
function selectorOf(g: Grant): string | null {
  const [kind, id] = g.split(':');
  if (kind === 'tool') return `[data-tool="${id}"]`;
  if (kind === 'force') return `[data-switch="${id}"]`;
  if (kind === 'lens') return `[data-lens="${id}"]`;
  // la línea de tiempo no está en la barra
  if (kind === 'time' && id !== 'timeline') return `[data-cmd="${id}"]`;
  return null;
}

export interface ToolbarActions {
  selectTool(id: ToolId): void;
  flow(): void;
  rewind(): void;
  step(): void;
  slow(): void;
  toggleForce(id: ForceSwitch): void;
  toggleLens(id: LensId): void;
  openTree(): void;
  openLab(): void;
  openMap(): void;
  openJournal(): void;
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

export const LENS_NAMES: Record<LensId, string> = {
  energy: 'Energía',
  graphs: 'Gráficos',
};

const scaleLabel = (k: number) => (k === 0.5 ? '×½' : k === 0.25 ? '×¼' : '×1');

/** Con pocas herramientas (el comienzo del relato) los botones llevan su nombre a la vista. */
const LABELED_MAX = 3;

/**
 * Caja de herramientas en tres zonas: herramientas a la izquierda, el tiempo al centro y el árbol
 * (y el laboratorio) a la derecha. Los íconos muestran su nombre al pasar el mouse o al enfocarlos;
 * si no caben, las herramientas que sobran pasan a un menú «Más».
 */
export class Toolbar {
  private bar = $('bar');
  private toolsZone = h('div', { class: 'zone tools' });
  private timeZone = h('div', { class: 'zone time', role: 'group', 'aria-label': 'Tiempo' });
  private metaZone = h('div', { class: 'zone meta' });
  private more: HTMLButtonElement;
  private menu = h('div', { class: 'menu', id: 'toolMenu', role: 'group', 'aria-label': 'Más herramientas', hidden: '' });
  private toolItems: HTMLButtonElement[] = [];
  private metaItems: HTMLButtonElement[] = [];
  private flowBtn: HTMLButtonElement | null = null;
  private slowBtn: HTMLButtonElement | null = null;

  constructor(private actions: ToolbarActions) {
    this.more = this.button(ICONS.more, 'Más herramientas', () => this.setMenu(this.menu.hidden), {
      'aria-expanded': 'false',
      'aria-controls': 'toolMenu',
      'data-cmd': 'more',
    });
    // con los nombres a la vista basta «Más»; el nombre completo queda para los lectores de pantalla
    this.more.querySelector('.tip')!.textContent = 'Más';
    this.toolsZone.append(this.menu);
    this.bar.replaceChildren(this.toolsZone, this.timeZone, this.metaZone);
    // elegir algo en el menú lo cierra
    this.menu.addEventListener('click', (e) => {
      if ((e.target as Element).closest('button')) this.setMenu(false);
    });
    document.addEventListener('pointerdown', (e) => {
      if (!this.menu.hidden && !this.menu.contains(e.target as Node) && !this.more.contains(e.target as Node)) this.setMenu(false);
    });
    this.bar.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.menu.hidden) {
        e.stopPropagation();
        this.setMenu(false);
        this.more.focus();
      }
    });
    new ResizeObserver(() => this.layout()).observe(this.bar);
  }

  private button(icon: string, label: string, fn: () => void, extra: Record<string, string> = {}): HTMLButtonElement {
    const b = h('button', { class: 'tool', type: 'button', 'aria-label': label, ...extra });
    b.append(h('span', { class: 'ico' }), h('span', { class: 'tip', 'aria-hidden': 'true' }, label));
    b.querySelector('.ico')!.innerHTML = icon;
    b.addEventListener('click', fn);
    return b;
  }

  private setLabel(b: HTMLButtonElement, label: string): void {
    if (b.getAttribute('aria-label') !== label) b.setAttribute('aria-label', label);
    const tip = b.querySelector('.tip');
    if (tip && tip.textContent !== label) tip.textContent = label;
  }

  private setIcon(b: HTMLButtonElement, icon: string): void {
    const ico = b.querySelector('.ico');
    if (ico && ico.innerHTML !== icon) ico.innerHTML = icon;
  }

  private setMenu(open: boolean): void {
    this.menu.hidden = !open;
    this.more.setAttribute('aria-expanded', String(open));
  }

  render(s: ToolbarState): void {
    const fresh = new Set(s.fresh ?? []);
    this.toolItems = [];
    for (const t of s.tools) {
      const b = this.button(t.icon, t.name, () => this.actions.selectTool(t.id), {
        'data-tool': t.id,
        'aria-pressed': String(t.id === s.active),
      });
      if (fresh.has(`tool:${t.id}`)) b.classList.add('new');
      this.toolItems.push(b);
    }
    for (const sw of s.switches ?? []) {
      const b = this.button(ICONS[sw.id], sw.label ?? SWITCH_NAMES[sw.id], () => this.actions.toggleForce(sw.id), {
        'data-switch': sw.id,
        'aria-pressed': String(sw.on),
      });
      b.classList.add('switch');
      if (fresh.has(`force:${sw.id}`)) b.classList.add('new');
      this.toolItems.push(b);
    }
    for (const l of s.lenses ?? []) {
      const b = this.button(ICONS[l.id], `Lente ${LENS_NAMES[l.id]}`, () => this.actions.toggleLens(l.id), {
        'data-lens': l.id,
        'aria-pressed': String(l.on),
      });
      b.classList.add('switch');
      if (fresh.has(`lens:${l.id}`)) b.classList.add('new');
      this.toolItems.push(b);
    }

    this.flowBtn = null;
    this.slowBtn = null;
    const time: HTMLButtonElement[] = [];
    const add = (skill: TimeSkill, b: HTMLButtonElement) => {
      if (fresh.has(`time:${skill}`)) b.classList.add('new');
      time.push(b);
    };
    if (s.time.has('rewind')) add('rewind', this.button(ICONS.reset, 't = 0', this.actions.rewind, { 'data-cmd': 'rewind' }));
    if (s.time.has('flow')) {
      this.flowBtn = this.button(ICONS.play, 'Dejar fluir el tiempo', this.actions.flow, { 'data-cmd': 'flow' });
      this.flowBtn.classList.add('play');
      add('flow', this.flowBtn);
    }
    if (s.time.has('step')) add('step', this.button(ICONS.step, '+0,1 s', this.actions.step, { 'data-cmd': 'step' }));
    if (s.time.has('slow')) {
      this.slowBtn = this.button(ICONS.slow, 'Cámara lenta', this.actions.slow, { 'data-cmd': 'slow' });
      this.slowBtn.append(h('span', { class: 'badge', 'aria-hidden': 'true' }));
      add('slow', this.slowBtn);
    }
    this.timeZone.replaceChildren(...time);
    this.setRunning(s.running);
    this.setScale(s.timeScale);

    this.metaItems = [];
    if (s.labEnabled) this.metaItems.push(this.button(ICONS.lab, 'Lab', this.actions.openLab, { 'data-cmd': 'lab' }));
    if (s.mapEnabled) this.metaItems.push(this.button(ICONS.map, 'Mapa', this.actions.openMap, { 'data-cmd': 'map' }));
    this.metaItems.push(this.button(ICONS.journal, 'Bitácora', this.actions.openJournal, { 'data-cmd': 'journal' }));
    this.metaItems.push(this.button(ICONS.tree, 'Árbol', this.actions.openTree, { 'data-cmd': 'tree' }));

    const labeled = s.tools.length <= LABELED_MAX && !s.switches?.length && !s.lenses?.length;
    this.bar.classList.toggle('labeled', labeled);
    // dentro de un rastro (con herramientas y tiempo), a la derecha basta un botón: el resto va a «Más»
    this.bar.classList.toggle('working', s.tools.length > 0 && s.time.size > 0);
    // lo que pide la tarjeta se destaca (y layout() no lo manda a «Más»)
    const sel = s.wanted ? selectorOf(s.wanted) : null;
    for (const b of [...this.toolItems, ...time]) {
      const want = !!sel && b.matches(sel);
      b.classList.toggle('wanted', want);
      if (want) b.setAttribute('aria-description', 'La tarjeta pide usar esto');
      else b.removeAttribute('aria-description');
    }
    this.setMenu(false);
    this.layout();
  }

  /** Reparte los botones: lo que no cabe en la zona de herramientas pasa al menú «Más». */
  private layout(): void {
    const tools = this.toolsZone;
    tools.replaceChildren(...this.toolItems, this.menu);
    this.metaZone.replaceChildren(...this.metaItems);
    const overflow: HTMLButtonElement[] = [];
    const fits = (z: HTMLElement) => {
      const items = [...z.children].filter((c): c is HTMLElement => c instanceof HTMLButtonElement);
      if (!items.length) return true;
      const first = items[0];
      const last = items[items.length - 1];
      return first.offsetLeft >= -0.5 && last.offsetLeft + last.offsetWidth <= z.clientWidth + 0.5;
    };
    // a la derecha ceden su lugar, en este orden, el laboratorio, el árbol y la bitácora (el mapa siempre se ve)
    for (const cmd of ['lab', 'tree', 'journal']) {
      if (fits(this.metaZone) || this.metaZone.children.length <= 1) break;
      const b = this.metaItems.find((m) => m.dataset.cmd === cmd);
      if (b?.isConnected) {
        overflow.push(b);
        b.remove();
      }
    }
    if (!fits(tools) || overflow.length) {
      tools.insertBefore(this.more, this.menu);
      // lo que pide la tarjeta nunca se esconde; la herramienta elegida, solo si no hay otra salida
      // (un interruptor o un lente encendido sí puede ir a «Más»: ahí se ve encendido)
      const buttons = () => [...tools.children].filter((c): c is HTMLButtonElement => c instanceof HTMLButtonElement && c !== this.more && !c.classList.contains('wanted'));
      const isActiveTool = (c: HTMLButtonElement) => !!c.dataset.tool && c.getAttribute('aria-pressed') === 'true';
      while (!fits(tools)) {
        const victim = buttons().filter((c) => !isActiveTool(c)).at(-1) ?? buttons().at(-1);
        if (!victim) break;
        overflow.unshift(victim);
        victim.remove();
      }
    }
    const order = [...this.toolItems, ...this.metaItems];
    overflow.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    this.menu.replaceChildren(...overflow);
    if (!overflow.length) {
      this.more.remove();
      this.setMenu(false);
    }
  }

  setActive(id: ToolId): void {
    this.bar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.tool === id));
    });
    // la herramienta activa queda a la vista (salvo que no quepa junto a la que pide la tarjeta)
    if (this.menu.querySelector(`[data-tool="${id}"]`)) this.layout();
  }

  setRunning(running: boolean): void {
    const b = this.flowBtn;
    if (!b) return;
    this.setIcon(b, running ? ICONS.pause : ICONS.play);
    this.setLabel(b, running ? 'Detener el tiempo' : 'Dejar fluir el tiempo');
    b.setAttribute('aria-pressed', String(running));
  }

  setSwitch(id: ForceSwitch, on: boolean, label?: string): void {
    const b = this.bar.querySelector<HTMLButtonElement>(`[data-switch="${id}"]`);
    if (!b) return;
    if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on));
    this.setLabel(b, label ?? SWITCH_NAMES[id]);
  }

  setLens(id: LensId, on: boolean): void {
    const b = this.bar.querySelector<HTMLButtonElement>(`[data-lens="${id}"]`);
    if (!b) return;
    b.setAttribute('aria-pressed', String(on));
  }

  setScale(k: number): void {
    const b = this.slowBtn;
    if (!b) return;
    this.setLabel(b, `Cámara lenta ${scaleLabel(k)}`);
    const badge = b.querySelector('.badge');
    if (badge) badge.textContent = k < 1 ? scaleLabel(k) : '';
    b.setAttribute('aria-pressed', String(k < 1));
  }
}

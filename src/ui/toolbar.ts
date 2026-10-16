import { ICONS } from '../tools/icons';
import type { Tool, ToolId } from '../tools/tool';
import { $, h } from './dom';

export interface ToolbarState {
  tools: Tool[];
  active: ToolId;
  simEnabled: boolean;
  running: boolean;
  /** herramientas recién desbloqueadas: brillan un momento */
  fresh?: readonly ToolId[];
}

export interface ToolbarActions {
  selectTool(id: ToolId): void;
  togglePlay(): void;
  reset(): void;
  openTree(): void;
}

/** Caja de herramientas: herramientas desbloqueadas, controles de simulación y acceso al árbol. */
export class Toolbar {
  private bar = $('bar');
  private playBtn: HTMLButtonElement | null = null;

  constructor(private actions: ToolbarActions) {}

  private button(icon: string, label: string, fn: () => void, extra: Record<string, string> = {}): HTMLButtonElement {
    const b = h('button', { class: 'tool', type: 'button', ...extra });
    b.innerHTML = icon;
    b.append(h('span', {}, label));
    b.addEventListener('click', fn);
    return b;
  }

  render(s: ToolbarState): void {
    const items: Node[] = [];
    for (const t of s.tools) {
      const b = this.button(t.icon, t.name, () => this.actions.selectTool(t.id), {
        'data-tool': t.id,
        'aria-pressed': String(t.id === s.active),
      });
      if (s.fresh?.includes(t.id)) b.classList.add('new');
      items.push(b);
    }
    this.playBtn = null;
    if (s.simEnabled) {
      items.push(h('span', { class: 'sep' }));
      this.playBtn = this.button('', '', this.actions.togglePlay, { 'data-cmd': 'play' });
      items.push(this.playBtn);
      items.push(this.button(ICONS.reset, 'Reiniciar', this.actions.reset, { 'data-cmd': 'reset' }));
      this.setRunning(s.running);
    }
    items.push(h('span', { class: 'sep' }));
    items.push(this.button(ICONS.tree, 'Árbol', this.actions.openTree, { 'data-cmd': 'tree' }));
    this.bar.replaceChildren(...items);
  }

  setActive(id: ToolId): void {
    this.bar.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.tool === id));
    });
  }

  setRunning(running: boolean): void {
    const b = this.playBtn;
    if (!b) return;
    b.innerHTML = running ? ICONS.pause : ICONS.play;
    b.append(h('span', {}, running ? 'Pausa' : 'Lanzar'));
  }
}

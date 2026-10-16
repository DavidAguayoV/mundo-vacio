import type { ToolId } from '../tools/tool';
import { $, h } from '../ui/dom';
import { SKILLS, TIERS, skillState } from './skills';

const STATE_CLASS = { disponible: 'on', próxima: 'next', bloqueada: 'off' } as const;

/** Overlay del árbol de habilidades. */
export class TreeView {
  private overlay = $('treeOv');
  private tiers = $('tiers');

  constructor(onClose: () => void) {
    $('closeTree').addEventListener('click', onClose);
    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose();
    });
  }

  get open(): boolean {
    return !this.overlay.hidden;
  }

  show(unlocked: ReadonlySet<ToolId>, upcoming: readonly ToolId[]): void {
    const names = new Map(SKILLS.map((n) => [n.id, n.name]));
    const available = new Set(SKILLS.filter((n) => skillState(n, unlocked, upcoming) === 'disponible').map((n) => n.id));
    this.tiers.replaceChildren(
      ...TIERS.map((title, tier) =>
        h(
          'section',
          { class: 'tier' },
          h('h3', {}, title),
          h(
            'div',
            { class: 'nodes' },
            ...SKILLS.filter((n) => n.tier === tier).map((n) => {
              const st = skillState(n, unlocked, upcoming);
              // solo los requisitos que todavía faltan
              const missing = (n.requires ?? []).filter((r) => !available.has(r));
              const req = st === 'bloqueada' && missing.length ? ` Requiere: ${missing.map((r) => names.get(r)).join(', ')}.` : '';
              return h(
                'div',
                { class: `node ${STATE_CLASS[st]}` },
                h('b', {}, n.name, h('span', { class: 'st' }, st)),
                h('small', {}, n.desc + req),
              );
            }),
          ),
        ),
      ),
    );
    this.overlay.hidden = false;
    $('closeTree').focus();
  }

  hide(): void {
    this.overlay.hidden = true;
  }
}

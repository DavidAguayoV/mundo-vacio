import { $, h } from '../ui/dom';
import { SKILLS, TIERS, skillState, type SkillState, type TreeProgress } from './skills';

const STATE_CLASS = { disponible: 'on', próxima: 'next', bloqueada: 'off' } as const;
const SVG = 'http://www.w3.org/2000/svg';

/**
 * Overlay del árbol de habilidades, dibujado como un árbol que crece: un tronco con una rama por nivel.
 * Lo ganado se enciende, lo próximo queda marcado con un anillo y lo bloqueado apenas se insinúa.
 * El estado se comunica con forma y opacidad (y en texto solo para lectores de pantalla).
 */
export class TreeView {
  private overlay = $('treeOv');
  private tiers = $('tiers');
  private links = document.createElementNS(SVG, 'svg');
  private states = new Map<string, SkillState>();

  constructor(onClose: () => void) {
    $('closeTree').addEventListener('click', onClose);
    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose();
    });
    this.links.setAttribute('class', 'links');
    this.links.setAttribute('aria-hidden', 'true');
    new ResizeObserver(() => this.drawLinks()).observe(this.tiers);
    // con el zoom del navegador el árbol puede no cambiar de ancho, pero sus filas sí se mueven
    window.addEventListener('resize', () => this.drawLinks());
  }

  get open(): boolean {
    return !this.overlay.hidden;
  }

  show(progress: TreeProgress): void {
    const names = new Map(SKILLS.map((n) => [n.id, n.name]));
    this.states = new Map(SKILLS.map((n) => [n.id, skillState(n, progress)]));
    const available = new Set(SKILLS.filter((n) => this.states.get(n.id) === 'disponible').map((n) => n.id));
    // el tronco se enciende hasta el último nivel con algo ganado
    const litTier = Math.max(-1, ...SKILLS.filter((n) => available.has(n.id)).map((n) => n.tier));

    const branches = TIERS.map((title, tier) => {
      const [numeral, name] = title.split('·').map((x) => x.trim());
      const nodes = SKILLS.filter((n) => n.tier === tier).map((n) => {
        const st = this.states.get(n.id)!;
        // solo los requisitos que todavía faltan
        const missing = (n.requires ?? []).filter((r) => !available.has(r));
        const req = st === 'bloqueada' && missing.length ? ` Requiere ${missing.map((r) => names.get(r)).join(', ')}.` : '';
        return h(
          'li',
          { class: `node ${STATE_CLASS[st]}`, 'data-skill': n.id },
          h('span', { class: 'dot', 'aria-hidden': 'true' }),
          h('span', { class: 'name' }, n.name, h('span', { class: 'sr' }, `, ${st}`)),
          h('small', {}, n.desc + req),
        );
      });
      return h(
        'section',
        { class: `tier${tier <= litTier ? ' lit' : ''}`, 'aria-labelledby': `tier${tier}` },
        h('h3', { id: `tier${tier}` }, h('span', { class: 'num' }, numeral), name ?? title),
        h('ul', { class: 'nodes' }, ...nodes),
      );
    });
    this.tiers.replaceChildren(this.links, ...branches);
    this.overlay.hidden = false;
    $('closeTree').focus();
    requestAnimationFrame(() => this.drawLinks());
  }

  /**
   * Líneas entre cada idea y sus requisitos (Vector → producto punto, Gravedad → marco acelerado).
   * Corren por los espacios en blanco: suben al hueco sobre la fila, bajan por el carril junto al
   * tronco si cambian de nivel y entran a la idea desde arriba; así no cruzan ningún texto.
   */
  private drawLinks(): void {
    if (this.overlay.hidden) return;
    const box = this.tiers.getBoundingClientRect();
    this.links.setAttribute('width', String(box.width));
    this.links.setAttribute('height', String(box.height));
    this.links.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const anchor = (id: string) => {
      const dot = this.tiers.querySelector(`[data-skill="${id}"] .dot`);
      if (!dot) return null;
      const r = dot.getBoundingClientRect();
      // hueco libre justo sobre la fila del nodo
      return { x: r.left + r.width / 2 - box.left, top: r.top - box.top, gap: r.top - box.top - 10 };
    };
    const lane = 22; // carril entre el tronco y las ideas
    const paths: SVGPathElement[] = [];
    for (const n of SKILLS) {
      for (const req of n.requires ?? []) {
        const a = anchor(req);
        const b = anchor(n.id);
        if (!a || !b) continue;
        const pts =
          Math.abs(a.gap - b.gap) < 4
            ? [
                [a.x, a.top],
                [a.x, a.gap],
                [b.x, b.gap],
                [b.x, b.top],
              ]
            : [
                [a.x, a.top],
                [a.x, a.gap],
                [lane, a.gap],
                [lane, b.gap],
                [b.x, b.gap],
                [b.x, b.top],
              ];
        const path = document.createElementNS(SVG, 'path');
        path.setAttribute('d', rounded(pts as [number, number][], 6));
        const lit = this.states.get(req) === 'disponible' && this.states.get(n.id) === 'disponible';
        path.setAttribute('class', lit ? 'link lit' : 'link');
        paths.push(path);
      }
    }
    this.links.replaceChildren(...paths);
  }

  hide(): void {
    this.overlay.hidden = true;
  }
}

/** Polilínea con las esquinas redondeadas (radio r). */
function rounded(pts: [number, number][], r: number): string {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    const l1 = Math.hypot(x - px, y - py) || 1;
    const l2 = Math.hypot(nx - x, ny - y) || 1;
    const k1 = Math.min(r, l1 / 2) / l1;
    const k2 = Math.min(r, l2 / 2) / l2;
    d += ` L${x - (x - px) * k1},${y - (y - py) * k1} Q${x},${y} ${x + (nx - x) * k2},${y + (ny - y) * k2}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L${last[0]},${last[1]}`;
}

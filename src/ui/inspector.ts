import { fmt, fmtDeg, fmtVec, subscript } from '../core/format';
import { angleDeg, len, type Vec2 } from '../core/vec';
import { IDENTITY_FRAME } from '../world/frame';
import type { EntityRef, World } from '../world/world';
import { $, h, setText } from './dom';

export interface InspectorActions {
  changeMass(id: string, factor: number): void;
  remove(ref: EntityRef): void;
}

interface Row {
  dd: HTMLElement;
  value: () => string;
}

const MASS_MIN = 0.25;
const MASS_MAX = 64;

/**
 * Inspector del objeto seleccionado. Todo se expresa en los ejes del usuario.
 * La estructura se arma una vez por selección y en cada cuadro solo se actualizan los textos,
 * así los botones no se reemplazan bajo el dedo mientras la partícula vuela.
 */
export class Inspector {
  private el = $('insp');
  private ref: EntityRef | null = null;
  private rows: Row[] = [];
  private massText: HTMLElement | null = null;
  private massBtns: HTMLButtonElement[] = [];

  constructor(
    private world: World,
    private actions: InspectorActions,
  ) {}

  private get frame() {
    return this.world.frame ?? IDENTITY_FRAME;
  }

  show(ref: EntityRef | null): void {
    if (ref && !this.world.exists(ref)) ref = null;
    const same = ref && this.ref && ref.kind === this.ref.kind && ref.id === this.ref.id;
    this.ref = ref;
    if (!same) this.build();
    this.update();
  }

  private row(dl: HTMLElement, label: string, cls: string, value: () => string): void {
    const dd = h('dd', { class: cls });
    dl.append(h('dt', {}, label), dd);
    this.rows.push({ dd, value });
  }

  /** Filas de componentes, magnitud y ángulo de un vector (expresado en los ejes del usuario). */
  private vectorRows(dl: HTMLElement, name: string, cls: string, unit: string, get: () => Vec2 | null): void {
    const u = () => {
      const v = get();
      return v ? this.frame.toUser(v) : { x: 0, y: 0 };
    };
    const sfx = unit ? ` ${unit}` : '';
    this.row(dl, `${name}ₓ`, cls, () => fmt(u().x) + sfx);
    this.row(dl, `${name}ᵧ`, cls, () => fmt(u().y) + sfx);
    this.row(dl, `|${name}|`, cls, () => fmt(len(u())) + sfx);
    this.row(dl, `θ`, cls, () => (len(u()) > 1e-9 ? fmtDeg(angleDeg(u())) : '—'));
  }

  private build(): void {
    this.rows = [];
    this.massText = null;
    this.massBtns = [];
    const ref = this.ref;
    if (!ref) {
      this.el.hidden = true;
      this.el.replaceChildren();
      return;
    }
    this.el.hidden = false;
    const dl = h('dl', { class: 'kv' });
    const del = h('button', { class: 'btn del', type: 'button' }, 'Eliminar');
    del.addEventListener('click', () => this.actions.remove(ref));

    if (ref.kind === 'particle') {
      const p = () => this.world.particle(ref.id);
      const label = p()?.label ?? '';
      this.massText = h('span');
      const minus = h('button', { class: 'btn', type: 'button', 'aria-label': 'Reducir la masa a la mitad' }, '−');
      const plus = h('button', { class: 'btn', type: 'button', 'aria-label': 'Duplicar la masa' }, '+');
      minus.addEventListener('click', () => this.actions.changeMass(ref.id, 0.5));
      plus.addEventListener('click', () => this.actions.changeMass(ref.id, 2));
      this.massBtns = [minus, plus];
      const mass = h('div', { class: 'mass' }, this.massText, h('span', {}, minus, ' ', plus));
      if (this.world.frame) {
        this.row(dl, `r${subscript(label)}`, 'pos', () => {
          const q = p();
          return q ? fmtVec(this.frame.pointToUser(q.pos), 'm') : '—';
        });
        this.row(dl, `|r|`, 'pos', () => {
          const q = p();
          return q ? `${fmt(len(this.frame.pointToUser(q.pos)))} m` : '—';
        });
      }
      this.row(dl, 'v', 'vel', () => {
        const q = p();
        return q ? fmtVec(this.frame.toUser(q.vel), 'm/s') : '—';
      });
      this.row(dl, '|v|', 'vel', () => {
        const q = p();
        return q ? `${fmt(len(q.vel))} m/s` : '—';
      });
      this.row(dl, 'θᵥ', 'vel', () => {
        const q = p();
        return q && len(q.vel) > 1e-9 ? fmtDeg(angleDeg(this.frame.toUser(q.vel))) : '—';
      });
      this.el.replaceChildren(h('h2', {}, `Partícula ${label}`), mass, dl, del);
    } else if (ref.kind === 'vector') {
      const v = () => this.world.vector(ref.id);
      const label = v()?.label ?? '';
      this.vectorRows(dl, label, 'vec', '', () => {
        const q = v();
        return q ? { x: q.tip.x - q.tail.x, y: q.tip.y - q.tail.y } : null;
      });
      this.el.replaceChildren(h('h2', {}, `Vector ${label}`), dl, del);
    } else {
      const s = this.world.sum(ref.id);
      const geo = s ? this.world.sumGeometry(s) : null;
      const name = geo ? `${geo.A.label}+${geo.B.label}` : 'Suma';
      this.vectorRows(dl, `(${name})`, '', '', () => {
        const ss = this.world.sum(ref.id);
        const g = ss ? this.world.sumGeometry(ss) : null;
        return g ? { x: g.tip.x - g.tail.x, y: g.tip.y - g.tail.y } : null;
      });
      this.el.replaceChildren(h('h2', {}, `Suma ${name}`), dl, del);
    }
  }

  /** Refresca los valores (cada cuadro). */
  update(): void {
    if (!this.ref) return;
    if (!this.world.exists(this.ref)) {
      this.show(null);
      return;
    }
    for (const r of this.rows) setText(r.dd, r.value());
    if (this.massText && this.ref.kind === 'particle') {
      const q = this.world.particle(this.ref.id);
      if (q) {
        setText(this.massText, `m = ${fmt(q.mass, q.mass < 1 ? 2 : 1)} kg`);
        this.massBtns[0].disabled = q.mass <= MASS_MIN;
        this.massBtns[1].disabled = q.mass >= MASS_MAX;
      }
    }
  }

  /** El marco cambió de "sin origen" a "con origen" (aparecen las filas de r). */
  rebuild(): void {
    this.build();
    this.update();
  }
}

export const clampMass = (m: number): number => Math.min(MASS_MAX, Math.max(MASS_MIN, m));

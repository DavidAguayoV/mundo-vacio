import { fmt, fmtDeg, fmtVec, subscript } from '../core/format';
import { angleDeg, len, type Vec2 } from '../core/vec';
import type { ForcePart } from '../physics/forces';
import { IDENTITY_FRAME } from '../world/frame';
import type { EntityRef, World } from '../world/world';
import { $, h, setText } from './dom';

export interface InspectorActions {
  changeMass(id: string, factor: number): void;
  changeMu(id: string, which: 'muS' | 'muK', delta: number): void;
  changeSpring(id: string, which: 'k' | 'restLength', delta: number): void;
  /** período medido de un resorte (null si todavía no completa una oscilación) */
  period(springId: string): number | null;
  remove(ref: EntityRef): void;
  close(): void;
  /** fuerzas sobre una partícula en el estado actual (null si no hay simulación que consultar) */
  forces(id: string): ForcePart[] | null;
}

interface Row {
  dd: HTMLElement;
  value: () => string;
}

/** Valor con botones − y +. */
interface Stepper {
  text: HTMLElement;
  value: () => string;
  minus: HTMLButtonElement;
  plus: HTMLButtonElement;
  canDec: () => boolean;
  canInc: () => boolean;
}

export const MASS_MIN = 0.25;
export const MASS_MAX = 64;
export const MU_MAX = 1.5;
export const MU_STEP = 0.05;
export const K_MIN = 5;
export const K_MAX = 200;
export const K_STEP = 5;
export const L0_MIN = 0.25;
export const L0_MAX = 10;
export const L0_STEP = 0.25;

/**
 * Inspector del objeto seleccionado. Todo se expresa en los ejes del usuario.
 * La estructura se arma una vez por selección y en cada cuadro solo se actualizan los textos,
 * así los botones no se reemplazan bajo el dedo mientras la partícula vuela.
 */
export class Inspector {
  private el = $('insp');
  private ref: EntityRef | null = null;
  private rows: Row[] = [];
  private steppers: Stepper[] = [];

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

  private stepper(
    value: () => string,
    labels: [string, string],
    onDec: () => void,
    onInc: () => void,
    canDec: () => boolean,
    canInc: () => boolean,
  ): HTMLElement {
    const text = h('span');
    const minus = h('button', { class: 'btn', type: 'button', 'aria-label': labels[0] }, '−');
    const plus = h('button', { class: 'btn', type: 'button', 'aria-label': labels[1] }, '+');
    minus.addEventListener('click', onDec);
    plus.addEventListener('click', onInc);
    this.steppers.push({ text, value, minus, plus, canDec, canInc });
    return h('div', { class: 'mass' }, text, h('span', {}, minus, ' ', plus));
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
    this.steppers = [];
    const ref = this.ref;
    if (!ref) {
      this.el.hidden = true;
      this.el.replaceChildren();
      return;
    }
    this.el.hidden = false;
    const dl = h('dl', { class: 'kv' });
    const close = h('button', { class: 'close', type: 'button', 'aria-label': 'Cerrar el panel' }, '×');
    close.addEventListener('click', () => this.actions.close());
    const del = h('button', { class: 'btn del', type: 'button' }, 'Eliminar');
    del.addEventListener('click', () => this.actions.remove(ref));

    if (ref.kind === 'particle') this.buildParticle(ref.id, dl, del, close);
    else if (ref.kind === 'surface') this.buildSurface(ref.id, dl, del, close);
    else if (ref.kind === 'spring') this.buildSpring(ref.id, dl, del, close);
    else if (ref.kind === 'vector') {
      const v = () => this.world.vector(ref.id);
      const label = v()?.label ?? '';
      this.vectorRows(dl, label, 'vec', '', () => {
        const q = v();
        return q ? { x: q.tip.x - q.tail.x, y: q.tip.y - q.tail.y } : null;
      });
      this.el.replaceChildren(close, h('h2', {}, `Vector ${label}`), dl, del);
    } else {
      const s = this.world.sum(ref.id);
      const geo = s ? this.world.sumGeometry(s) : null;
      const name = geo ? `${geo.A.label}+${geo.B.label}` : 'Suma';
      this.vectorRows(dl, `(${name})`, '', '', () => {
        const ss = this.world.sum(ref.id);
        const g = ss ? this.world.sumGeometry(ss) : null;
        return g ? { x: g.tip.x - g.tail.x, y: g.tip.y - g.tail.y } : null;
      });
      this.el.replaceChildren(close, h('h2', {}, `Suma ${name}`), dl, del);
    }
  }

  private buildParticle(id: string, dl: HTMLElement, del: HTMLElement, close: HTMLElement): void {
    const p = () => this.world.particle(id);
    const label = p()?.label ?? '';
    const mass = this.stepper(
      () => {
        const m = p()?.mass ?? 0;
        return `m = ${fmt(m, m < 1 ? 2 : 1)} kg`;
      },
      ['Reducir la masa a la mitad', 'Duplicar la masa'],
      () => this.actions.changeMass(id, 0.5),
      () => this.actions.changeMass(id, 2),
      () => (p()?.mass ?? 0) > MASS_MIN,
      () => (p()?.mass ?? 0) < MASS_MAX,
    );
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
    const part = (kind: string) => this.actions.forces(id)?.find((f) => f.kind === kind);
    if (this.world.gravitation && this.world.particles.length > 1) {
      this.row(dl, '|Fg|', 'vec', () => {
        const F = part('gravitation');
        return F ? `${fmt(len(F.F))} N` : '—';
      });
    }
    if (this.world.medium) {
      this.row(dl, '|Fa|', 'vec', () => {
        const F = part('drag');
        return F ? `${fmt(len(F.F))} N` : '0,00 N';
      });
    }
    if (this.world.springs.length) {
      this.row(dl, '|Fe|', 'vec', () => {
        const F = part('spring');
        return F ? `${fmt(len(F.F))} N` : '—';
      });
    }
    if (this.world.surfaces.length) {
      this.row(dl, '|N|', 'vec', () => {
        const N = part('normal');
        return N ? `${fmt(len(N.F))} N` : '—';
      });
      this.row(dl, '|f|', 'vec', () => {
        const f = part('friction');
        return f ? `${fmt(len(f.F))} N${f.note ? ` · ${f.note}` : ''}` : '—';
      });
    }
    this.el.replaceChildren(close, h('h2', {}, `Partícula ${label}`), mass, dl, del);
  }

  private buildSurface(id: string, dl: HTMLElement, del: HTMLElement, close: HTMLElement): void {
    const s = () => this.world.surface(id);
    const dir = (): Vec2 | null => {
      const q = s();
      return q ? { x: q.b.x - q.a.x, y: q.b.y - q.a.y } : null;
    };
    /** inclinación respecto de la horizontal (perpendicular a g), en [0°, 90°] */
    const incline = (): number | null => {
      const d = dir();
      const g = this.world.g;
      if (!d || !g || !len(d) || !len(g)) return null;
      const sin = Math.abs(d.x * g.x + d.y * g.y) / (len(d) * len(g));
      return Math.asin(Math.min(1, sin));
    };
    const muS = this.stepper(
      () => `μₛ = ${fmt(s()?.muS ?? 0)}`,
      ['Reducir μₛ', 'Aumentar μₛ'],
      () => this.actions.changeMu(id, 'muS', -MU_STEP),
      () => this.actions.changeMu(id, 'muS', MU_STEP),
      () => (s()?.muS ?? 0) > 1e-9,
      () => (s()?.muS ?? 0) < MU_MAX - 1e-9,
    );
    const muK = this.stepper(
      () => `μc = ${fmt(s()?.muK ?? 0)}`,
      ['Reducir μc', 'Aumentar μc'],
      () => this.actions.changeMu(id, 'muK', -MU_STEP),
      () => this.actions.changeMu(id, 'muK', MU_STEP),
      () => (s()?.muK ?? 0) > 1e-9,
      () => (s()?.muK ?? 0) < (s()?.muS ?? 0) - 1e-9,
    );
    if (this.world.g) {
      this.row(dl, 'α', '', () => {
        const a = incline();
        return a === null ? '—' : fmtDeg((a * 180) / Math.PI);
      });
      this.row(dl, 'tan α', '', () => {
        const a = incline();
        return a === null ? '—' : a > Math.PI / 2 - 1e-6 ? '∞' : fmt(Math.tan(a));
      });
    }
    this.row(dl, 'largo', '', () => {
      const d = dir();
      return d ? `${fmt(len(d))} m` : '—';
    });
    const note = h('p', { class: 'note' }, 'α: inclinación respecto de la horizontal (perpendicular a g). Arrastra un extremo con Mover para cambiarla.');
    this.el.replaceChildren(close, h('h2', {}, 'Superficie'), muS, muK, dl, note, del);
  }

  private buildSpring(id: string, dl: HTMLElement, del: HTMLElement, close: HTMLElement): void {
    const sp = () => this.world.spring(id);
    const L = () => {
      const s = sp();
      return s ? this.world.springLength(s) : 0;
    };
    const k = this.stepper(
      () => `k = ${fmt(sp()?.k ?? 0, 0)} N/m`,
      ['Resorte más blando', 'Resorte más duro'],
      () => this.actions.changeSpring(id, 'k', -K_STEP),
      () => this.actions.changeSpring(id, 'k', K_STEP),
      () => (sp()?.k ?? 0) > K_MIN,
      () => (sp()?.k ?? 0) < K_MAX,
    );
    const L0 = this.stepper(
      () => `L₀ = ${fmt(sp()?.restLength ?? 0)} m`,
      ['Acortar el largo natural', 'Alargar el largo natural'],
      () => this.actions.changeSpring(id, 'restLength', -L0_STEP),
      () => this.actions.changeSpring(id, 'restLength', L0_STEP),
      () => (sp()?.restLength ?? 0) > L0_MIN + 1e-9,
      () => (sp()?.restLength ?? 0) < L0_MAX - 1e-9,
    );
    this.row(dl, 'L', '', () => `${fmt(L())} m`);
    this.row(dl, 'ΔL = L − L₀', '', () => `${fmt(L() - (sp()?.restLength ?? 0))} m`);
    this.row(dl, '|F| = k|ΔL|', 'vec', () => `${fmt((sp()?.k ?? 0) * Math.abs(L() - (sp()?.restLength ?? 0)))} N`);
    this.row(dl, 'T medido', 'vel', () => {
      const T = this.actions.period(id);
      return T === null ? '—' : `${fmt(T)} s`;
    });
    const note = h('p', { class: 'note' }, 'ΔL > 0: estirado; ΔL < 0: comprimido. T se mide solo al completar una oscilación.');
    this.el.replaceChildren(close, h('h2', {}, 'Resorte'), k, L0, dl, note, del);
  }

  /** Refresca los valores (cada cuadro). */
  update(): void {
    if (!this.ref) return;
    if (!this.world.exists(this.ref)) {
      this.show(null);
      return;
    }
    for (const r of this.rows) setText(r.dd, r.value());
    for (const st of this.steppers) {
      setText(st.text, st.value());
      st.minus.disabled = !st.canDec();
      st.plus.disabled = !st.canInc();
    }
  }

  /** Cambió algo que agrega o quita filas (aparece el origen, la primera superficie, g). */
  rebuild(): void {
    this.build();
    this.update();
  }
}

export const clampMass = (m: number): number => Math.min(MASS_MAX, Math.max(MASS_MIN, m));

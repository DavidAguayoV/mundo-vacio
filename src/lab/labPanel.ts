import { fmt } from '../core/format';
import type { Vec2 } from '../core/vec';
import type { LabPrefs, TimeScale } from '../state/prefs';
import { $, h } from '../ui/dom';
import { EXAMPLES, G_MOON } from './examples';
import type { SavedExperiment } from './library';

export const G_PRESETS: { name: string; g: number | null }[] = [
  { name: 'Tierra', g: 9.8 },
  { name: 'Luna', g: G_MOON },
  { name: 'Marte', g: 3.71 },
  { name: 'Sin gravedad', g: null },
];

export interface LabState {
  name: string;
  saved: SavedExperiment[];
  g: Vec2 | null;
  gravitation: boolean;
  prefs: LabPrefs;
}

export interface LabActions {
  save(name: string): void;
  download(name: string): void;
  /** devuelve el enlace (y lo intenta copiar al portapapeles) */
  share(name: string): Promise<{ url: string; copied: boolean }>;
  open(id: string): void;
  remove(id: string): void;
  openFile(file: File): void;
  openExample(id: string): void;
  setG(g: number | null): void;
  setGravitation(on: boolean): void;
  clearWorld(): void;
  setPrefs(p: LabPrefs): void;
  state(): LabState;
}

const dateFmt = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** Panel del laboratorio (modo libre): guardar, abrir y compartir experimentos; g; opciones de vista. */
export class LabPanel {
  private overlay: HTMLElement;
  private body: HTMLElement;
  private armed = new Map<string, number>();

  constructor(private actions: LabActions) {
    this.body = h('div', { class: 'tree lab' });
    this.overlay = h('div', { class: 'overlay', hidden: '' }, this.body);
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-modal', 'true');
    this.overlay.setAttribute('aria-label', 'Laboratorio');
    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
    $('app').append(this.overlay);
  }

  get open(): boolean {
    return !this.overlay.hidden;
  }

  show(): void {
    this.armed.clear();
    this.render();
    this.overlay.hidden = false;
    this.body.querySelector<HTMLInputElement>('#labName')?.focus();
  }

  hide(): void {
    this.overlay.hidden = true;
  }

  /** Vuelve a dibujar el panel si está abierto (cambió la lista, g o las preferencias). */
  refresh(): void {
    if (this.open) this.render();
  }

  private btn(label: string, fn: () => void, cls = 'btn'): HTMLButtonElement {
    const b = h('button', { class: cls, type: 'button' }, label);
    b.addEventListener('click', fn);
    return b;
  }

  /** Botón que pide un segundo toque antes de hacer algo que no se puede deshacer. */
  private confirmBtn(key: string, label: string, fn: () => void): HTMLButtonElement {
    const b = this.btn(label, () => {
      const t = this.armed.get(key);
      if (t && performance.now() - t < 4000) {
        this.armed.delete(key);
        fn();
        return;
      }
      this.armed.set(key, performance.now());
      b.textContent = '¿Seguro? Otra vez';
      b.classList.add('warn');
    });
    return b;
  }

  private section(title: string, ...children: Node[]): HTMLElement {
    return h('section', { class: 'tier' }, h('h3', {}, title), ...children);
  }

  private render(): void {
    const st = this.actions.state();

    // ---- este experimento ----
    const name = h('input', { id: 'labName', class: 'field', type: 'text', value: st.name, maxlength: '80', 'aria-label': 'Nombre del experimento' });
    const current = () => name.value;
    const linkOut = h('div', { class: 'linkout' });
    const share = this.btn('Copiar enlace', async () => {
      share.disabled = true;
      try {
        const { url, copied } = await this.actions.share(current());
        const field = h('input', { class: 'field', type: 'text', readonly: '', value: url, 'aria-label': 'Enlace del experimento' });
        field.addEventListener('focus', () => field.select());
        linkOut.replaceChildren(
          h('small', {}, copied ? 'Enlace copiado. Quien lo abra verá este experimento en su modo libre.' : 'Copia este enlace:'),
          field,
        );
        if (!copied) field.focus();
      } finally {
        share.disabled = false;
      }
    });
    const thisOne = this.section(
      'Este experimento',
      name,
      h(
        'div',
        { class: 'row' },
        this.btn('Guardar aquí', () => this.actions.save(current()), 'btn primary'),
        this.btn('Descargar .json', () => this.actions.download(current())),
        share,
      ),
      linkOut,
      h('small', { class: 'hint' }, 'Se guarda el mundo como estaba al lanzar. «Guardar aquí» lo deja en este navegador; el archivo y el enlace sirven para otro equipo.'),
    );

    // ---- mis experimentos ----
    const file = h('input', { type: 'file', accept: '.json,application/json', hidden: '' });
    file.addEventListener('change', () => {
      const f = file.files?.[0];
      if (f) this.actions.openFile(f);
      file.value = '';
    });
    const list = st.saved.length
      ? h(
          'div',
          { class: 'saved' },
          ...st.saved.map((e) =>
            h(
              'div',
              { class: 'node saved-row' },
              h('b', {}, e.name, h('span', { class: 'st' }, dateFmt.format(new Date(e.savedAt)))),
              h('div', { class: 'row' }, this.btn('Abrir', () => this.actions.open(e.id)), this.confirmBtn(`del:${e.id}`, 'Eliminar', () => this.actions.remove(e.id))),
            ),
          ),
        )
      : h('small', { class: 'hint' }, 'Todavía no hay experimentos guardados en este navegador.');
    const mine = this.section(
      'Mis experimentos',
      list,
      h('div', { class: 'row' }, this.btn('Abrir archivo .json', () => file.click()), file),
      h('small', { class: 'hint' }, 'También puedes arrastrar un archivo .json sobre el lienzo.'),
    );

    // ---- ejemplos ----
    const examples = this.section(
      'Ejemplos',
      h(
        'div',
        { class: 'nodes' },
        ...EXAMPLES.map((e) =>
          h('div', { class: 'node' }, h('b', {}, e.name), h('small', {}, e.description), h('div', { class: 'row' }, this.btn('Abrir', () => this.actions.openExample(e.id)))),
        ),
      ),
    );

    // ---- mundo ----
    const gMag = st.g ? Math.hypot(st.g.x, st.g.y) : null;
    const gRow = h(
      'div',
      { class: 'seg', role: 'group', 'aria-label': 'Campo gravitacional' },
      ...G_PRESETS.map((p) => {
        const on = p.g === null ? gMag === null || gMag === 0 : gMag !== null && Math.abs(gMag - p.g) < 1e-6;
        const b = this.btn(p.g === null ? p.name : `${p.name} ${fmt(p.g)}`, () => this.actions.setG(p.g), 'btn');
        b.setAttribute('aria-pressed', String(on));
        return b;
      }),
    );
    const attract = h('input', { type: 'checkbox' });
    attract.checked = st.gravitation;
    attract.addEventListener('change', () => this.actions.setGravitation(attract.checked));
    const world = this.section(
      'Mundo',
      h('small', { class: 'hint' }, '|g| en m/s². La dirección se sigue eligiendo con la herramienta Gravedad.'),
      gRow,
      h('label', { class: 'check' }, attract, 'Atracción entre masas (G = 0,5 N·m²/kg²)'),
      h('div', { class: 'row' }, this.confirmBtn('clear', 'Vaciar el mundo', () => this.actions.clearWorld())),
    );

    // ---- vista ----
    const scales: [TimeScale, string][] = [
      [1, 'Tiempo real'],
      [0.5, '×½'],
      [0.25, '×¼'],
    ];
    const speed = h(
      'div',
      { class: 'seg', role: 'group', 'aria-label': 'Cámara lenta' },
      ...scales.map(([k, label]) => {
        const b = this.btn(label, () => this.actions.setPrefs({ ...st.prefs, timeScale: k }));
        b.setAttribute('aria-pressed', String(st.prefs.timeScale === k));
        return b;
      }),
    );
    const check = (label: string, value: boolean, fn: (v: boolean) => void) => {
      const box = h('input', { type: 'checkbox' });
      box.checked = value;
      box.addEventListener('change', () => fn(box.checked));
      return h('label', { class: 'check' }, box, label);
    };
    const view = this.section(
      'Vista',
      speed,
      h(
        'div',
        { class: 'row' },
        check('Vectores posición r', st.prefs.showPositions, (v) => this.actions.setPrefs({ ...st.prefs, showPositions: v })),
        check('Trayectoria cada 0,1 s', st.prefs.showTrails, (v) => this.actions.setPrefs({ ...st.prefs, showTrails: v })),
      ),
    );

    const header = h('header', {}, h('h2', {}, 'Laboratorio'), h('div', { class: 'row' }, this.btn('Volver', () => this.hide(), 'btn primary')));
    this.body.replaceChildren(header, thisOne, mine, examples, world, view);
  }
}

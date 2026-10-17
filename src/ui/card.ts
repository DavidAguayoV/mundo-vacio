import { fmt } from '../core/format';
import type { LabControl, LabGuide } from '../lab/examples';
import type { SiteEngine } from '../story/siteEngine';
import type { Grant, Site } from '../story/types';
import { $, h, symbol } from './dom';

export interface CardActions {
  next(): void;
  choose(id: string): void;
  openTree(): void;
  goFree(): void;
  openLab(): void;
  /** entrar a un rastro desde el mapa */
  enter(id: string): void;
  toMap(): void;
  openJournal(site?: string): void;
  /** un deslizador del laboratorio cambió */
  setControl(id: string, value: number): void;
  /** valor actual de un deslizador (null si lo que controla ya no existe) */
  controlValue(c: LabControl): number | null;
}

/** El laboratorio con guía que está abierto. */
export interface OpenLab {
  id: string;
  name: string;
  guide: LabGuide;
}

/** «una **idea** clave» → texto con <strong>, sin innerHTML. */
function rich(text: string): Node[] {
  return text.split('**').map((part, i) => (i % 2 ? h('strong', {}, part) : document.createTextNode(part)));
}

/** Nombre legible de lo que se gana (para «te falta Velocidad»). */
export type GrantNamer = (g: Grant) => string;

/**
 * Las estrellas con nombre: «★ resuelto · ☆ predicción · ★☆ retos». Lo que falta queda atenuado
 * y lo dice en voz alta («falta predicción»).
 */
export function starLine(story: SiteEngine, site: Site): HTMLElement {
  const parts = story.starParts(site);
  const said = parts.map((p) => (p.got >= p.max ? p.label : p.max > 1 && p.got ? `${p.label}, ${p.got} de ${p.max}` : `falta ${p.label}`));
  return h(
    'span',
    { class: 'stars named', role: 'img', 'aria-label': `Estrellas: ${said.join('; ')}` },
    ...parts.map((p) =>
      h(
        'span',
        { class: p.got >= p.max ? 'star-part' : 'star-part missing', title: p.got >= p.max ? '' : 'Falta' },
        h('span', { class: 'star-icons', 'aria-hidden': 'true' }, '★'.repeat(p.got) + '☆'.repeat(Math.max(0, p.max - p.got))),
        ` ${p.label}`,
      ),
    ),
  );
}

/** Los retos del rastro: «Si te atreves: …». Los ganados quedan tachados y marcados con ★. */
export function dareList(story: SiteEngine, site: Site): HTMLElement | null {
  const dares = site.mastery ?? [];
  if (!dares.length) return null;
  const have = story.stars(site.id);
  return h(
    'ul',
    { class: 'dares', 'aria-label': 'Retos' },
    ...dares.map((m) => {
      const won = have.includes(m.id);
      const label = m.label.charAt(0).toLowerCase() + m.label.slice(1);
      return h(
        'li',
        { class: won ? 'won' : '' },
        won ? h('span', { class: 'dare-mark', 'aria-label': 'Logrado' }, '★') : h('span', { class: 'dare-mark', 'aria-hidden': 'true' }, '☆'),
        ' Si te atreves: ',
        won ? h('s', {}, label) : label,
      );
    }),
  );
}

/** Tarjeta del relato: el mapa, el rastro en curso o la página de un rastro resuelto. */
export class StoryCard {
  private card = $('card');
  private eyebrow = $('eyebrow');
  private dots = $('dots');
  private title = $('ctitle');
  private text = $('ctext');
  private row = $('crow');
  private minBtn = $('minBtn');
  private kind = h('div', { class: 'kind' });
  private quote = h('blockquote', { class: 'trace' });
  private extra = h('p', { class: 'extra' });
  /** los retos del rastro («Si te atreves: …») */
  private dares = h('div', { class: 'dares-box' });
  /** listas «qué medir» y «preguntas» de un laboratorio */
  private lists = h('div', { class: 'lab-lists' });
  /** deslizadores del profesor */
  private controls = h('div', { class: 'lab-controls' });
  private controlsFor = '';
  /** paso que se está mostrando: al cambiar, el texto entra con un fundido */
  private shown = '';

  constructor(
    private actions: CardActions,
    private nameOf: GrantNamer,
  ) {
    this.minBtn.addEventListener('click', () => this.setCollapsed(!this.card.classList.contains('collapsed')));
    this.text.before(this.kind, this.quote);
    this.text.after(this.extra, this.dares, this.lists, this.controls);
  }

  setCollapsed(c: boolean): void {
    this.card.classList.toggle('collapsed', c);
    this.minBtn.textContent = c ? '+' : '−';
    this.minBtn.setAttribute('aria-label', c ? 'Mostrar relato' : 'Contraer relato');
    this.minBtn.setAttribute('aria-expanded', String(!c));
  }

  private button(label: string, primary: boolean, fn: () => void, disabled = false): HTMLButtonElement {
    const b = h('button', { class: primary ? 'btn primary' : 'btn', type: 'button' }, label);
    b.disabled = disabled;
    b.addEventListener('click', fn);
    return b;
  }

  /** Un solo fundido por vista nueva (no en cada refresco de la interfaz). */
  private enter(key: string): void {
    if (key === this.shown) return;
    const first = this.shown === '';
    this.shown = key;
    if (first) return;
    this.card.classList.remove('enter');
    void this.card.offsetWidth; // reinicia la animación
    this.card.classList.add('enter');
  }

  private clear(): void {
    this.row.replaceChildren();
    this.row.classList.remove('choices');
    this.card.classList.remove('engineering');
    this.kind.textContent = '';
    this.quote.textContent = '';
    this.extra.replaceChildren();
    this.dares.replaceChildren();
    this.lists.replaceChildren();
    this.dots.replaceChildren();
    this.eyebrow.removeAttribute('title');
  }

  render(story: SiteEngine, mapSelection: string | null, lab: OpenLab | null = null): void {
    this.clear();
    if (!story.free || !lab) this.clearControls();
    if (story.free) return lab ? this.renderLab(lab) : this.renderFree();
    const site = story.site;
    if (!site) return this.renderMap(story, mapSelection);
    if (story.done) return this.renderPage(story);

    const step = story.step!;
    const zone = story.zone(site.zone)?.name ?? '';
    this.eyebrow.textContent = zone;
    this.dots.replaceChildren(
      ...site.steps.map((_, i) => h('i', { class: i < story.progress.step ? 'done' : i === story.progress.step ? 'now' : '' })),
    );
    this.title.textContent = site.title;
    // la nota de quien estuvo antes abre el rastro
    if (story.progress.step === 0) this.quote.textContent = `«${site.note}»`;
    this.text.replaceChildren(...rich(story.text()));
    this.showDares(story, site);
    if (step.choices) {
      this.row.classList.add('choices');
      for (const c of step.choices) {
        const b = h('button', { class: 'choice', type: 'button' }, c.label);
        b.addEventListener('click', () => this.actions.choose(c.id));
        this.row.append(b);
      }
    }
    if (step.on === 'next') this.row.append(this.button(step.button ?? 'Siguiente', true, this.actions.next));
    // un paso nuevo siempre se muestra completo
    this.setCollapsed(false);
    this.enter(`${site.id}:${story.progress.step}`);
  }

  private showDares(story: SiteEngine, site: Site): void {
    const list = dareList(story, site);
    this.dares.replaceChildren(...(list ? [list] : []));
  }

  private renderFree(): void {
    this.eyebrow.textContent = 'Modo libre';
    this.title.textContent = 'Laboratorio abierto';
    this.text.textContent =
      'Todas las herramientas y todo el control del tiempo. Arma tu propio experimento; en Lab puedes guardarlo, compartirlo o abrir uno de los ejemplos.';
    this.row.append(this.button('Abrir Lab', true, this.actions.openLab), this.button('Volver al mapa', false, this.actions.toMap));
    this.enter('libre');
  }

  private clearControls(): void {
    this.controls.replaceChildren();
    this.controlsFor = '';
  }

  private fmtControl(c: LabControl, v: number): string {
    const unit = !c.unit ? '' : c.unit === '°' ? '°' : ` ${c.unit}`;
    return `${fmt(v, c.decimals ?? 2)}${unit}`;
  }

  /** Laboratorio con guía: el objetivo, qué medir, qué preguntar y los deslizadores del profesor. */
  private renderLab(lab: OpenLab): void {
    const g = lab.guide;
    this.eyebrow.textContent = 'Laboratorio';
    this.title.textContent = lab.name;
    this.text.textContent = g.goal;
    const list = (title: string, items: string[]) => h('section', {}, h('h3', {}, title), h('ul', {}, ...items.map((t) => h('li', {}, t))));
    // en el celular la guía parte plegada: así se ven los deslizadores y la escena
    const prev = this.lists.querySelector('details');
    const open = prev ? prev.open : window.innerWidth >= 700;
    const details = h('details', {}, h('summary', {}, 'Qué medir y preguntas'), h('div', { class: 'lab-lists-body' }, list('Qué medir', g.measure), list('Preguntas', g.questions)));
    details.open = open;
    this.lists.replaceChildren(details);
    // los deslizadores se arman una vez por laboratorio: no se reemplazan bajo el dedo
    if (this.controlsFor !== lab.id) {
      this.controlsFor = lab.id;
      this.controls.replaceChildren(...(g.controls ?? []).map((c) => this.slider(c)));
    } else {
      this.syncControls(g.controls ?? []);
    }
    this.row.append(this.button('Otros laboratorios', false, this.actions.openLab), this.button('Volver al mapa', false, this.actions.toMap));
    this.enter(`lab:${lab.id}`);
  }

  private slider(c: LabControl): HTMLElement {
    const v = this.actions.controlValue(c) ?? c.min;
    const id = `ctl-${c.id}`;
    const input = h('input', { type: 'range', id, min: String(c.min), max: String(c.max), step: String(c.step), value: String(v), 'data-ctl': c.id });
    const out = h('output', { for: id }, this.fmtControl(c, v));
    input.addEventListener('input', () => {
      const x = Number(input.value);
      out.textContent = this.fmtControl(c, x);
      this.actions.setControl(c.id, x);
    });
    return h('div', { class: 'lab-control' }, h('label', { for: id }, ...symbol(c.label)), input, out);
  }

  /** Si el mundo cambió por otro lado (con las herramientas), los deslizadores lo muestran. */
  private syncControls(cs: LabControl[]): void {
    for (const c of cs) {
      const input = this.controls.querySelector<HTMLInputElement>(`[data-ctl="${c.id}"]`);
      if (!input || document.activeElement === input) continue;
      const v = this.actions.controlValue(c);
      if (v === null) continue;
      input.value = String(v);
      const out = input.nextElementSibling;
      if (out) out.textContent = this.fmtControl(c, v);
    }
  }

  private renderMap(story: SiteEngine, selection: string | null): void {
    const site = selection ? story.siteById(selection) : undefined;
    if (!site) {
      const solved = story.sites.filter((s) => story.isSolved(s.id)).length;
      this.eyebrow.textContent = 'El mapa';
      this.title.textContent = 'Rastros';
      this.text.textContent = 'Cada señal es algo que dejó quien estuvo aquí antes. Toca una para leer su nota; arrastra para recorrer el mapa.';
      this.extra.textContent = `${solved} de ${story.sites.length} rastros resueltos.`;
      this.row.append(this.button('Bitácora', false, () => this.actions.openJournal()), this.button('Laboratorios', false, this.actions.openLab));
      this.enter('mapa');
      return;
    }
    const st = story.status(site);
    this.eyebrow.textContent = story.zone(site.zone)?.name ?? '';
    this.title.textContent = site.title;
    this.quote.textContent = `«${site.note}»`;
    if (st === 'cerrado') {
      const missing = story.missing(site).map((g) => {
        const src = story.sourceOf(g);
        const where = src ? ` (se gana en «${src.title}», ${story.zone(src.zone)?.name ?? ''})` : '';
        return `${this.nameOf(g)}${where}`;
      });
      this.text.textContent = `Para resolverlo te falta: ${missing.join('; ')}.`;
      this.row.append(this.button('Entrar', true, () => {}, true));
    } else if (st === 'resuelto') {
      this.text.replaceChildren(document.createTextNode('Ya lo resolviste. '), starLine(story, site));
      this.showDares(story, site);
      this.row.append(this.button('Repetir', true, () => this.actions.enter(site.id)), this.button('Ver su página', false, () => this.actions.openJournal(site.id)));
    } else {
      this.text.textContent = 'Todavía no lo resuelves.';
      this.showDares(story, site);
      this.row.append(this.button('Entrar', true, () => this.actions.enter(site.id)));
    }
    this.setCollapsed(false);
    this.enter(`mapa:${site.id}`);
  }

  /** Rastro resuelto: lo que quedó escrito en la bitácora y lo que falta para las estrellas. */
  private renderPage(story: SiteEngine): void {
    const site = story.site!;
    const done = story.solved(site.id);
    this.eyebrow.textContent = story.zone(site.zone)?.name ?? '';
    this.kind.textContent = 'Nueva página en la bitácora';
    this.title.textContent = site.title;
    this.text.replaceChildren(...rich(site.page.law));
    this.extra.replaceChildren(...(done?.measured ? [document.createTextNode(`${done.measured} `)] : []), starLine(story, site));
    this.showDares(story, site);
    // la primera vez que se resuelve el vacío, el mapa se revela
    const first = site.id === 'vacio' && Object.keys(story.progress.solved).length === 1;
    this.row.append(
      this.button(first ? 'Mirar alrededor' : 'Volver al mapa', true, this.actions.toMap),
      this.button('Seguir aquí', false, () => this.setCollapsed(true)),
    );
    this.setCollapsed(false);
    this.enter(`pagina:${site.id}`);
  }
}

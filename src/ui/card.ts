import type { StoryEngine } from '../story/storyEngine';
import { $, h } from './dom';

export interface CardActions {
  next(): void;
  choose(id: string): void;
  openTree(): void;
  goFree(): void;
  openLab(): void;
}

/** «una **idea** clave» → texto con <strong>, sin innerHTML. */
function rich(text: string): Node[] {
  return text.split('**').map((part, i) => (i % 2 ? h('strong', {}, part) : document.createTextNode(part)));
}

/** Tarjeta de relato (contraíble). */
export class StoryCard {
  private card = $('card');
  private eyebrow = $('eyebrow');
  private dots = $('dots');
  private title = $('ctitle');
  private text = $('ctext');
  private row = $('crow');
  private minBtn = $('minBtn');
  private kind = h('div', { class: 'kind' });
  /** paso que se está mostrando: al cambiar, el texto entra con un fundido */
  private shown = '';

  constructor(private actions: CardActions) {
    this.minBtn.addEventListener('click', () => this.setCollapsed(!this.card.classList.contains('collapsed')));
    this.text.before(this.kind);
  }

  setCollapsed(c: boolean): void {
    this.card.classList.toggle('collapsed', c);
    this.minBtn.textContent = c ? '+' : '−';
    this.minBtn.setAttribute('aria-label', c ? 'Mostrar relato' : 'Contraer relato');
    this.minBtn.setAttribute('aria-expanded', String(!c));
  }

  private button(label: string, primary: boolean, fn: () => void): HTMLButtonElement {
    const b = h('button', { class: primary ? 'btn primary' : 'btn', type: 'button' }, label);
    b.addEventListener('click', fn);
    return b;
  }

  /** Un solo fundido por paso nuevo (no en cada refresco de la interfaz). */
  private enter(key: string): void {
    if (key === this.shown) return;
    const first = this.shown === '';
    this.shown = key;
    if (first) return;
    this.card.classList.remove('enter');
    void this.card.offsetWidth; // reinicia la animación
    this.card.classList.add('enter');
  }

  render(story: StoryEngine): void {
    this.row.replaceChildren();
    this.row.classList.remove('choices');
    this.card.classList.remove('engineering');
    this.kind.textContent = '';
    if (story.free) {
      this.eyebrow.textContent = 'Modo libre';
      this.dots.replaceChildren();
      this.title.textContent = 'Laboratorio abierto';
      this.text.textContent =
        'Todas las herramientas y todo el control del tiempo. Arma tu propio experimento; en Lab puedes guardarlo, compartirlo o abrir uno de los ejemplos.';
      this.row.append(this.button('Abrir Lab', true, this.actions.openLab), this.button('Ver árbol', false, this.actions.openTree));
      this.enter('libre');
      return;
    }
    const { chapter, step } = story;
    // «I · Dónde» → «Dónde, capítulo 1 de 11»
    const actName = chapter.act.split('·').pop()?.trim() ?? chapter.act;
    this.eyebrow.textContent = `${actName}, capítulo ${story.index + 1} de ${story.chapters.length}`;
    this.eyebrow.title = `Acto ${chapter.act}, capítulo ${story.index + 1} de ${story.chapters.length}`;
    this.dots.replaceChildren(
      ...chapter.steps.map((_, i) =>
        h('i', { class: i < story.progress.step ? 'done' : i === story.progress.step ? 'now' : '' }),
      ),
    );
    this.title.textContent = chapter.title;
    this.text.replaceChildren(...rich(story.text()));
    if (step.kind === 'engineering') {
      this.card.classList.add('engineering');
      this.kind.textContent = 'Mirada de ingeniería';
    }
    if (step.choices) {
      this.row.classList.add('choices');
      for (const c of step.choices) {
        const b = h('button', { class: 'choice', type: 'button' }, c.label);
        b.addEventListener('click', () => this.actions.choose(c.id));
        this.row.append(b);
      }
    }
    if (step.on === 'next') this.row.append(this.button(step.button ?? 'Siguiente', true, this.actions.next));
    if (step.on === 'end' && !step.choices) {
      this.row.append(
        this.button('Ver el árbol', true, this.actions.openTree),
        this.button('Seguir en modo libre', false, this.actions.goFree),
      );
    }
    // un paso nuevo siempre se muestra completo
    this.setCollapsed(false);
    this.enter(`${chapter.id}:${story.progress.step}`);
  }
}

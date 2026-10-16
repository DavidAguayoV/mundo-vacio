import type { StoryEngine } from '../story/storyEngine';
import { $, h } from './dom';

export interface CardActions {
  next(): void;
  openTree(): void;
  goFree(): void;
  openLab(): void;
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

  constructor(private actions: CardActions) {
    this.minBtn.addEventListener('click', () => this.setCollapsed(!this.card.classList.contains('collapsed')));
  }

  setCollapsed(c: boolean): void {
    this.card.classList.toggle('collapsed', c);
    this.minBtn.textContent = c ? '+' : '—';
    this.minBtn.setAttribute('aria-label', c ? 'Mostrar relato' : 'Contraer relato');
    this.minBtn.setAttribute('aria-expanded', String(!c));
  }

  private button(label: string, primary: boolean, fn: () => void): HTMLButtonElement {
    const b = h('button', { class: primary ? 'btn primary' : 'btn', type: 'button' }, label);
    b.addEventListener('click', fn);
    return b;
  }

  render(story: StoryEngine): void {
    this.row.replaceChildren();
    if (story.free) {
      this.eyebrow.textContent = 'Modo libre';
      this.dots.replaceChildren();
      this.title.textContent = 'Laboratorio abierto';
      this.text.textContent =
        'Todas las herramientas disponibles. Arma tu propio experimento y presiona Lanzar. En Lab puedes guardarlo, compartirlo o abrir uno de los ejemplos.';
      this.row.append(this.button('Abrir Lab', true, this.actions.openLab), this.button('Ver árbol', false, this.actions.openTree));
      return;
    }
    const { chapter, step } = story;
    const n = story.chapters.length;
    this.eyebrow.textContent = `Capítulo ${story.progress.chapter + 1} de ${n}`;
    this.dots.replaceChildren(
      ...chapter.steps.map((_, i) =>
        h('i', { class: i < story.progress.step ? 'done' : i === story.progress.step ? 'now' : '' }),
      ),
    );
    this.title.textContent = chapter.title;
    this.text.textContent = step.text;
    if (step.on === 'next') this.row.append(this.button('Siguiente', true, this.actions.next));
    if (step.on === 'end') {
      this.row.append(
        this.button('Ver el árbol', true, this.actions.openTree),
        this.button('Seguir en modo libre', false, this.actions.goFree),
      );
    }
    // un paso nuevo siempre se muestra completo
    this.setCollapsed(false);
  }
}

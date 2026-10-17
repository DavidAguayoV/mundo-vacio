import type { SiteEngine } from '../story/siteEngine';
import { starLine } from './card';
import { $, h } from './dom';

/** «una **idea** clave» → texto con <strong>, sin innerHTML. */
function rich(text: string): Node[] {
  return text.split('**').map((part, i) => (i % 2 ? h('strong', {}, part) : document.createTextNode(part)));
}

/**
 * La bitácora: una página por rastro. Arriba, la nota de quien estuvo antes; abajo, lo que el
 * estudiante descubrió y midió. Las páginas de los rastros que faltan quedan en blanco.
 */
export class Journal {
  private overlay = $('journalOv');
  private body = $('journalBody');

  constructor(
    private story: SiteEngine,
    onClose: () => void,
  ) {
    $('closeJournal').addEventListener('click', onClose);
    this.overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') onClose();
    });
  }

  get open(): boolean {
    return !this.overlay.hidden;
  }

  show(focusSite?: string): void {
    const { story } = this;
    const solved = story.sites.filter((s) => story.isSolved(s.id)).length;
    const stars = story.sites.reduce((n, s) => n + story.stars(s.id).length, 0);
    const maxStars = story.sites.reduce((n, s) => n + story.maxStars(s), 0);
    const summary = h('p', { class: 'journal-sum' }, `${solved} de ${story.sites.length} páginas escritas; ${stars} de ${maxStars} estrellas.`);
    const zones = story.zones
      .map((z) => {
        const sites = story.sites.filter((s) => s.zone === z.id);
        if (!sites.length) return null;
        return h(
          'section',
          { class: 'journal-zone', 'aria-labelledby': `jz-${z.id}` },
          h('h3', { id: `jz-${z.id}` }, z.name),
          ...sites.map((s) => {
            const done = story.solved(s.id);
            if (!done) {
              return h('article', { class: 'page blank', id: `page-${s.id}` }, h('h4', {}, s.title), h('p', { class: 'note' }, 'Página en blanco.'));
            }
            const missing = (s.mastery ?? []).filter((m) => !story.stars(s.id).includes(m.id));
            return h(
              'article',
              { class: 'page', id: `page-${s.id}` },
              h('h4', {}, s.title, starLine(story, s)),
              h('blockquote', {}, `«${s.note}»`),
              h('p', { class: 'law' }, ...rich(s.page.law)),
              ...(done.measured ? [h('p', { class: 'measured' }, done.measured)] : []),
              ...(s.page.engineering ? [h('p', { class: 'eng' }, h('span', {}, 'Mirada de ingeniería. '), s.page.engineering)] : []),
              ...(missing.length ? [h('p', { class: 'todo' }, `Pendiente: ${missing.map((m) => m.label.charAt(0).toLowerCase() + m.label.slice(1)).join('; ')}.`)] : []),
            );
          }),
        );
      })
      .filter((x): x is HTMLElement => !!x);
    this.body.replaceChildren(summary, ...zones);
    this.overlay.hidden = false;
    $('closeJournal').focus();
    if (focusSite) document.getElementById(`page-${focusSite}`)?.scrollIntoView({ block: 'center' });
  }

  hide(): void {
    this.overlay.hidden = true;
  }
}

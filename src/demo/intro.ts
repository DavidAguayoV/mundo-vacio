// Pantalla de entrada de la demo: qué es, cuánto dura y quién lo hizo, antes del primer rastro.

import type { GameHost } from '../mode';
import { h } from '../ui/dom';
import { routeState } from './policy';
import { ROUTE_IDS } from './route';
import { resetDemo } from './reset';

/** Tras «Empezar de nuevo» en la entrada, la página se recarga y parte directo en el vacío. */
const SKIP_KEY = 'mundoVacio.demo.skipIntro';

function takeSkip(): boolean {
  try {
    const skip = sessionStorage.getItem(SKIP_KEY) === '1';
    sessionStorage.removeItem(SKIP_KEY);
    return skip;
  } catch {
    return false;
  }
}

/** ¿Hay algo jugado en la demo? */
function hasProgress(host: GameHost): boolean {
  const p = host.story.progress;
  return Object.keys(p.solved).length > 0 || p.step > 0;
}

let current: HTMLElement | null = null;

export function introOpen(): boolean {
  return !!current;
}

export function showIntro(host: GameHost): void {
  if (takeSkip()) return;
  current?.remove();
  const resume = hasProgress(host);
  const close = () => {
    const el = current;
    current = null;
    if (!el) return;
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 320);
    document.getElementById('cv')?.focus();
  };
  const start = h('button', { class: 'btn primary big', type: 'button' }, resume ? 'Seguir donde quedaste' : 'Empezar');
  start.addEventListener('click', close);
  const actions = h('div', { class: 'intro-actions' }, start);
  if (resume) {
    const r = routeState(host.story);
    const again = h('button', { class: 'btn', type: 'button' }, 'Empezar de nuevo');
    again.addEventListener('click', () => {
      try {
        sessionStorage.setItem(SKIP_KEY, '1');
      } catch {
        /* sin almacenamiento: se vuelve a ver la entrada */
      }
      resetDemo();
    });
    actions.append(again);
    const where = r.complete ? 'Ya terminaste el recorrido: el mundo está abierto.' : `Ibas en el rastro ${r.done + 1} de ${ROUTE_IDS.length}: «${r.next?.title ?? ''}».`;
    actions.append(h('p', { class: 'intro-where' }, where));
  }
  const body = h(
    'div',
    { class: 'intro-body' },
    h('h1', { id: 'introTitle' }, 'Mundo Vacío'),
    h('p', { class: 'intro-lead' }, 'Un juego sobre física: parte en un espacio vacío y construye las herramientas para describir el movimiento.'),
    h('p', { class: 'intro-meta' }, '≈ 12 minutos · funciona con mouse o con el dedo'),
    actions,
  );
  const el = h(
    'div',
    { class: 'demo-intro', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'introTitle' },
    body,
    h('p', { class: 'intro-credit' }, 'David Aguayo Vera · Universidad Adolfo Ibáñez'),
  );
  document.getElementById('app')!.append(el);
  current = el;
  start.focus();
}

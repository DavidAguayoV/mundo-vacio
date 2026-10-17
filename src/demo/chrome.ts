// Lo que la demo agrega sobre el juego: «Empezar de nuevo» siempre a la vista, la ayuda del primer
// gesto (girar los ejes) y, en el kiosco, la vuelta al comienzo por inactividad.

import type { GameHost } from '../mode';
import { storageKey } from '../state/storage';
import { h } from '../ui/dom';
import { introOpen } from './intro';
import { resetDemo } from './reset';

/** Segundos sin nadie antes de preguntar «¿Sigues ahí?», y de cuenta regresiva después. */
export const KIOSK_IDLE_S = 90;
export const KIOSK_COUNTDOWN_S = 30;
/** Segundos en el paso «gira los ejes» antes de mostrar cómo se hace. */
const HINT_AFTER_S = 6;

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function mountChrome(host: GameHost, opts: { kiosk: boolean }): void {
  const app = document.getElementById('app')!;
  app.classList.add('demo-mode');
  mountRestart(app);
  mountAxisHint(app, host);
  if (opts.kiosk) mountKiosk(app, host);
}

/** «Empezar de nuevo»: dos toques (el segundo confirma), como en el Árbol. */
function mountRestart(app: HTMLElement): void {
  // en el celular no cabe junto al rótulo de la tarjeta: se lee «Reiniciar» (el nombre completo queda para los lectores de pantalla)
  const label = h('span', { class: 'long' }, 'Empezar de nuevo');
  const b = h('button', { class: 'demo-restart', type: 'button', 'aria-label': 'Empezar de nuevo' }, label, h('span', { class: 'short', 'aria-hidden': 'true' }, 'Reiniciar'));
  let armed = 0;
  let timer = 0;
  b.addEventListener('click', () => {
    if (performance.now() - armed < 4000) {
      resetDemo();
      return;
    }
    armed = performance.now();
    label.textContent = '¿Seguro? Toca otra vez';
    b.setAttribute('aria-label', '¿Seguro? Toca otra vez');
    b.classList.add('warn');
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      armed = 0;
      label.textContent = 'Empezar de nuevo';
      b.setAttribute('aria-label', 'Empezar de nuevo');
      b.classList.remove('warn');
    }, 4000);
  });
  app.append(b);
}

// ---------- el primer gesto: girar los ejes ----------

function hintDone(): boolean {
  try {
    return localStorage.getItem(storageKey('hint.axes')) === '1';
  } catch {
    return false;
  }
}

function markHintDone(): void {
  try {
    localStorage.setItem(storageKey('hint.axes'), '1');
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
}

/**
 * En el paso «Arrastra el círculo en la punta del eje x y gíralos», si a los 6 s nadie tocó el asa,
 * el asa pulsa y una mano fantasma muestra el arrastre (un arco en torno al origen). Una sola vez.
 */
function mountAxisHint(app: HTMLElement, host: GameHost): void {
  const ring = h('div', { class: 'axis-pulse', 'aria-hidden': 'true' });
  const hand = h('div', { class: 'ghost-hand', 'aria-hidden': 'true' });
  hand.innerHTML =
    '<svg viewBox="0 0 32 32" width="32" height="32"><path d="M11 30c-2-3-6-8-6-11 0-1.6 1.7-2.3 3-1l3 3V6a2 2 0 0 1 4 0v8h1V4a2 2 0 0 1 4 0v10h1V6a2 2 0 0 1 4 0v9h1V9a2 2 0 0 1 4 0v12c0 4-2 7-4 9z" fill="currentColor" stroke="var(--bg)" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  ring.hidden = true;
  hand.hidden = true;
  app.append(ring, hand);
  let since = 0;
  let touched = hintDone();
  let t0 = 0;
  const onStep = () => host.story.site?.id === 'vacio' && host.story.progress.step === 1 && !host.story.free;
  // tocar cerca del asa cuenta como haberla encontrado
  document.getElementById('cv')!.addEventListener('pointerdown', (e) => {
    const ax = host.axisOnScreen();
    if (!onStep() || !ax) return;
    if (Math.hypot(e.clientX - ax.handle.x, e.clientY - ax.handle.y) < 48) {
      touched = true;
      markHintDone();
    }
  });
  const frame = (now: number) => {
    const ax = onStep() && !touched && !introOpen() ? host.axisOnScreen() : null;
    if (!ax) {
      since = 0;
      ring.hidden = true;
      hand.hidden = true;
    } else {
      if (!since) since = now;
      if (now - since >= HINT_AFTER_S * 1000) {
        if (ring.hidden) t0 = now;
        ring.hidden = false;
        ring.style.transform = `translate(${ax.handle.x}px, ${ax.handle.y}px)`;
        if (!reducedMotion()) {
          // la mano recorre un arco de 0° a 35° en torno al origen, y vuelve a empezar
          const R = Math.hypot(ax.handle.x - ax.origin.x, ax.handle.y - ax.origin.y);
          const a0 = Math.atan2(ax.handle.y - ax.origin.y, ax.handle.x - ax.origin.x);
          const k = ((now - t0) % 2400) / 2400;
          const move = k < 0.15 ? 0 : k < 0.75 ? (k - 0.15) / 0.6 : 1;
          const ease = move < 0.5 ? 2 * move * move : 1 - (-2 * move + 2) ** 2 / 2;
          const a = a0 - ease * (35 * Math.PI) / 180;
          hand.hidden = false;
          hand.style.opacity = k > 0.88 ? String((1 - k) / 0.12) : '1';
          hand.style.transform = `translate(${ax.origin.x + R * Math.cos(a) - 10}px, ${ax.origin.y + R * Math.sin(a) - 2}px)`;
        }
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// ---------- kiosco ----------

/** Tras un rato sin nadie, «¿Sigues ahí?» con cuenta regresiva; si nadie toca, vuelve al comienzo. */
function mountKiosk(app: HTMLElement, host: GameHost): void {
  const count = h('span', { class: 'count' }, String(KIOSK_COUNTDOWN_S));
  const stay = h('button', { class: 'btn primary big', type: 'button' }, 'Sigo aquí');
  const box = h(
    'div',
    { class: 'demo-idle', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'idleTitle', 'aria-describedby': 'idleText' },
    h(
      'div',
      { class: 'idle-body' },
      h('h2', { id: 'idleTitle' }, '¿Sigues ahí?'),
      h('p', { id: 'idleText' }, 'Si nadie toca la pantalla, el juego vuelve al comienzo en ', count, ' s.'),
      stay,
    ),
  );
  box.hidden = true;
  app.append(box);
  let last = performance.now();
  let asking = 0;
  const wake = () => {
    last = performance.now();
    if (asking) {
      asking = 0;
      box.hidden = true;
    }
  };
  for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, wake, { capture: true, passive: true });
  stay.addEventListener('click', wake);
  setInterval(() => {
    const now = performance.now();
    // en la entrada sin nada jugado no hay nada que borrar
    const p = host.story.progress;
    const played = Object.keys(p.solved).length > 0 || p.step > 0 || !introOpen();
    if (!played) {
      last = now;
      return;
    }
    if (!asking && now - last >= KIOSK_IDLE_S * 1000) {
      asking = now;
      box.hidden = false;
      stay.focus();
    }
    if (asking) {
      const left = Math.max(0, KIOSK_COUNTDOWN_S - Math.floor((now - asking) / 1000));
      count.textContent = String(left);
      if (left <= 0) resetDemo();
    }
  }, 250);
}

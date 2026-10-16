import { fmt } from '../core/format';
import { $, setText } from './dom';

/**
 * Línea de tiempo: un deslizador entre t = 0 y el instante más lejano recorrido.
 * Al arrastrarlo se va a ese instante (como mucho una vez por cuadro, porque ir a un instante
 * significa recalcular desde t = 0).
 */
export class Timeline {
  private el = $('timeline');
  private input = $<HTMLInputElement>('tl');
  private out = $('tlOut');
  private app = $('app');
  private dragging = false;
  private pending: number | null = null;

  constructor(onSeek: (t: number) => void) {
    this.input.addEventListener('input', () => {
      this.paint();
      const first = this.pending === null;
      this.pending = Number(this.input.value);
      if (first) {
        requestAnimationFrame(() => {
          const t = this.pending;
          this.pending = null;
          if (t !== null) onSeek(t);
        });
      }
    });
    this.input.addEventListener('pointerdown', () => (this.dragging = true));
    const release = () => (this.dragging = false);
    this.input.addEventListener('pointerup', release);
    this.input.addEventListener('pointercancel', release);
    this.input.addEventListener('blur', release);
  }

  /** Cada cuadro: mostrar u ocultar y seguir el reloj mientras no se arrastra. */
  update(visible: boolean, t: number, duration: number): void {
    if (this.el.hidden === visible) {
      this.el.hidden = !visible;
      this.app.classList.toggle('has-timeline', visible);
    }
    if (!visible) return;
    const max = Math.max(duration, 0.005);
    if (this.input.max !== String(max)) this.input.max = String(max);
    if (!this.dragging && this.pending === null) this.input.value = String(t);
    this.paint();
    setText(this.out, `${fmt(t)} s`);
  }

  /** Riel recorrido hasta la perilla (el deslizador nativo no lo dibuja igual en todos los navegadores). */
  private paint(): void {
    const max = Number(this.input.max) || 1;
    const p = `${((100 * Number(this.input.value)) / max).toFixed(2)}%`;
    if (this.input.style.getPropertyValue('--p') !== p) this.input.style.setProperty('--p', p);
  }
}

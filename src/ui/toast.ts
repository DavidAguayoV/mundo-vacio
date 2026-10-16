import { $ } from './dom';

export class Toast {
  private el = $('toast');
  private timer = 0;

  show(msg: string, ms = 2600): void {
    this.el.textContent = msg;
    this.el.classList.add('show');
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.el.classList.remove('show'), ms);
  }
}

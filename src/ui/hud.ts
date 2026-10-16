import { fmt, fmtVec } from '../core/format';
import type { Simulation } from '../physics/simulation';
import { IDENTITY_FRAME } from '../world/frame';
import type { World } from '../world/world';
import { $, h, setText } from './dom';

/** Datos siempre visibles: tiempo, g en los ejes del usuario y la escala. */
export class Hud {
  private el = $('hud');
  private t = h('div');
  private g = h('div', { class: 'g' });
  private scale = h('div', {}, '1 cuadro = 1 m');
  private medium = h('div');
  private fps = h('div');
  private lastKey = '';

  constructor(private showFps = false) {}

  update(world: World, sim: Simulation, simEnabled: boolean, fps: number): void {
    const key = `${simEnabled}|${!!world.g}|${!!world.frame}|${!!world.medium}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      const items: HTMLElement[] = [];
      if (simEnabled) items.push(this.t);
      if (world.g) items.push(this.g);
      if (world.medium) items.push(this.medium);
      if (world.frame) items.push(this.scale);
      if (world.medium) setText(this.medium, `medio: ${world.medium}`);
    if (this.showFps) items.push(this.fps);
      this.el.replaceChildren(...items);
    }
    const slow = sim.timeScale === 0.5 ? ' · cámara lenta ×½' : sim.timeScale === 0.25 ? ' · cámara lenta ×¼' : '';
    if (simEnabled) setText(this.t, `t = ${fmt(sim.t)} s${slow}`);
    if (world.g) setText(this.g, `g = ${fmtVec((world.frame ?? IDENTITY_FRAME).toUser(world.g), 'm/s²')}`);
    if (this.showFps) setText(this.fps, `${fmt(fps, 0)} fps · ${world.particles.length} part.`);
  }
}

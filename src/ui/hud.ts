import { fmt, fmtDeg, fmtVec } from '../core/format';
import type { Simulation } from '../physics/simulation';
import type { Vec2 } from '../core/vec';
import { IDENTITY_FRAME } from '../world/frame';
import type { World } from '../world/world';
import { $, h, setText } from './dom';

/** Datos siempre visibles, en voz baja: el tiempo, g en los ejes del usuario y lo que cambia el mundo (el medio). */
export class Hud {
  private el = $('hud');
  private t = h('div', { class: 't' });
  private g = h('div', { class: 'g' });
  private scale = h('div', { class: 'quiet' }, 'malla de 1 m');
  private axes = h('div', { class: 'quiet' });
  private medium = h('div');
  private fps = h('div', { class: 'quiet' });
  private lastKey = '';

  constructor(private showFps = false) {}

  /** @param focus punto cuya g se muestra cuando el mundo tiene regiones (la partícula elegida) */
  update(world: World, sim: Simulation, simEnabled: boolean, fps: number, focus?: Vec2): void {
    const gHere = world.regions.length ? world.gAt(focus ?? world.frame?.origin ?? { x: 0, y: 0 }) : world.g;
    const turned = !!world.frame && Math.abs(world.frame.angle) > 0.004;
    const key = `${simEnabled}|${!!gHere}|${!!world.frame}|${!!world.medium}|${turned}`;
    if (key !== this.lastKey) {
      this.lastKey = key;
      const items: HTMLElement[] = [];
      if (simEnabled) items.push(this.t);
      if (gHere) items.push(this.g);
      if (world.medium) items.push(this.medium);
      if (world.frame) items.push(this.scale);
      if (turned) items.push(this.axes);
      if (this.showFps) items.push(this.fps);
      this.el.replaceChildren(...items);
    }
    if (world.medium) setText(this.medium, `medio: ${world.medium}`);
    // cuánto giraste los ejes (respecto de la horizontal de la pantalla)
    if (turned && world.frame) setText(this.axes, `ejes girados ${fmtDeg((world.frame.angle * 180) / Math.PI)}`);
    const slow = sim.timeScale === 0.5 ? '  ×½' : sim.timeScale === 0.25 ? '  ×¼' : '';
    if (simEnabled) setText(this.t, `t = ${fmt(sim.t)} s${slow}`);
    if (gHere) {
      const where = world.regions.length ? ` (${world.regionAt(focus ?? world.frame?.origin ?? { x: 0, y: 0 })?.name ?? 'aquí'})` : '';
      setText(this.g, `g = ${fmtVec((world.frame ?? IDENTITY_FRAME).toUser(gHere), 'm/s²')}${where}`);
    }
    if (this.showFps) setText(this.fps, `${fmt(fps, 0)} fps, ${world.particles.length} part.`);
  }
}

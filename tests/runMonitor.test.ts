import { describe, expect, it } from 'vitest';
import type { GameEventType } from '../src/core/events';
import { SurfaceConstraint } from '../src/physics/constraints';
import { FrictionForce, NormalForce, UniformGravity } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { RunMonitor } from '../src/story/runMonitor';
import { World } from '../src/world/world';

/** Deja caer una partícula sobre una pendiente de α grados y devuelve los eventos del relato. */
function dropOnIncline(alphaDeg: number): GameEventType[] {
  const world = new World();
  world.g = { x: 0, y: -9.8 };
  const a = (alphaDeg * Math.PI) / 180;
  world.addSurface({ x: -6, y: 0 }, { x: -6 + 12 * Math.cos(a), y: 12 * Math.sin(a) }); // μₛ 0,6, μc 0,4
  world.addParticle({ x: 0, y: 6 * Math.tan(a) + 2 }, 1); // 2 m sobre la superficie
  const sim = new Simulation(world);
  const sc = new SurfaceConstraint(() => world.surfaces);
  sim.constraints.push(sc);
  sim.forces.push(new UniformGravity(), new NormalForce(sc.contacts), new FrictionForce(sc.contacts));
  const events: GameEventType[] = [];
  const monitor = new RunMonitor(world, sim, (ev) => events.push(ev.type));
  sim.start();
  for (let k = 0; k < 180; k++) {
    sim.advance(1 / 60);
    monitor.update();
  }
  return events;
}

describe('eventos del capítulo 6', () => {
  it('en el suelo plano: cae y se apoya, pero no cuenta como pendiente', () => {
    const ev = dropOnIncline(0);
    expect(ev).toContain('landed');
    expect(ev).not.toContain('held');
    expect(ev).not.toContain('slid');
  });

  it('con poca inclinación (tan α < μc) se detiene y el roce la sostiene', () => {
    const ev = dropOnIncline(15);
    expect(ev).toContain('landed');
    expect(ev).toContain('held');
    expect(ev).not.toContain('slid');
  });

  it('con mucha inclinación (tan α > μₛ) desliza acelerando', () => {
    const ev = dropOnIncline(40);
    expect(ev).toContain('slid');
    expect(ev).not.toContain('held');
  });
});

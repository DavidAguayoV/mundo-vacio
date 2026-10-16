import { describe, expect, it } from 'vitest';
import { SurfaceConstraint } from '../src/physics/constraints';
import { FrictionForce, NormalForce, UniformGravity } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { World } from '../src/world/world';

/** Una partícula lanzada que cae sobre una pendiente con roce: pone a prueba contactos y roce al recalcular. */
function scene() {
  const world = new World();
  world.g = { x: 0, y: -9.8 };
  const a = (25 * Math.PI) / 180;
  world.addSurface({ x: -6, y: -2 }, { x: -6 + 12 * Math.cos(a), y: -2 + 12 * Math.sin(a) });
  world.addParticle({ x: -3, y: 3 }, 1, { x: 2, y: 1 });
  world.addParticle({ x: 1, y: 4 }, 3, { x: -1, y: 0 });
  const sim = new Simulation(world);
  const sc = new SurfaceConstraint(() => world.surfaces);
  sim.constraints.push(sc);
  sim.forces.push(new UniformGravity(), new NormalForce(sc.contacts), new FrictionForce(sc.contacts));
  const state = () => world.particles.map((p) => [p.pos.x, p.pos.y, p.vel.x, p.vel.y]);
  return { world, sim, state };
}

describe('control del tiempo', () => {
  it('diez pasos de 0,1 s equivalen a un segundo fluyendo', () => {
    const a = scene();
    for (let k = 0; k < 10; k++) a.sim.stepBy(0.1);
    const b = scene();
    b.sim.start();
    for (let k = 0; k < 60; k++) b.sim.advance(1 / 60);
    expect(a.sim.t).toBeCloseTo(1, 12);
    expect(a.state()).toEqual(b.state());
    expect(a.sim.running).toBe(false);
  });

  it('ir hacia atrás en la línea de tiempo reproduce exactamente el pasado', () => {
    const { sim, state } = scene();
    sim.start();
    for (let k = 0; k < 60; k++) sim.advance(1 / 60);
    const at1 = state();
    for (let k = 0; k < 120; k++) sim.advance(1 / 60);
    expect(sim.duration).toBeCloseTo(3, 9);
    sim.seek(1);
    expect(sim.t).toBeCloseTo(1, 12);
    expect(state()).toEqual(at1);
    // la línea de tiempo conserva su largo aunque se esté mirando el pasado
    expect(sim.duration).toBeCloseTo(3, 9);
    expect(sim.trails.get(sim['world'].particles[0].id)!.length).toBe(11);
  });

  it('seguir fluyendo desde un instante del pasado da el mismo futuro', () => {
    const a = scene();
    a.sim.start();
    for (let k = 0; k < 180; k++) a.sim.advance(1 / 60);
    const b = scene();
    b.sim.start();
    for (let k = 0; k < 150; k++) b.sim.advance(1 / 60);
    b.sim.seek(0.7);
    b.sim.start();
    for (let k = 0; k < 138; k++) b.sim.advance(1 / 60);
    expect(b.sim.t).toBeCloseTo(3, 9);
    expect(b.state()).toEqual(a.state());
  });

  it('volver a t = 0 deja todo como al lanzar', () => {
    const { sim, world, state } = scene();
    const start = state();
    sim.stepBy(0.5);
    sim.reset();
    expect(state()).toEqual(start);
    expect(sim.hasRun).toBe(false);
    expect(world.particles[0].pos).toEqual({ x: -3, y: 3 });
  });
});

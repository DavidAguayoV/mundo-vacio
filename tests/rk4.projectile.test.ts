import { describe, expect, it } from 'vitest';
import { UniformGravity, makeAccel } from '../src/physics/forces';
import { RK4Integrator } from '../src/physics/integrator';
import { Simulation } from '../src/physics/simulation';
import { stateFromBodies } from '../src/physics/state';

describe('proyectil con RK4', () => {
  const g = { x: 0, y: -9.8 };
  const r0 = { x: -3, y: 1.5 };
  const v0 = { x: 4, y: 6 };
  const exact = (t: number) => ({
    x: r0.x + v0.x * t + 0.5 * g.x * t * t,
    y: r0.y + v0.y * t + 0.5 * g.y * t * t,
  });

  it('coincide con la solución analítica a los 2 s (error < 1e-6 m)', () => {
    const body = { id: 'p', pos: { ...r0 }, vel: { ...v0 }, mass: 2.5 };
    const s = stateFromBodies([body]);
    const accel = makeAccel([new UniformGravity()], { g });
    const rk4 = new RK4Integrator();
    for (let k = 0; k < 480; k++) rk4.step(s, 1 / 240, accel);
    const e = exact(2);
    expect(s.t).toBeCloseTo(2, 12);
    expect(Math.hypot(body.pos.x - e.x, body.pos.y - e.y)).toBeLessThan(1e-6);
    expect(Math.hypot(body.vel.x - v0.x, body.vel.y - (v0.y + g.y * 2))).toBeLessThan(1e-6);
  });

  it('la masa no cambia la caída', () => {
    const light = { id: 'a', pos: { x: 0, y: 0 }, vel: { x: 1, y: 2 }, mass: 0.25 };
    const heavy = { id: 'b', pos: { x: 0, y: 0 }, vel: { x: 1, y: 2 }, mass: 64 };
    const world = { g, particles: [light, heavy] };
    const sim = new Simulation(world);
    sim.forces.push(new UniformGravity());
    sim.start();
    for (let k = 0; k < 100; k++) sim.advance(0.02);
    expect(light.pos.x).toBeCloseTo(heavy.pos.x, 12);
    expect(light.pos.y).toBeCloseTo(heavy.pos.y, 12);
  });

  it('la simulación con acumulador da el mismo resultado con cuadros irregulares', () => {
    const run = (frames: number[]) => {
      const p = { id: 'p', pos: { ...r0 }, vel: { ...v0 }, mass: 1 };
      const sim = new Simulation({ g, particles: [p] });
      sim.forces.push(new UniformGravity());
      sim.start();
      for (const f of frames) sim.advance(f);
      return { p, sim };
    };
    const even = run(Array(120).fill(1 / 60)); // 2 s a 60 fps
    const uneven = run(Array(60).fill(0.01).concat(Array(50).fill(0.028))); // 2 s a saltos
    expect(even.sim.t).toBeCloseTo(2, 9);
    expect(uneven.sim.t).toBeCloseTo(2, 9);
    expect(even.p.pos.y).toBeCloseTo(uneven.p.pos.y, 9);
    // marcas estroboscópicas: una inicial + una cada 0,1 s
    expect(even.sim.trails.get('p')!.length).toBe(21);
  });

  it('reiniciar devuelve el estado inicial', () => {
    const p = { id: 'p', pos: { ...r0 }, vel: { ...v0 }, mass: 1 };
    const sim = new Simulation({ g, particles: [p] });
    sim.forces.push(new UniformGravity());
    sim.start();
    for (let k = 0; k < 30; k++) sim.advance(1 / 60);
    sim.reset();
    expect(p.pos).toEqual(r0);
    expect(p.vel).toEqual(v0);
    expect(sim.hasRun).toBe(false);
  });
});

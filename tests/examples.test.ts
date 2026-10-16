import { describe, expect, it } from 'vitest';
import { dist } from '../src/core/vec';
import { EXAMPLES } from '../src/lab/examples';
import { parseExperiment } from '../src/lab/experiment';
import { SurfaceConstraint } from '../src/physics/constraints';
import { FrictionForce, NormalForce, UniformGravity } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { worldFromJSON } from '../src/world/serialize';

function load(id: string) {
  const world = worldFromJSON(EXAMPLES.find((e) => e.id === id)!.build().world);
  const sim = new Simulation(world);
  const sc = new SurfaceConstraint(() => world.surfaces);
  sim.constraints.push(sc);
  sim.forces.push(new UniformGravity(), new NormalForce(sc.contacts), new FrictionForce(sc.contacts));
  return { world, sim };
}

describe('ejemplos incluidos', () => {
  it('todos son experimentos válidos', () => {
    for (const e of EXAMPLES) expect(() => parseExperiment(e.build())).not.toThrow();
  });

  it('el tiro parabólico pasa por el blanco', () => {
    const { world, sim } = load('tiro');
    const t = world.targets[0];
    let best = Infinity;
    sim.onStep.push(() => (best = Math.min(best, dist(world.particles[0].pos, t.pos))));
    sim.start();
    for (let k = 0; k < 120; k++) sim.advance(1 / 60);
    expect(best).toBeLessThan(t.radius);
  });

  it('en los planos: a 20° se queda, a 40° desliza', () => {
    const { world, sim } = load('planos');
    const [p20, p40] = world.particles.map((p) => ({ p, start: { ...p.pos } }));
    sim.start();
    for (let k = 0; k < 60; k++) sim.advance(1 / 60);
    expect(dist(p20.p.pos, p20.start)).toBeLessThan(1e-9);
    expect(dist(p40.p.pos, p40.start)).toBeGreaterThan(0.5);
  });

  it('las partículas de los planos están apoyadas desde el inicio', () => {
    const { world, sim } = load('mu');
    sim.start();
    expect(sim.contactNormal(world.particles[0].id)).not.toBeNull();
  });
});

describe('ejemplo de resorte', () => {
  it('el período medido es 2π√(m/k)', async () => {
    const { SpringForces } = await import('../src/physics/forces');
    const { OscillationMeter } = await import('../src/physics/oscillationMeter');
    const world = worldFromJSON(EXAMPLES.find((e) => e.id === 'resorte')!.build().world);
    const sim = new Simulation(world);
    sim.forces.push(new UniformGravity(), new SpringForces(() => world.springs));
    const meter = new OscillationMeter(sim, () => world.springs.map((s) => ({ id: s.id, length: world.springLength(s) })));
    sim.start();
    for (let k = 0; k < 240; k++) sim.advance(1 / 60);
    const T = meter.period(world.springs[0].id)!;
    expect(Math.abs(T - 2 * Math.PI * Math.sqrt(1 / 20))).toBeLessThan(1 / 240 + 1e-9);
  });
});

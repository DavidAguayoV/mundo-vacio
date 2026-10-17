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

describe('laboratorios con guía', () => {
  it('cada laboratorio tiene objetivo, qué medir y preguntas', () => {
    for (const e of EXAMPLES) {
      expect(e.guide, e.id).toBeDefined();
      expect(e.guide!.goal.length).toBeGreaterThan(20);
      expect(e.guide!.measure.length).toBeGreaterThan(0);
      expect(e.guide!.questions.length).toBeGreaterThan(0);
    }
  });

  it('los deslizadores leen y cambian el mundo, dentro de su rango', () => {
    for (const e of EXAMPLES) {
      const world = worldFromJSON(e.build().world);
      for (const c of e.guide?.controls ?? []) {
        const v0 = c.get(world);
        expect(v0, `${e.id}/${c.id}`).not.toBeNull();
        expect(v0!).toBeGreaterThanOrEqual(c.min - 1e-9);
        expect(v0!).toBeLessThanOrEqual(c.max + 1e-9);
        const target = c.min + (c.max - c.min) * 0.3;
        c.set(world, target);
        expect(c.get(world)!, `${e.id}/${c.id}`).toBeCloseTo(target, 6);
      }
    }
  });

  it('cambiar |g| conserva su dirección y el ángulo conserva la rapidez', () => {
    const tiro = EXAMPLES.find((e) => e.id === 'tiro')!;
    const world = worldFromJSON(tiro.build().world);
    const ctl = (id: string) => tiro.guide!.controls!.find((c) => c.id === id)!;
    ctl('g').set(world, 1.62);
    expect(world.g).toEqual({ x: 0, y: -1.62 });
    const speed = Math.hypot(world.particles[0].vel.x, world.particles[0].vel.y);
    ctl('a0').set(world, 30);
    expect(Math.hypot(world.particles[0].vel.x, world.particles[0].vel.y)).toBeCloseTo(speed, 9);
    expect(Math.atan2(world.particles[0].vel.y, world.particles[0].vel.x)).toBeCloseTo(Math.PI / 6, 9);
  });
});

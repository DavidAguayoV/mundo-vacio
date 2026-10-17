import { describe, expect, it } from 'vitest';
import { SurfaceConstraint } from '../src/physics/constraints';
import { FrictionForce, NormalForce, SpringForces, UniformGravity, WorldDrag, WorldGravitation } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress, type Progress } from '../src/state/progress';
import { SiteEngine } from '../src/story/siteEngine';
import { SITES, ZONES } from '../src/story/sites';
import { World } from '../src/world/world';

const G = 9.8;

/** Un rastro con toda la física del juego (como en f3.test.ts). */
function site(id: string) {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = new Simulation(world);
  const surfaces = new SurfaceConstraint(() => world.surfaces);
  sim.constraints.push(surfaces);
  sim.forces.push(
    new UniformGravity(),
    new SpringForces(() => world.springs),
    new WorldGravitation(() => world.gravitation),
    new WorldDrag(() => world.medium),
    new NormalForce(surfaces.contacts),
    new FrictionForce(surfaces.contacts),
  );
  sim.maxTime = 30;
  const all = new Set(SITES.flatMap((s) => [...(s.grants ?? []), ...s.steps.flatMap((st) => st.grants ?? [])]));
  const p: Progress = { ...freshProgress(), site: null, have: [...all] };
  const story = new SiteEngine(SITES, ZONES, p, { world, view, sim }, () => {});
  expect(story.enter(id)).toBe(true);
  const run = (seconds: number) => {
    sim.start();
    for (let i = 0; i < Math.round(seconds * 60) && !story.done; i++) {
      sim.advance(1 / 60);
      story.tick();
    }
  };
  return { world, sim, story, run };
}

describe('la central: el calor', () => {
  it('«¿Adónde se fue?»: se detiene, Q = 8 J y queda la explicación', () => {
    const s = site('adonde');
    s.story.choose('igual');
    s.run(4);
    expect(s.story.progress.step).toBe(2);
    expect(s.sim.heat).toBeCloseTo(8, 2);
    expect(s.story.stars('adonde')).not.toContain('masa');
  });

  it('«¿Adónde se fue?»: con el doble de masa se detiene en el mismo lugar y da la estrella', () => {
    const a = site('adonde');
    a.story.choose('igual');
    a.run(4);
    const x1 = a.world.particles[0].pos.x;
    const b = site('adonde');
    b.world.particles[0].mass = 2;
    b.story.choose('igual');
    b.run(4);
    expect(b.world.particles[0].pos.x).toBeCloseTo(x1, 6);
    expect(b.story.stars('adonde')).toContain('masa');
  });

  it('«El golpe»: desde 2 m el choque se lleva m g h; desde 1 m, 9,8 J y la estrella', () => {
    const a = site('golpe');
    a.run(2);
    expect(a.story.progress.step).toBe(1);
    expect(a.sim.heat).toBeCloseTo(2 * G, 2);
    expect(a.story.stars('golpe')).not.toContain('mitad');

    const b = site('golpe');
    b.world.particles[0].pos.y -= 1;
    b.run(2);
    expect(b.story.stars('golpe')).toContain('mitad');
  });

  it('«Justo en la marca»: con v = √(2 μc g d) se detiene en la baliza; con el doble, no', () => {
    const v = Math.sqrt(2 * 0.3 * G * 3);
    const a = site('marca');
    a.story.choose('cuatro');
    a.world.particles[0].vel = { x: v, y: 0 };
    a.run(4);
    expect(a.story.progress.step).toBe(2);
    expect(a.story.stars('marca')).toContain('primera');

    const b = site('marca');
    b.story.choose('cuatro');
    b.world.particles[0].vel = { x: 2 * v, y: 0 };
    b.run(6);
    expect(b.story.progress.step).toBe(1);
    // cuatro veces más lejos: 12 m, pero el suelo se acaba antes y cae
    expect(b.world.particles[0].pos.x).toBeGreaterThan(-5 + 3 + 0.35);
  });
});

import { describe, expect, it } from 'vitest';
import type { GameEvent } from '../src/core/events';
import { dist, len } from '../src/core/vec';
import { SurfaceConstraint } from '../src/physics/constraints';
import { FrictionForce, G_GAME, NormalForce, SpringForces, UniformGravity, WorldDrag, WorldGravitation } from '../src/physics/forces';
import { OscillationMeter } from '../src/physics/oscillationMeter';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress, type Progress } from '../src/state/progress';
import { RunMonitor } from '../src/story/runMonitor';
import { SiteEngine } from '../src/story/siteEngine';
import { SITES, ZONES } from '../src/story/sites';
import { World } from '../src/world/world';

/** Un rastro con toda la física del juego, el monitor de lanzamientos y el cronómetro de resortes. */
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
  const events: GameEvent['type'][] = [];
  const emit = (ev: GameEvent) => {
    events.push(ev.type);
    story.handle(ev);
  };
  const monitor = new RunMonitor(world, sim, emit);
  const meter = new OscillationMeter(sim, () => world.springs.map((s) => ({ id: s.id, length: world.springLength(s) })));
  meter.onFirstPeriod = () => emit({ type: 'oscillated' });
  expect(story.enter(id)).toBe(true);
  const run = (seconds: number) => {
    sim.start();
    for (let i = 0; i < Math.round(seconds * 60) && !story.done; i++) {
      sim.advance(1 / 60);
      monitor.update();
      story.tick();
    }
  };
  return { world, sim, story, events, run };
}

describe('el taller', () => {
  it('«Al mismo compás»: con 2 kg queda afinado; con k = 40 y 4 kg, también, y da la estrella', () => {
    const a = site('sintonia');
    const mine = a.world.particles.find((p) => !p.locked)!;
    mine.mass = 2;
    a.run(5);
    expect(a.story.progress.step).toBe(1);
    expect(a.story.stars('sintonia')).not.toContain('otro-k');

    const b = site('sintonia');
    const me = b.world.particles.find((p) => !p.locked)!;
    me.mass = 4;
    b.world.springs.find((s) => !s.locked)!.k = 40;
    b.run(5);
    expect(b.story.progress.step).toBe(1);
    expect(b.story.stars('sintonia')).toContain('otro-k');
  });

  it('el resorte que marca el ritmo no se puede borrar', () => {
    const { world } = site('sintonia');
    const ref = world.springs.find((s) => s.locked)!;
    expect(world.isProtected({ kind: 'spring', id: ref.id })).toBe(true);
  });
});

describe('el astro', () => {
  it('«En órbita»: con la velocidad circular da la vuelta y la órbita es casi redonda', () => {
    const { world, story, run } = site('orbita');
    const [big, small] = [...world.particles].sort((x, y) => y.mass - x.mass);
    const r = dist(big.pos, small.pos);
    const v = Math.sqrt((G_GAME * (big.mass + small.mass)) / r);
    // de lado, perpendicular a la línea que las une
    const ux = (small.pos.x - big.pos.x) / r;
    const uy = (small.pos.y - big.pos.y) / r;
    small.vel = { x: -uy * v, y: ux * v };
    run(12);
    expect(story.progress.step).toBe(1); // dio la vuelta: queda la explicación
    expect(story.stars('orbita')).toContain('circular');
  });

  it('«Escapar»: un poco más que la velocidad de escape se va y da la estrella', () => {
    const { world, story, run } = site('escape');
    story.choose('escapa');
    const [big, small] = [...world.particles].sort((x, y) => y.mass - x.mass);
    const r = dist(big.pos, small.pos);
    const vesc = Math.sqrt((2 * G_GAME * (big.mass + small.mass)) / r);
    const ux = (small.pos.x - big.pos.x) / r;
    const uy = (small.pos.y - big.pos.y) / r;
    small.vel = { x: ux * vesc * 1.05, y: uy * vesc * 1.05 };
    run(12);
    expect(story.progress.step).toBe(2);
    expect(story.stars('escape')).toContain('justo');
  });
});

describe('el mar', () => {
  it('«El paracaídas»: 1 kg en el aire se rompe; en agua llega suave', () => {
    const air = site('paracaidas');
    air.world.medium = 'aire';
    air.run(6);
    expect(air.story.progress.step).toBe(0);

    const water = site('paracaidas');
    water.world.medium = 'agua';
    water.run(10);
    expect(water.story.progress.step).toBe(1);
    expect(water.story.stars('paracaidas')).not.toContain('en-aire');
  });

  it('«El paracaídas»: con 0,25 kg en el aire también, y da la estrella', () => {
    const s = site('paracaidas');
    s.world.medium = 'aire';
    s.world.particles[0].mass = 0.25;
    s.run(8);
    expect(s.story.progress.step).toBe(1);
    expect(s.story.stars('paracaidas')).toContain('en-aire');
  });
});

describe('la central', () => {
  it('«Justo hasta arriba»: con v = √(2 g h) se detiene en el blanco', () => {
    const { world, story, run } = site('altura');
    const p = world.particles[0];
    const h = dist(p.pos, world.beacons[0].pos);
    p.vel = { x: 0, y: Math.sqrt(2 * 9.8 * h) };
    run(2);
    expect(story.progress.step).toBe(1);
    expect(story.stars('altura')).toContain('primera');
  });

  it('con poca velocidad no llega', () => {
    const { world, story, run } = site('altura');
    world.particles[0].vel = { x: 0, y: 8 };
    run(2);
    expect(story.progress.step).toBe(0);
    expect(len(world.particles[0].vel)).toBeGreaterThanOrEqual(0);
  });
});

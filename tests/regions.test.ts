import { describe, expect, it } from 'vitest';
import { SurfaceConstraint } from '../src/physics/constraints';
import { FrictionForce, NormalForce, UniformGravity } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress, type Progress } from '../src/state/progress';
import { RunMonitor } from '../src/story/runMonitor';
import { SiteEngine } from '../src/story/siteEngine';
import { SITES, ZONES } from '../src/story/sites';
import type { GameEvent } from '../src/core/events';
import { worldFromJSON, worldToJSON } from '../src/world/serialize';
import { G_EARTH, World } from '../src/world/world';

/** Simulación con gravedad, superficies, normal y roce, como en el juego. */
function physics(world: World) {
  const sim = new Simulation(world);
  const surfaces = new SurfaceConstraint(() => world.surfaces);
  sim.constraints.push(surfaces);
  sim.forces.push(new UniformGravity(), new NormalForce(surfaces.contacts), new FrictionForce(surfaces.contacts));
  sim.maxTime = 30;
  return sim;
}

const run = (sim: Simulation, seconds: number, each?: () => void) => {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    sim.advance(1 / 60);
    each?.();
  }
};

describe('regiones con su propia gravedad', () => {
  it('cada partícula cae con la g de la región donde está', () => {
    const w = new World();
    w.g = { x: 0, y: -G_EARTH };
    w.regions = [{ id: 'r1', min: { x: 0, y: -100 }, max: { x: 100, y: 100 }, g: { x: 0, y: -1.62 }, name: 'Luna' }];
    const earth = w.addParticle({ x: -5, y: 0 }, 1);
    const moon = w.addParticle({ x: 5, y: 0 }, 1);
    const sim = physics(w);
    sim.start();
    run(sim, 1);
    expect(earth.vel.y).toBeCloseTo(-G_EARTH, 6);
    expect(moon.vel.y).toBeCloseTo(-1.62, 6);
    expect(w.gAt({ x: 5, y: 0 })).toEqual({ x: 0, y: -1.62 });
    expect(w.gAt({ x: -5, y: 0 })).toEqual({ x: 0, y: -G_EARTH });
  });

  it('las regiones se guardan con el mundo', () => {
    const w = new World();
    w.regions = [{ id: 'r1', min: { x: 0, y: 0 }, max: { x: 2, y: 2 }, g: null, name: 'Nada' }];
    const back = worldFromJSON(JSON.parse(JSON.stringify(worldToJSON(w))));
    expect(back.regions).toEqual(w.regions);
  });
});

function siteSetup(id: string, have: string[]) {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = physics(world);
  const p: Progress = { ...freshProgress(), site: null, have: have as Progress['have'] };
  const story = new SiteEngine(SITES, ZONES, p, { world, view, sim }, () => {});
  const events: GameEvent['type'][] = [];
  const monitor = new RunMonitor(world, sim, (ev) => {
    events.push(ev.type);
    story.handle(ev);
  });
  expect(story.enter(id)).toBe(true);
  return { world, sim, story, monitor, events };
}

describe('el pozo y las laderas', () => {
  it('«El rincón torcido»: soltada a la altura del blanco, cae de lado hasta él', () => {
    const { world, sim } = siteSetup('rincon', ['tool:gravity', 'tool:particle', 'time:flow']);
    const t = world.targets[0];
    const p = world.addParticle({ x: 4, y: t.pos.y }, 1);
    sim.start();
    let hit = false;
    run(sim, 2, () => (hit ||= Math.hypot(p.pos.x - t.pos.x, p.pos.y - t.pos.y) < t.radius));
    expect(hit).toBe(true);
    expect(p.vel.y).toBeCloseTo(0, 9);
  });

  it('«El mismo tiro en la Luna»: con la misma v₀ llega unas seis veces más lejos', () => {
    const { world, sim, story } = siteSetup('luna', ['tool:gravity', 'tool:velocity', 'time:flow']);
    const [earth, moon] = world.particles;
    moon.vel = { x: 1.5, y: 2.5 };
    story.progress = { ...story.progress, step: 2 };
    story.site!.steps[2].enter!(story.ctx);
    expect(earth.vel).toEqual(moon.vel);
    const x0 = { e: earth.pos.x, m: moon.pos.x };
    sim.start();
    run(sim, 4, () => story.tick());
    const ratio = (moon.pos.x - x0.m) / (earth.pos.x - x0.e);
    expect(ratio).toBeGreaterThan(4.5); // el roce al aterrizar frena un poco a las dos
    expect(story.progress.step).toBe(3);
  });

  it('«¿Se queda o desliza?»: la de 20° se queda, la de 40° desliza', () => {
    const { sim, monitor, events } = siteSetup('quedarse', ['tool:surface']);
    sim.start();
    run(sim, 1.5, () => monitor.update());
    expect(events).toContain('held');
    expect(events).toContain('slid');
  });

  it('«La pendiente justa»: el roce no se ve y desliza justo pasado tan α = μₛ', () => {
    const { world, sim, monitor, events } = siteSetup('mu', ['tool:surface']);
    const s = world.surfaces[0];
    expect(s.secret).toBe(true);
    // inclina el plano a 26° desde su extremo izquierdo, con la partícula encima
    const tilt = (deg: number) => {
      const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
      const th = (deg * Math.PI) / 180;
      s.b = { x: s.a.x + L * Math.cos(th), y: s.a.y + L * Math.sin(th) };
      const p = world.particles[0];
      p.pos = { x: s.a.x + 0.55 * (s.b.x - s.a.x), y: s.a.y + 0.55 * (s.b.y - s.a.y) };
      p.vel = { x: 0, y: 0 };
    };
    tilt(22);
    sim.start();
    run(sim, 1.5, () => monitor.update());
    expect(events).not.toContain('slid');
    sim.clearRun();
    tilt(26);
    sim.start();
    run(sim, 1.5, () => monitor.update());
    expect(events).toContain('slid');
  });
});

import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress, type Progress } from '../src/state/progress';
import { SiteEngine } from '../src/story/siteEngine';
import { SITES, ZONES } from '../src/story/sites';
import { EXAMPLES, RACE_LANE } from '../src/lab/examples';
import { placeOnPivot } from '../src/physics/rigid';
import { World } from '../src/world/world';
import { worldFromJSON } from '../src/world/serialize';

/** Un rastro de El puente: los cuerpos rígidos avanzan dentro de la simulación. */
function site(id: string) {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = new Simulation(world);
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

describe('el puente', () => {
  it('«La balanza»: 1 kg a 2 m la equilibra y da la estrella de una sola pesa; 1 kg a 1 m no', () => {
    const a = site('balanza');
    a.world.addLoad(a.world.bodies[0], 1, 1);
    a.run(4);
    expect(a.story.progress.step).toBe(0);

    const b = site('balanza');
    b.world.addLoad(b.world.bodies[0], 2, 1);
    b.run(4);
    expect(b.story.progress.step).toBe(1);
    expect(b.story.stars('balanza')).toContain('una');
  });

  it('«La palanca»: con el apoyo en el centro gana la carga; cerca de los 5 kg, 1 kg la levanta', () => {
    const a = site('palanca');
    a.run(2);
    expect(a.story.progress.step).toBe(0);

    const b = site('palanca');
    const rod = b.world.bodies[0];
    rod.pivot = { ...rod.pivot!, local: { x: 2.5, y: 0 }, at: { x: rod.pos.x + 2.5, y: rod.pos.y } };
    placeOnPivot(rod);
    b.run(2);
    expect(b.story.progress.step).toBe(1);
  });

  it('«La palanca»: con el apoyo a 1 m de la carga queda en equilibrio y da la estrella', () => {
    const s = site('palanca');
    const rod = s.world.bodies[0];
    rod.pivot = { ...rod.pivot!, local: { x: 2, y: 0 }, at: { x: rod.pos.x + 2, y: rod.pos.y } };
    placeOnPivot(rod);
    s.run(4);
    expect(s.story.stars('palanca')).toContain('equilibrio');
  });

  it('«La carrera»: tras predecir, llegan caja, disco y aro; con más masa el aro sigue último', () => {
    const s = site('carrera');
    s.story.choose('cda');
    s.world.bodies.find((b) => b.shape === 'ring')!.mass = 4;
    s.run(6);
    expect(s.story.progress.step).toBe(2);
    const t = (shape: string) => s.world.bodies.find((b) => b.shape === shape)!.roll!.arrived!;
    expect(t('box')).toBeLessThan(t('disc'));
    expect(t('disc')).toBeLessThan(t('ring'));
    expect(s.story.stars('carrera')).toContain('masa');
  });

  it('«El péndulo que no es un punto»: después de 6 s queda la explicación', () => {
    const s = site('pendulo');
    s.story.choose('barra');
    s.run(7);
    expect(s.story.progress.step).toBe(2);
  });
});

describe('laboratorios de cuerpos rígidos', () => {
  it('el balancín se equilibra con m₁ d₁ = m₂ d₂', () => {
    const ex = EXAMPLES.find((e) => e.id === 'balancin')!;
    const w = worldFromJSON(ex.build().world);
    const sim = new Simulation(w);
    const [m1, d1, m2, d2] = ex.guide!.controls!;
    m1.set(w, 2);
    d1.set(w, -1);
    m2.set(w, 4);
    d2.set(w, 0.5);
    sim.start();
    for (let i = 0; i < 240; i++) sim.advance(1 / 60);
    expect(Math.abs(w.bodies[0].angle)).toBeLessThan(1e-6);
  });

  it('en la carrera, más ángulo es más rápido', () => {
    const ex = EXAMPLES.find((e) => e.id === 'carrera')!;
    const time = (deg: number) => {
      const w = worldFromJSON(ex.build().world);
      ex.guide!.controls![0].set(w, deg);
      const sim = new Simulation(w);
      sim.start();
      for (let i = 0; i < 600 && w.bodies.some((b) => b.roll!.arrived === null); i++) sim.advance(1 / 60);
      return w.bodies.find((b) => b.shape === 'disc')!.roll!.arrived!;
    };
    const slow = time(10);
    const fast = time(40);
    expect(fast).toBeLessThan(slow);
    // tiempo de bajada: L = a t²/2, con L = largo − 2R (parte y para a un radio de cada punta) y a = (2/3) g sen α
    expect(fast).toBeCloseTo(Math.sqrt((2 * (RACE_LANE - 0.8)) / ((2 / 3) * 9.8 * Math.sin((40 * Math.PI) / 180))), 1);
  });
});

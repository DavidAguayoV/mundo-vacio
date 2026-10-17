import { describe, expect, it } from 'vitest';
import { UniformGravity } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress, type Progress } from '../src/state/progress';
import { MissMonitor, type MissWatch } from '../src/story/missMonitor';
import { SiteEngine, type StoryChange } from '../src/story/siteEngine';
import { OVERSHOOT_DEG, SITES, ZONES } from '../src/story/sites';
import type { Grant } from '../src/story/types';
import { World } from '../src/world/world';

// Correcciones de la auditoría de jugabilidad (tanda 2): retroalimentación.

function setup(progress: Progress = freshProgress()) {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = new Simulation(world);
  const changes: StoryChange[] = [];
  const story = new SiteEngine(SITES, ZONES, progress, { world, view, sim }, () => {});
  story.onChange = (c) => changes.push(c);
  return { world, story, sim, changes };
}

function having(solved: string[]): Progress {
  const p = freshProgress();
  p.site = null;
  const have = new Set<Grant>();
  for (const id of solved) {
    p.solved[id] = { stars: ['resuelto'], at: 1 };
    const s = SITES.find((x) => x.id === id)!;
    s.grants?.forEach((g) => have.add(g));
    s.steps.forEach((st) => st.grants?.forEach((g) => have.add(g)));
  }
  p.have = [...have];
  return p;
}

/** Un tiro: deja correr `seconds`, pausa y devuelve lo que avisaría el monitor. */
function shot(
  setupWorld: (w: World) => void,
  seconds: number,
  watch: MissWatch = { targets: true, buoys: true },
): { said: string[]; monitor: MissMonitor } {
  const world = new World();
  setupWorld(world);
  const sim = new Simulation(world);
  sim.forces.push(new UniformGravity());
  const said: string[] = [];
  const monitor = new MissMonitor(world, sim, (m) => said.push(m), () => watch);
  sim.onStep.push(() => monitor.sample());
  sim.start();
  for (let i = 0; i < 60 * seconds; i++) {
    sim.advance(1 / 60);
    monitor.update();
  }
  sim.pause();
  monitor.update();
  return { said, monitor };
}

const target = (w: World) => {
  w.g = { x: 0, y: -9.8 };
  w.targets = [{ id: 't1', pos: { x: 5, y: 0 }, radius: 0.45 }];
};

describe('fallos que informan', () => {
  it('un tiro que pasa sobre el blanco dice a qué distancia y que fue por arriba', () => {
    const { said } = shot((w) => {
      target(w);
      w.addParticle({ x: 0, y: 0 }, 1, { x: 5, y: 9 });
    }, 2.5);
    expect(said).toHaveLength(1);
    expect(said[0]).toMatch(/^Pasó a \d+,\d+ m del blanco, por arriba\.$/);
  });

  it('un tiro corto dice que se quedó corta', () => {
    const { said } = shot((w) => {
      target(w);
      w.addParticle({ x: 0, y: 0 }, 1, { x: 2, y: 3 });
    }, 2);
    expect(said[0]).toMatch(/del blanco: se quedó corta\.$/);
  });

  it('un tiro que cae antes de llegar a la vertical del blanco y la cruza más abajo, pasó por abajo', () => {
    const { said } = shot((w) => {
      target(w);
      w.addParticle({ x: 0, y: 0 }, 1, { x: 5, y: -2 });
    }, 2);
    expect(said[0]).toMatch(/del blanco, por abajo\.$/);
  });

  it('si acierta, no avisa nada', () => {
    // v tal que pasa por (5 ; 0) a t = 1 s: vₓ = 5, v_y = ½ g t² / t = 4,9
    const { said } = shot((w) => {
      target(w);
      w.addParticle({ x: 0, y: 0 }, 1, { x: 5, y: 4.9 });
    }, 2);
    expect(said).toEqual([]);
  });

  it('si se pausa antes del mayor acercamiento, todavía no hay fallo que contar', () => {
    const { said } = shot((w) => {
      target(w);
      w.addParticle({ x: 0, y: 0 }, 1, { x: 5, y: 9 });
    }, 0.3);
    expect(said).toEqual([]);
  });

  it('fuera de un rastro que espere el blanco, no avisa', () => {
    const { said } = shot(
      (w) => {
        target(w);
        w.addParticle({ x: 0, y: 0 }, 1, { x: 5, y: 9 });
      },
      2.5,
      { targets: false, buoys: false },
    );
    expect(said).toEqual([]);
  });

  const buoy = (v: { x: number; y: number }) => (w: World) => {
    w.g = null;
    w.addParticle({ x: 5, y: 3 }, 1, { x: -1.2, y: 0 }).locked = true;
    w.addParticle({ x: -3, y: -2 }, 1, v);
  };

  it('a la boya: si llega antes, lo dice', () => {
    const { said } = shot(buoy({ x: 5, y: 5 }), 3);
    expect(said[0]).toMatch(/^Pasó a 0,\d\d m de la boya: llegó antes que ella\.$/);
  });

  it('a la boya: si llega después, lo dice', () => {
    const { said } = shot(buoy({ x: 1, y: 1.2 }), 6);
    expect(said[0]).toMatch(/de la boya: llegó después que ella\.$/);
  });

  it('una partícula fija que no se mueve no es una boya', () => {
    const { said } = shot((w) => {
      w.g = null;
      w.addParticle({ x: 5, y: 3 }, 1).locked = true;
      w.addParticle({ x: -3, y: -2 }, 1, { x: 5, y: 5 });
    }, 3);
    expect(said).toEqual([]);
  });

  it('el rastro dice cuándo espera un blanco o una boya', () => {
    const { story } = setup(having(['vacio', 'particula', 'desde-siempre', 'boya', 'abajo']));
    story.enter('blanco');
    expect(story.listensFor('target-hit')).toBe(true);
    expect(story.listensFor('caught')).toBe(false);
    story.handle({ type: 'target-hit' });
    // ya le dio; el reto de más de 60° sigue esperando un acierto
    expect(story.listensFor('target-hit')).toBe(true);
    story.progress = { ...story.progress, earned: { ...story.progress.earned, blanco: ['alto'] } };
    expect(story.listensFor('target-hit')).toBe(false);
    story.leave();
    story.enter('boya');
    expect(story.listensFor('caught')).toBe(true);
  });
});

describe('estrellas con nombre', () => {
  it('desglosa resuelto, predicción y retos, con lo que falta', () => {
    const { story } = setup(having(['vacio', 'particula', 'desde-siempre', 'boya', 'abajo', 'blanco']));
    const blanco = story.siteById('blanco')!;
    expect(story.starParts(blanco)).toEqual([
      { id: 'resuelto', label: 'resuelto', got: 1, max: 1 },
      { id: 'prediccion', label: 'predicción', got: 0, max: 1 },
      { id: 'reto', label: 'reto', got: 0, max: 1 },
    ]);
    expect(story.maxStars(blanco)).toBe(3);
  });

  it('con dos retos, cuenta cuántos lleva', () => {
    const p = having(['vacio', 'particula', 'desde-siempre', 'boya']);
    p.solved.boya = { stars: ['resuelto', 'calma'], at: 1 };
    const { story } = setup(p);
    const parts = story.starParts(story.siteById('boya')!);
    expect(parts.map((x) => x.label)).toEqual(['resuelto', 'retos']);
    expect(parts[1]).toMatchObject({ got: 1, max: 2 });
  });
});

describe('«La pendiente justa»', () => {
  /** Inclina el plano del rastro a `deg` grados, desde su extremo izquierdo. */
  const tilt = (world: World, deg: number) => {
    const s = world.surfaces[0];
    const L = Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y);
    const th = (deg * Math.PI) / 180;
    s.b = { x: s.a.x + L * Math.cos(th), y: s.a.y + L * Math.sin(th) };
  };

  it(`si empezó a deslizar más de ${OVERSHOOT_DEG}° sobre el ángulo justo, pide repetir de a poco`, () => {
    const { story, world, changes } = setup(having(['vacio', 'particula', 'desde-siempre', 'abajo', 'suelo']));
    expect(story.enter('mu')).toBe(true);
    tilt(world, 40);
    story.handle({ type: 'slid' });
    expect(story.progress.step).toBe(0);
    expect(changes.at(-1)?.notice).toMatch(/α = 40,0°.*te pasaste.*de a poco/);
  });

  it('cerca del ángulo justo (≈ 24,2°) sí lo da por medido', () => {
    const { story, world } = setup(having(['vacio', 'particula', 'desde-siempre', 'abajo', 'suelo']));
    story.enter('mu');
    tilt(world, 26);
    story.handle({ type: 'slid' });
    expect(story.progress.step).toBe(1);
    expect(story.text()).toMatch(/α = 26,0°/);
  });
});

describe('tope para fluir', () => {
  it('el tiempo se detiene solo en el tope y no pasa de ahí hasta quitarlo', () => {
    const world = new World();
    world.addParticle({ x: 0, y: 0 }, 1, { x: 1, y: 0 });
    const sim = new Simulation(world);
    sim.pauseAt = 1;
    sim.start();
    for (let i = 0; i < 120; i++) sim.advance(1 / 60);
    expect(sim.t).toBeCloseTo(1, 9);
    expect(sim.running).toBe(false);
    expect(sim.finished).toBe(false);
    sim.start();
    for (let i = 0; i < 30; i++) sim.advance(1 / 60);
    expect(sim.t).toBeCloseTo(1, 9);
    sim.pauseAt = null;
    sim.start();
    for (let i = 0; i < 30; i++) sim.advance(1 / 60);
    expect(sim.t).toBeCloseTo(1.5, 6);
  });
});

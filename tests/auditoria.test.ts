import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress, type Progress } from '../src/state/progress';
import { SiteEngine } from '../src/story/siteEngine';
import { SITES, ZONES } from '../src/story/sites';
import type { Grant } from '../src/story/types';
import { World } from '../src/world/world';

// Correcciones de la auditoría de jugabilidad (tanda 1).

function setup(progress: Progress = freshProgress()) {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = new Simulation(world);
  const story = new SiteEngine(SITES, ZONES, progress, { world, view, sim }, () => {});
  return { world, story, sim };
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

const text = (story: SiteEngine) => {
  const st = story.site!.steps[story.progress.step];
  return typeof st.text === 'function' ? st.text(story.ctx) : st.text;
};

describe('«¿Dónde es abajo?» con g de lado', () => {
  it('las dos masas quedan a la misma altura medida a lo largo de g', () => {
    const { story, world } = setup(having(['vacio', 'particula', 'desde-siempre']));
    expect(story.enter('abajo')).toBe(true);
    world.g = { x: 9.8, y: 0 }; // el jugador arrastró g hacia la derecha
    story.handle({ type: 'g-set' });
    const [a, b] = world.particles;
    const along = (p: { x: number; y: number }) => (p.x * world.g!.x + p.y * world.g!.y) / 9.8;
    expect(along(a.pos)).toBeCloseTo(along(b.pos), 9);
    expect([a.mass, b.mass]).toEqual([1, 4]);
  });

  it('con g hacia abajo quedan donde estaban antes', () => {
    const { story, world } = setup(having(['vacio', 'particula', 'desde-siempre']));
    story.enter('abajo');
    world.g = { x: 0, y: -9.8 };
    story.handle({ type: 'g-set' });
    const [a, b] = world.particles;
    expect(a.pos.x).toBeCloseTo(-2, 9);
    expect(b.pos.x).toBeCloseTo(2, 9);
    expect(a.pos.y).toBeCloseTo(3, 9);
    expect(b.pos.y).toBeCloseTo(3, 9);
  });
});

describe('cierre de las predicciones', () => {
  it('una respuesta equivocada se contrasta antes de la explicación', () => {
    const { story, world } = setup(having(['vacio', 'particula', 'desde-siempre']));
    story.enter('abajo');
    world.g = { x: 0, y: -9.8 };
    story.handle({ type: 'g-set' });
    story.choose('pesada');
    story.handle({ type: 'fell' });
    expect(text(story).startsWith('Dijiste que la de 4 kg.')).toBe(true);
  });

  it('un comentario que no nombra la opción va con la opción elegida al comienzo', () => {
    const { story } = setup(having(['vacio', 'particula']));
    story.enter('dos-saltos');
    story.handle({ type: 'vector-snapped' });
    // el paso exige una cadena en la sonda: se salta directo a la predicción
    story.progress = { ...story.progress, step: 2 };
    story.choose('otro');
    story.progress = { ...story.progress, step: 4 };
    expect(text(story).startsWith('Dijiste «A otro lugar». Llega igual')).toBe(true);
  });

  it('acertar abre el cierre', () => {
    const { story } = setup(having(['vacio', 'particula']));
    story.enter('dos-saltos');
    story.progress = { ...story.progress, step: 2 };
    story.choose('misma');
    story.progress = { ...story.progress, step: 4 };
    expect(text(story).startsWith('Lo predijiste bien.')).toBe(true);
  });
});

describe('«Al blanco»', () => {
  const ready = ['vacio', 'particula', 'desde-siempre', 'cuadro-a-cuadro', 'boya', 'abajo'];

  it('pregunta por la cima antes de entregar la línea de tiempo', () => {
    const { story } = setup(having(ready));
    story.enter('blanco');
    story.handle({ type: 'target-hit' });
    expect(story.site!.steps[story.progress.step].ask).toBe('cima');
    expect(story.grants().has('time:timeline')).toBe(false);
    story.choose('horizontal');
    expect(story.grants().has('time:timeline')).toBe(true);
    expect(story.site!.steps[story.progress.step].on).toBe('peak-found');
  });

  it('parte con una sola partícula, sin otra en el camino del tiro', () => {
    const { story, world } = setup(having(ready));
    story.enter('blanco');
    expect(world.particles).toHaveLength(1);
    expect(world.targets).toHaveLength(1);
  });
});

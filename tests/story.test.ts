import { beforeEach, describe, expect, it } from 'vitest';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress, loadProgress, type Progress } from '../src/state/progress';
import { CHAPTERS } from '../src/story/chapters';
import { StoryEngine } from '../src/story/storyEngine';
import { TOOL_ORDER } from '../src/tools/registry';
import { SKILLS, skillState } from '../src/tree/skills';
import { World } from '../src/world/world';

function setup(progress: Progress = freshProgress()) {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = new Simulation(world);
  const saved: Progress[] = [];
  const story = new StoryEngine(CHAPTERS, progress, { world, view, sim }, (p) => saved.push(p));
  return { world, story, saved, sim };
}

const at = (chapter: string, step: number, predictions: Record<string, string> = {}): Progress => ({
  version: 2,
  chapter,
  step,
  free: false,
  predictions,
});

describe('relato', () => {
  it('avanza solo con el evento del paso actual', () => {
    const { story } = setup();
    story.handle({ type: 'frame-rotated' });
    expect(story.progress.step).toBe(0);
    story.handle({ type: 'origin-placed' });
    expect(story.progress.step).toBe(1);
  });

  it('el orden de los actos: velocidad antes que gravedad', () => {
    const ids = CHAPTERS.map((c) => c.id);
    expect(ids).toEqual(['vacio', 'particula', 'vectores', 'tiempo', 'abajo', 'blanco', 'superficies', 'resortes', 'gravitacion']);
    expect(ids.indexOf('tiempo')).toBeLessThan(ids.indexOf('abajo'));
  });

  it('el tiempo y la velocidad se ganan paso a paso dentro del capítulo 4', () => {
    const { story } = setup(at('tiempo', 0));
    let fresh: string[] = [];
    story.onChange = (c) => (fresh = c.newGrants);
    expect(story.timeSkills().size).toBe(0);
    expect(story.unlockedTools(TOOL_ORDER).has('velocity')).toBe(false);
    story.handle({ type: 'next' }); // «Desbloquear el tiempo»
    expect(fresh).toEqual(['time:flow']);
    expect([...story.timeSkills()]).toEqual(['flow']);
    story.handle({ type: 'time-paused' });
    expect(fresh).toEqual(['tool:velocity']);
    expect(story.timeSkills().has('rewind')).toBe(false);
  });

  it('una predicción se guarda y cambia el texto que la retoma', () => {
    const a = setup(at('tiempo', 3));
    expect(a.story.step.choices?.map((c) => c.id)).toEqual(['frena', 'recto', 'curva']);
    a.story.choose('frena');
    expect(a.story.progress.predictions.inercia).toBe('frena');
    a.story.handle({ type: 'coasted' });
    expect(a.story.text()).toMatch(/inercia/);
    expect(a.story.text()).toMatch(/Dijiste que se frenaba/);
    const b = setup(at('tiempo', 5, { inercia: 'recto' }));
    expect(b.story.text()).toMatch(/Lo predijiste bien/);
    expect(b.story.text()).not.toMatch(/Dijiste/);
  });

  it('las condiciones cuentan eventos desde que empezó el paso', () => {
    const { story } = setup(at('tiempo', 6));
    story.handle({ type: 'time-step' });
    story.handle({ type: 'time-step' });
    expect(story.progress.step).toBe(6);
    story.handle({ type: 'time-step' });
    expect(story.progress.step).toBe(7);
    expect(story.step.kind).toBe('engineering');
  });

  it('cada capítulo cierra con una mirada de ingeniería', () => {
    for (const c of CHAPTERS) expect(c.steps.some((s) => s.kind === 'engineering')).toBe(true);
  });

  it('el modo libre gana todo e ignora el relato', () => {
    const { story } = setup();
    story.setFree(true);
    expect(story.unlockedTools(TOOL_ORDER).size).toBe(TOOL_ORDER.length);
    expect(story.timeSkills().size).toBe(5);
    expect(story.forceSwitches().has('gravitation')).toBe(true);
    story.handle({ type: 'origin-placed' });
    expect(story.progress.step).toBe(0);
  });

  it('el árbol marca disponible, próxima y bloqueada', () => {
    const states = (p: Progress) => {
      const { story } = setup(p);
      const tp = { have: story.grants(), upcoming: story.upcomingGrants(), reached: story.reachedChapters(), next: story.nextChapter() };
      return Object.fromEntries(SKILLS.map((n) => [n.id, skillState(n, tp)]));
    };
    let s = states(freshProgress());
    expect(s.origin).toBe('disponible');
    expect(s.particle).toBe('próxima');
    expect(s.flow).toBe('bloqueada');
    s = states(at('tiempo', 1));
    expect(s.flow).toBe('disponible');
    expect(s.velocity).toBe('próxima');
    expect(s.step).toBe('próxima');
    expect(s.gravity).toBe('próxima');
    s = states(at('superficies', 0));
    expect(s.timeline).toBe('disponible');
    expect(s.normal).toBe('disponible');
    expect(s.spring).toBe('próxima');
    s = states(at('resortes', 0));
    expect(s.spring).toBe('disponible');
    expect(s.gravitation).toBe('próxima');
    s = states(at('gravitacion', 0));
    expect(s.gravitation).toBe('disponible');
    expect(s.drag).toBe('próxima');
  });

  it('el blanco del capítulo «Al blanco» queda dentro de la pantalla', () => {
    const { story, world } = setup(at('blanco', 0));
    story.resume();
    expect(world.targets).toHaveLength(1);
    const v = new View();
    v.resize(1200, 800, 1);
    const b = v.bounds();
    const t = world.targets[0].pos;
    expect(t.x).toBeGreaterThan(b.minX);
    expect(t.x).toBeLessThan(b.maxX);
    expect(t.y).toBeGreaterThan(b.minY);
    expect(t.y).toBeLessThan(b.maxY);
  });

  it('en «¿Dónde es abajo?» quedan dos masas distintas a la misma altura', () => {
    const { story, world } = setup(at('abajo', 1));
    story.resume();
    const [a, b] = world.particles;
    expect(a.pos.y).toBe(b.pos.y);
    expect([a.mass, b.mass]).toEqual([1, 4]);
    expect(world.g).not.toBeNull();
  });
});

describe('progreso guardado', () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });
  const ids = CHAPTERS.map((c) => c.id);

  it('la versión anterior (capítulo por número) se retoma en el mismo capítulo, desde su inicio', () => {
    store.set('mundoVacio.progress', JSON.stringify({ version: 1, chapter: 4, step: 2, free: false }));
    const p = loadProgress(ids);
    expect(p.chapter).toBe('blanco'); // el antiguo capítulo 5, «Velocidad», es ahora «Al blanco»
    expect(p.step).toBe(0);
    store.set('mundoVacio.progress', JSON.stringify({ version: 1, chapter: 5, step: 3, free: true }));
    expect(loadProgress(ids)).toMatchObject({ chapter: 'superficies', free: true });
  });

  it('la versión 2 guarda el capítulo por id y las predicciones', () => {
    store.set('mundoVacio.progress', JSON.stringify(at('abajo', 3, { caida: 'juntas' })));
    expect(loadProgress(ids)).toEqual(at('abajo', 3, { caida: 'juntas' }));
  });

  it('un capítulo que ya no existe vuelve al comienzo', () => {
    store.set('mundoVacio.progress', JSON.stringify(at('no-existe', 2)));
    expect(loadProgress(ids).chapter).toBe('vacio');
  });
});

describe('capítulo de resortes', () => {
  it('al retomarlo quedan un resorte colgado, gravedad y nada de suelo', () => {
    const { story, world } = setup(at('resortes', 4));
    world.addSurface({ x: -5, y: -1 }, { x: 5, y: -1 });
    story.chapter.seed?.(story.ctx);
    story.resume();
    expect(world.surfaces).toHaveLength(0);
    expect(world.springs).toHaveLength(1);
    expect(world.g).not.toBeNull();
    expect('anchor' in world.springs[0].a).toBe(true);
  });

  it('la predicción sobre la masa contrasta con la caída libre', () => {
    const { story } = setup(at('resortes', 11, { masa: 'igual' }));
    expect(story.text()).toMatch(/caída libre/);
  });
});

import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress } from '../src/state/progress';
import { CHAPTERS } from '../src/story/chapters';
import { StoryEngine } from '../src/story/storyEngine';
import { TOOL_ORDER } from '../src/tools/registry';
import { SKILLS, skillState } from '../src/tree/skills';
import { World } from '../src/world/world';

function setup() {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = new Simulation(world);
  const saved: unknown[] = [];
  const story = new StoryEngine(CHAPTERS, freshProgress(), { world, view, sim }, (p) => saved.push(p));
  return { world, story, saved };
}

describe('relato', () => {
  it('avanza solo con el evento del paso actual', () => {
    const { story } = setup();
    story.handle({ type: 'frame-rotated' });
    expect(story.progress.step).toBe(0);
    story.handle({ type: 'origin-placed' });
    expect(story.progress.step).toBe(1);
  });

  it('respeta las condiciones y desbloquea herramientas al cambiar de capítulo', () => {
    const { story, world } = setup();
    let fresh: string[] = [];
    story.onChange = (c) => (fresh = c.newTools);
    story.handle({ type: 'origin-placed' });
    story.handle({ type: 'frame-rotated' });
    expect(story.progress.chapter).toBe(1);
    expect(fresh).toEqual(['particle', 'move']);
    expect(story.unlockedTools(TOOL_ORDER).has('particle')).toBe(true);
    expect(story.unlockedTools(TOOL_ORDER).has('vector')).toBe(false);

    world.addParticle({ x: 1, y: 1 });
    story.handle({ type: 'particle-placed' });
    expect(story.progress.step).toBe(1);
    // la segunda colocación exige al menos 2 partículas
    world.particles.length = 1;
    story.handle({ type: 'particle-placed' });
    expect(story.progress.step).toBe(1);
    world.addParticle({ x: 2, y: 1 });
    story.handle({ type: 'particle-placed' });
    expect(story.progress.step).toBe(2);
  });

  it('cambiar la masa solo cuenta si ocurre durante el paso', () => {
    const { story } = setup();
    story.progress = { version: 1, chapter: 3, step: 2, free: false };
    story.handle({ type: 'fell' });
    expect(story.progress.step).toBe(2);
    story.handle({ type: 'mass-changed' });
    story.handle({ type: 'fell' });
    expect(story.progress.step).toBe(3);
  });

  it('el modo libre desbloquea todo e ignora el relato', () => {
    const { story } = setup();
    story.setFree(true);
    expect(story.unlockedTools(TOOL_ORDER).size).toBe(TOOL_ORDER.length);
    story.handle({ type: 'origin-placed' });
    expect(story.progress.step).toBe(0);
  });

  it('el árbol marca disponible, próxima y bloqueada', () => {
    const { story } = setup();
    const states = () =>
      Object.fromEntries(SKILLS.map((n) => [n.id, skillState(n, story.unlockedTools(TOOL_ORDER), story.upcomingTools())]));
    let s = states();
    expect(s.origin).toBe('disponible');
    expect(s.particle).toBe('próxima');
    expect(s.surface).toBe('bloqueada');
    story.progress = { version: 1, chapter: 4, step: 2, free: false };
    s = states();
    expect(s.velocity).toBe('disponible');
    expect(s.surface).toBe('próxima');
    expect(s.normal).toBe('bloqueada');
  });

  it('el blanco del capítulo 5 queda dentro de la pantalla', () => {
    const { story, world } = setup();
    story.progress = { version: 1, chapter: 4, step: 0, free: false };
    story.resume();
    story.handle({ type: 'v-set' });
    expect(world.targets).toHaveLength(1);
    const t = world.targets[0].pos;
    const b = new View();
    b.resize(1200, 800, 1);
    const bb = b.bounds();
    expect(t.x).toBeGreaterThan(bb.minX);
    expect(t.x).toBeLessThan(bb.maxX);
    expect(t.y).toBeGreaterThan(bb.minY);
    expect(t.y).toBeLessThan(bb.maxY);
  });
});

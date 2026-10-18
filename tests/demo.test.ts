import indexHtml from '../index.html?raw';
import demoHtml from '../demo.html?raw';
import viteConfig from '../vite.config.ts?raw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { demoPolicy, routeState } from '../src/demo/policy';
import { clearDemo, demoKeys } from '../src/demo/reset';
import { ALL_GRANTS } from '../src/demo/demo';
import { demoSites, demoZones, peakTime, ROUTE_IDS } from '../src/demo/route';
import { UniformGravity } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress, loadProgress, saveProgress, type Progress } from '../src/state/progress';
import { DEMO_NAMESPACE, FULL_NAMESPACE, storageKey, useNamespace } from '../src/state/storage';
import { SiteEngine } from '../src/story/siteEngine';
import { SITES, SITE_IDS } from '../src/story/sites';
import { TOOL_ORDER } from '../src/tools/registry';
import type { Step, StoryContext } from '../src/story/types';
import { World } from '../src/world/world';

// El juego simple: siete rastros en cuatro zonas, solo el siguiente abierto y, al terminar, todas
// las herramientas.

function demo(progress: Progress = freshProgress()) {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = new Simulation(world);
  sim.forces.push(new UniformGravity());
  const story = new SiteEngine(demoSites(), demoZones(), progress, { world, view, sim }, () => {}, demoPolicy);
  return { story, world, sim };
}

/** Resuelve el rastro en curso de un salto (sin jugar sus pasos). */
function solveHere(story: SiteEngine): void {
  story.progress = { ...story.progress, step: story.site!.steps.length - 1 };
  story.advance();
}

const open = (story: SiteEngine) => story.sites.filter((s) => story.status(s) === 'disponible').map((s) => s.id);

const textOf = (st: Step, ctx: StoryContext): string => {
  try {
    return typeof st.text === 'function' ? st.text(ctx) : st.text;
  } catch {
    return '';
  }
};

describe('el juego simple', () => {
  it('son los siete rastros acordados, en orden, en cuatro zonas, y todos existen en el juego completo', () => {
    expect(ROUTE_IDS).toEqual(['vacio', 'particula', 'desde-siempre', 'boya', 'abajo', 'blanco', 'orbita']);
    for (const id of ROUTE_IDS) expect(SITE_IDS).toContain(id);
    expect(demoSites().map((s) => s.id)).toEqual(ROUTE_IDS);
    expect(demoZones().map((z) => z.id)).toEqual(['claro', 'astro', 'pozo', 'deriva']);
  });

  it('solo el siguiente rastro está disponible; los que vienen no dejan entrar', () => {
    const { story } = demo();
    story.resume();
    expect(story.site?.id).toBe('vacio');
    for (let i = 0; i < ROUTE_IDS.length; i++) {
      if (i > 0) {
        expect(open(story)).toEqual([ROUTE_IDS[i]]);
        for (const other of ROUTE_IDS.slice(i + 1)) {
          expect(story.enter(other), other).toBe(false);
          expect(story.lockReason(story.siteById(other)!)).toBe(`Se abre después de «${story.siteById(ROUTE_IDS[ROUTE_IDS.indexOf(other) - 1])!.title}».`);
        }
        expect(story.enter(ROUTE_IDS[i])).toBe(true);
      }
      expect(routeState(story).done).toBe(i);
      solveHere(story);
      story.leave();
    }
    expect(routeState(story).complete).toBe(true);
  });

  it('las herramientas del recorrido son las del núcleo: nada de cámara lenta, gráficos ni línea de tiempo', () => {
    const { story } = demo();
    story.resume();
    for (const id of ROUTE_IDS) {
      if (id !== 'vacio') story.enter(id);
      solveHere(story);
      story.leave();
    }
    expect([...story.progress.have].sort()).toEqual(
      ['force:gravitation', 'time:flow', 'time:rewind', 'tool:gravity', 'tool:move', 'tool:origin', 'tool:particle', 'tool:velocity'].sort(),
    );
    for (const site of demoSites()) {
      for (const st of site.steps) {
        expect(st.tool ?? '', `${site.id}`).not.toMatch(/time:slow|time:timeline|time:step|lens:/);
        expect(textOf(st, story.ctx), `${site.id}`).not.toMatch(/cámara lenta|×½|línea de tiempo|Gráficos/);
      }
    }
  });

  it('al terminar se tienen todas las herramientas del juego, también en el laboratorio libre', () => {
    const { story } = demo();
    story.resume();
    for (const id of ROUTE_IDS) {
      if (id !== 'vacio') story.enter(id);
      solveHere(story);
      story.leave();
    }
    story.grantAll(ALL_GRANTS);
    const have = new Set(story.progress.have);
    for (const g of ALL_GRANTS) expect(have.has(g), g).toBe(true);
    expect(ALL_GRANTS).toHaveLength(TOOL_ORDER.length + 5 + 2 + 2);
    // se puede volver a cualquier rastro por las estrellas que faltan
    expect(story.sites.every((s) => story.status(s) === 'resuelto')).toBe(true);
    expect(story.enter('blanco')).toBe(true);
    story.leave();
    // el laboratorio libre del juego simple también trae todo
    const free = new SiteEngine(demoSites(), demoZones(), freshProgress(), story.ctx, () => {}, { ...demoPolicy, freeGrants: () => new Set(ALL_GRANTS) });
    free.setFree(true);
    expect(free.unlockedTools(TOOL_ORDER).size).toBe(TOOL_ORDER.length);
    expect(free.forceSwitches().size).toBe(2);
  });

  it('cada rastro se resuelve con lo que el jugador tiene en ese punto', () => {
    const { story } = demo();
    story.resume();
    const problems: string[] = [];
    for (const id of ROUTE_IDS) {
      if (id !== 'vacio') {
        const site = story.siteById(id)!;
        if (story.missing(site).length) problems.push(`${id}: le falta ${story.missing(site).join(', ')} para entrar`);
        story.enter(id);
      }
      const site = story.site!;
      site.steps.forEach((st, i) => {
        expect(story.progress.step).toBe(i);
        const have = story.grants();
        if (st.tool && !have.has(st.tool)) problems.push(`${id} paso ${i + 1}: pide ${st.tool}`);
        if (/vuelve a t = 0/i.test(textOf(st, story.ctx)) && !have.has('time:rewind')) problems.push(`${id} paso ${i + 1}: pide t = 0`);
        story.advance();
      });
      for (const m of site.mastery ?? []) {
        if (m.on === 'time-step' && !story.grants().has('time:step')) problems.push(`${id} reto ${m.id}: pide +0,1 s`);
      }
      // como máximo tres estrellas por rastro: resolver, predecir y un reto
      expect(story.maxStars(site), id).toBeLessThanOrEqual(3);
      expect(story.isSolved(id)).toBe(true);
      story.leave();
    }
    expect(problems).toEqual([]);
  });

  it('«¿Dónde es abajo?» no tiene cámara lenta ni el reto de +0,1 s; el del juego completo no cambia', () => {
    const fall = demoSites().find((s) => s.id === 'abajo')!;
    const full = SITES.find((s) => s.id === 'abajo')!;
    expect(fall.steps).toHaveLength(full.steps.length - 1);
    expect(fall.steps.flatMap((st) => st.grants ?? [])).not.toContain('time:slow');
    expect(fall.mastery?.map((m) => m.id)).toEqual(['de-lado']);
    expect(full.steps.some((st) => st.tool === 'time:slow')).toBe(true);
    expect(full.mastery?.map((m) => m.id)).toContain('paso');
  });

  it('«En órbita» presenta la atracción y la presta; el del juego completo no cambia', () => {
    const orbit = demoSites().find((s) => s.id === 'orbita')!;
    const full = SITES.find((s) => s.id === 'orbita')!;
    expect(orbit.steps[0].tool).toBe('force:gravitation');
    expect(orbit.steps[0].on).toBe('gravitation-on');
    expect(orbit.steps).toHaveLength(full.steps.length + 1);
    expect(orbit.needs).toEqual(['tool:velocity']);
    expect(orbit.grants).toContain('force:gravitation');
    expect(full.needs).toEqual(['force:gravitation', 'tool:velocity']);
  });
});

describe('«Al blanco» simple: el tiempo se detiene solo en la cima', () => {
  it('pierde la línea de tiempo y los gráficos; el del juego completo no cambia', () => {
    const shot = demoSites().find((s) => s.id === 'blanco')!;
    const full = SITES.find((s) => s.id === 'blanco')!;
    expect(shot.needs).toEqual(['tool:gravity', 'tool:velocity']);
    expect(shot.steps.map((st) => st.ask ?? st.on)).toEqual(['target-hit', 'cima', 'tick', 'next']);
    expect(full.needs).toContain('lens:graphs');
    expect(full.steps.some((st) => st.tool === 'time:timeline')).toBe(true);
  });

  it('con un tiro hacia arriba, se detiene en t = v₀y/g con la velocidad horizontal', () => {
    const { story, world, sim } = demo();
    story.resume();
    for (const id of ROUTE_IDS.slice(0, 5)) {
      if (id !== 'vacio') story.enter(id);
      solveHere(story);
      story.leave();
    }
    // como hace Game al entrar: el mundo se arma desde cero
    world.clear();
    expect(story.enter('blanco')).toBe(true);
    story.advance(); // le dio al blanco
    story.choose('horizontal');
    expect(story.progress.step).toBe(2);
    const me = world.particles.find((p) => !p.locked)!;
    me.vel = { x: 3, y: 4 };
    const tp = peakTime(story.ctx);
    expect(tp).toBeCloseTo(4 / 9.8, 3);
    story.tick(); // fija el tope en la cima
    expect(sim.pauseAt).toBeCloseTo(tp, 6);
    sim.start();
    for (let i = 0; i < 120 && sim.running; i++) sim.advance(1 / 60);
    expect(sim.running).toBe(false);
    expect(Math.abs(sim.t - tp)).toBeLessThan(0.02);
    expect(Math.abs(me.vel.y)).toBeLessThan(0.1);
    expect(me.vel.x).toBeCloseTo(3, 6);
    story.tick();
    expect(story.progress.step).toBe(3);
    // al revelar, el tiempo vuelve a correr hasta el final del tiro
    expect(sim.pauseAt).toBeNull();
  });

  it('un tiro de lado no tiene cima: pide lanzarlo un poco hacia arriba', () => {
    const { story, world } = demo();
    const ctx = story.ctx;
    world.addParticle({ x: 0, y: 0 }, 1, { x: 4, y: 0 });
    world.g = { x: 0, y: -9.8 };
    expect(peakTime(ctx)).toBe(0);
    const peak = demoSites().find((s) => s.id === 'blanco')!.steps[2];
    expect(textOf(peak, ctx)).toMatch(/no subió/);
    expect(peak.when!(ctx)).toBe(false);
  });
});

// ---------- avance aparte ----------

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
}

describe('el avance de la demo y el del juego completo no se mezclan', () => {
  let mem: MemoryStorage;
  beforeEach(() => {
    mem = new MemoryStorage();
    (globalThis as { localStorage?: Storage }).localStorage = mem;
  });
  afterEach(() => {
    useNamespace(FULL_NAMESPACE);
    delete (globalThis as { localStorage?: Storage }).localStorage;
  });

  it('cada uno guarda y lee con su propia clave', () => {
    const full = freshProgress();
    full.site = null;
    full.solved = { vacio: { stars: ['resuelto'], at: 1 }, particula: { stars: ['resuelto'], at: 2 } };
    full.have = ['tool:origin', 'tool:particle', 'tool:move'];
    useNamespace(FULL_NAMESPACE);
    saveProgress(full);

    useNamespace(DEMO_NAMESPACE);
    expect(loadProgress(SITE_IDS)).toEqual(freshProgress());
    const mine = freshProgress();
    mine.site = 'dos-saltos';
    mine.solved = { vacio: { stars: ['resuelto'], at: 3 } };
    saveProgress(mine);

    expect(mem.getItem('mundoVacio.progress')).not.toBeNull();
    expect(mem.getItem('mundoVacio.demo.progress')).not.toBeNull();
    expect(loadProgress(SITE_IDS).site).toBe('dos-saltos');
    useNamespace(FULL_NAMESPACE);
    expect(Object.keys(loadProgress(SITE_IDS).solved)).toEqual(['vacio', 'particula']);
  });

  it('la demo no migra el avance del prototipo antiguo (esa clave es del juego completo)', () => {
    mem.setItem('mundoVacio', JSON.stringify({ ch: 3, free: false }));
    useNamespace(DEMO_NAMESPACE);
    expect(loadProgress(SITE_IDS)).toEqual(freshProgress());
    useNamespace(FULL_NAMESPACE);
    expect(Object.keys(loadProgress(SITE_IDS).solved).length).toBeGreaterThan(0);
  });

  it('«Empezar de nuevo» en la demo borra solo lo de la demo', () => {
    mem.setItem('mundoVacio.progress', '{}');
    mem.setItem('mundoVacio.world.story', '{}');
    mem.setItem('mundoVacio.theme', 'light');
    useNamespace(DEMO_NAMESPACE);
    for (const k of ['progress', 'world.story', 'world.lab', 'lenses', 'finale', 'hint.axes']) mem.setItem(storageKey(k), '1');
    expect(demoKeys(mem)).toHaveLength(6);
    clearDemo(mem);
    expect(demoKeys(mem)).toEqual([]);
    expect(mem.getItem('mundoVacio.progress')).toBe('{}');
    expect(mem.getItem('mundoVacio.world.story')).toBe('{}');
    expect(mem.getItem('mundoVacio.theme')).toBe('light');
  });
});

describe('demo.html', () => {
  it('es la misma página que index.html, salvo el título y el programa que carga', () => {
    const index = indexHtml;
    const page = demoHtml;
    const norm = (s: string) => s.replace(/<title>.*<\/title>/, '').replace(/<script type="module" src="[^"]+"><\/script>/, '');
    expect(norm(page)).toBe(norm(index));
    expect(page).toContain('src="/src/demo/main.ts"');
  });

  it('Vite construye las dos páginas', () => {
    const cfg = viteConfig;
    expect(cfg).toMatch(/demo: 'demo\.html'/);
    expect(cfg).toMatch(/main: 'index\.html'/);
  });
});

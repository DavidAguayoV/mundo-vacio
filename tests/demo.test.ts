import indexHtml from '../index.html?raw';
import demoHtml from '../demo.html?raw';
import viteConfig from '../vite.config.ts?raw';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { demoPolicy, routeState } from '../src/demo/policy';
import { demoSites, DEMO_ROUTE, ROUTE_IDS } from '../src/demo/route';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress, loadProgress, saveProgress, type Progress } from '../src/state/progress';
import { DEMO_NAMESPACE, FULL_NAMESPACE, useNamespace } from '../src/state/storage';
import { SiteEngine } from '../src/story/siteEngine';
import { SITES, SITE_IDS, ZONES } from '../src/story/sites';
import type { Grant, Step, StoryContext } from '../src/story/types';
import { World } from '../src/world/world';

// La demo: siete rastros en orden, solo el siguiente abierto, y al final el mundo entero.

function demo(progress: Progress = freshProgress()) {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = new Simulation(world);
  const story = new SiteEngine(demoSites(), ZONES, progress, { world, view, sim }, () => {}, demoPolicy);
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

describe('la ruta de la demo', () => {
  it('son los siete rastros acordados, en orden, y todos existen en el juego completo', () => {
    expect(ROUTE_IDS).toEqual(['vacio', 'particula', 'dos-saltos', 'desde-siempre', 'abajo', 'boya', 'orbita']);
    for (const id of ROUTE_IDS) expect(SITE_IDS).toContain(id);
    expect(demoSites().map((s) => s.id)).toEqual(SITE_IDS);
  });

  it('solo el siguiente rastro de la ruta está disponible; los otros no dejan entrar', () => {
    const { story } = demo();
    story.resume();
    expect(story.site?.id).toBe('vacio');
    for (let i = 0; i < ROUTE_IDS.length; i++) {
      if (i > 0) {
        expect(open(story)).toEqual([ROUTE_IDS[i]]);
        // ni un rastro más adelante en la ruta ni uno fuera de ella
        for (const other of [...ROUTE_IDS.slice(i + 1), 'cuadro-a-cuadro', 'atraccion', 'hooke']) {
          expect(story.enter(other), other).toBe(false);
          expect(story.lockReason(story.siteById(other)!)).toBeTruthy();
        }
        expect(story.enter(ROUTE_IDS[i])).toBe(true);
      }
      expect(routeState(story).done).toBe(i);
      solveHere(story);
      story.leave();
    }
    expect(routeState(story).complete).toBe(true);
  });

  it('al resolver el séptimo y abrirse el mundo, todo queda ganado y los 36 rastros disponibles', () => {
    const { story } = demo();
    story.resume();
    for (const id of ROUTE_IDS) {
      if (id !== 'vacio') story.enter(id);
      solveHere(story);
      story.leave();
    }
    story.grantAll();
    expect(story.sites).toHaveLength(36);
    expect(story.sites.filter((s) => story.status(s) === 'cerrado').map((s) => s.id)).toEqual([]);
    expect(story.sites.filter((s) => story.isSolved(s.id)).map((s) => s.id).sort()).toEqual([...ROUTE_IDS].sort());
    const have = new Set(story.progress.have);
    for (const g of ['time:flow', 'time:rewind', 'time:step', 'time:slow', 'time:timeline', 'force:gravitation', 'force:drag', 'lens:energy', 'lens:graphs', 'tool:spring', 'tool:surface'] as Grant[]) {
      expect(have.has(g), g).toBe(true);
    }
    // ya no hay reglas de ruta: un rastro cualquiera se abre como en el juego completo
    expect(story.enter('hooke')).toBe(true);
  });

  it('cada rastro de la ruta se resuelve con lo que el jugador tiene en ese punto', () => {
    const { story } = demo();
    story.resume();
    const problems: string[] = [];
    for (const id of ROUTE_IDS) {
      if (id !== 'vacio') {
        const site = story.siteById(id)!;
        // lo que pide para entrar ya se ganó en la ruta (la demo no se salta las puertas)
        if (story.missing(site).length) problems.push(`${id}: le falta ${story.missing(site).join(', ')} para entrar`);
        story.enter(id);
      }
      const site = story.site!;
      site.steps.forEach((st, i) => {
        expect(story.progress.step).toBe(i);
        const have = story.grants();
        if (st.tool && !have.has(st.tool)) problems.push(`${id} paso ${i + 1}: pide ${st.tool}`);
        if (/vuelve a t = 0/i.test(textOf(st, story.ctx)) && !have.has('time:rewind')) problems.push(`${id} paso ${i + 1}: pide t = 0`);
        if (/cámara lenta|×½/i.test(textOf(st, story.ctx)) && !have.has('time:slow')) problems.push(`${id} paso ${i + 1}: pide cámara lenta`);
        story.advance();
      });
      // los retos tampoco pueden pedir algo que la ruta no da
      for (const m of site.mastery ?? []) {
        if (m.on === 'time-step' && !story.grants().has('time:step')) problems.push(`${id} reto ${m.id}: pide +0,1 s`);
      }
      expect(story.isSolved(id)).toBe(true);
      story.leave();
    }
    expect(problems).toEqual([]);
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
    expect(full.steps[0].text).toMatch(/^Vuelve a t = 0/);
  });

  it('«¿Dónde es abajo?» no ofrece en la demo el reto que pide +0,1 s', () => {
    const stop = DEMO_ROUTE.find((r) => r.id === 'abajo')!;
    expect(stop.dropMastery).toEqual(['paso']);
    expect(demoSites().find((s) => s.id === 'abajo')!.mastery?.map((m) => m.id)).not.toContain('paso');
    expect(SITES.find((s) => s.id === 'abajo')!.mastery?.map((m) => m.id)).toContain('paso');
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

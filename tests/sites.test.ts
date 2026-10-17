import { beforeEach, describe, expect, it } from 'vitest';
import { dist, rotate } from '../src/core/vec';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress, loadProgress, type Progress } from '../src/state/progress';
import { SiteEngine } from '../src/story/siteEngine';
import { CATCH_DIST, SITES, SITE_IDS, ZONES } from '../src/story/sites';
import type { Grant } from '../src/story/types';
import { TOOL_ORDER } from '../src/tools/registry';
import { SKILLS, skillState } from '../src/tree/skills';
import { World } from '../src/world/world';

function setup(progress: Progress = freshProgress()) {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = new Simulation(world);
  const saved: Progress[] = [];
  const story = new SiteEngine(SITES, ZONES, progress, { world, view, sim }, (p) => saved.push(p));
  return { world, story, saved, sim, view };
}

/** Avance con algunos rastros resueltos y lo que entregan. */
function having(solved: string[], extra: Grant[] = []): Progress {
  const p = freshProgress();
  p.site = null;
  const have = new Set<Grant>(extra);
  for (const id of solved) {
    p.solved[id] = { stars: ['resuelto'], at: 1 };
    const s = SITES.find((x) => x.id === id)!;
    s.grants?.forEach((g) => have.add(g));
    s.steps.forEach((st) => st.grants?.forEach((g) => have.add(g)));
  }
  p.have = [...have];
  return p;
}

/** Traslada una tarjeta para que su cola quede cerca de un punto y la pega. */
function place(world: World, label: string, at: { x: number; y: number }, nth = 0) {
  const v = world.vectors.filter((x) => x.label === label)[nth];
  const d = { x: v.tip.x - v.tail.x, y: v.tip.y - v.tail.y };
  v.tail = { x: at.x + 0.1, y: at.y - 0.1 };
  v.tip = { x: v.tail.x + d.x, y: v.tail.y + d.y };
  expect(world.snapVector(v)).toBe(true);
  return v;
}

describe('mundo abierto', () => {
  it('quien abre el juego por primera vez empieza en «El vacío», con el Origen', () => {
    const { story } = setup();
    story.resume();
    expect(story.site?.id).toBe('vacio');
    expect(story.unlockedTools(TOOL_ORDER)).toEqual(new Set(['origin']));
  });

  it('un rastro avanza solo con el evento de su paso actual', () => {
    const { story } = setup();
    story.resume();
    story.handle({ type: 'frame-rotated' });
    expect(story.progress.step).toBe(0);
    story.handle({ type: 'origin-placed' });
    expect(story.progress.step).toBe(1);
  });

  it('al resolver se escribe la página y se gana la estrella de resolver', () => {
    const { story } = setup();
    story.resume();
    let solved = false;
    story.onChange = (c) => (solved ||= !!c.solved);
    story.handle({ type: 'origin-placed' });
    story.handle({ type: 'frame-rotated' });
    story.handle({ type: 'next' });
    expect(solved).toBe(true);
    expect(story.done).toBe(true);
    expect(story.solved('vacio')?.stars).toContain('resuelto');
    story.leave();
    expect(story.inMap).toBe(true);
  });

  it('puertas suaves: se ve, pero sin lo necesario no se entra, y se sabe dónde se gana', () => {
    const { story } = setup(having(['vacio']));
    const boya = story.siteById('boya')!;
    expect(story.status(boya)).toBe('cerrado');
    expect(story.missing(boya)).toEqual(['time:flow', 'tool:particle']);
    expect(story.sourceOf('tool:particle')?.id).toBe('particula');
    expect(story.enter('boya')).toBe(false);
    expect(story.status(story.siteById('particula')!)).toBe('disponible');
  });

  it('después del claro se abren dos caminos: la constelación y la deriva', () => {
    const { story } = setup(having(['vacio', 'particula']));
    const open = SITES.filter((s) => story.status(s) === 'disponible').map((s) => s.id);
    expect(open).toEqual(['dos-saltos', 'desde-siempre']);
  });

  it('todos los rastros se pueden alcanzar, y lo que piden se gana en algún rastro', () => {
    const have = new Set<Grant>();
    const done = new Set<string>();
    for (let changed = true; changed; ) {
      changed = false;
      for (const s of SITES) {
        if (done.has(s.id) || !(s.needs ?? []).every((g) => have.has(g))) continue;
        done.add(s.id);
        s.grants?.forEach((g) => have.add(g));
        s.steps.forEach((st) => st.grants?.forEach((g) => have.add(g)));
        changed = true;
      }
    }
    expect([...done].sort()).toEqual([...SITE_IDS].sort());
  });

  it('cada rastro tiene nota, página e ingeniería, y cada predicción su respuesta correcta', () => {
    for (const s of SITES) {
      expect(s.note.length, s.id).toBeGreaterThan(10);
      expect(s.page.law.length, s.id).toBeGreaterThan(10);
      expect(s.page.engineering.length, s.id).toBeGreaterThan(10);
      expect(s.steps.some((st) => st.kind === 'engineering'), s.id).toBe(false);
      for (const st of s.steps.filter((x) => x.choices)) {
        expect(st.correct, `${s.id}: ${st.ask}`).toBeDefined();
        expect(st.choices!.map((c) => c.id)).toContain(st.correct);
      }
    }
  });

  it('el modo libre gana todo y no avanza ningún rastro', () => {
    const { story } = setup();
    story.setFree(true);
    expect(story.unlockedTools(TOOL_ORDER).size).toBe(TOOL_ORDER.length);
    expect(story.timeSkills().size).toBe(5);
    expect(story.lenses().has('energy')).toBe(true);
    expect(story.site).toBeNull();
  });

  it('el árbol marca disponible y próxima según lo abierto', () => {
    const { story } = setup(having(['vacio']));
    const tp = { have: story.grants(), upcoming: story.upcomingGrants(), reached: story.reachedChapters(), next: story.nextChapter() };
    const st = Object.fromEntries(SKILLS.map((n) => [n.id, skillState(n, tp)]));
    expect(st.origin).toBe('disponible');
    expect(st.particle).toBe('próxima');
    expect(st.gravity).toBe('bloqueada');
  });
});

describe('la constelación: la sonda', () => {
  it('«Dos saltos»: cola con punta, en los dos órdenes, y se ganan Vector y Sumar', () => {
    const { story, world } = setup(having(['vacio', 'particula']));
    expect(story.enter('dos-saltos')).toBe(true);
    const A = place(world, 'A', world.probe!);
    story.handle({ type: 'vector-snapped' });
    expect(story.progress.step).toBe(1);
    place(world, 'B', A.tip);
    const chain = world.probeChain();
    expect(chain.vectors.map((v) => v.label)).toEqual(['A', 'B']);
    expect(dist(chain.points.at(-1)!, world.beacons[0].pos)).toBeLessThan(1e-9);
    world.probeLog.push('A,B');
    story.handle({ type: 'probe-arrived' });
    story.choose('misma');
    world.probeLog.push('B,A');
    story.handle({ type: 'probe-arrived' });
    expect(story.text()).toMatch(/A \+ B = B \+ A/);
    story.handle({ type: 'next' });
    expect(story.solved('dos-saltos')?.stars).toEqual(expect.arrayContaining(['resuelto', 'prediccion']));
    expect(story.grants().has('tool:sum')).toBe(true);
  });

  it('una flecha dibujada a mano no cuenta: solo las tarjetas', () => {
    const { story, world } = setup(having(['vacio', 'particula', 'dos-saltos']));
    story.enter('dos-saltos');
    world.addVector(world.probe!, world.beacons[0].pos);
    expect(world.probeChain().vectors).toHaveLength(0);
  });

  it('«El muro»: solo dos órdenes lo esquivan, y todos terminan en el mismo punto', () => {
    const { story, world } = setup(having(['vacio', 'particula', 'dos-saltos']));
    story.enter('atajo');
    const tryOrder = (order: string[]) => {
      let at = world.probe!;
      for (const l of order) at = place(world, l, at).tip;
      const c = world.probeChain();
      // se desarma para el siguiente intento
      world.vectors.forEach((v, i) => {
        const d = { x: v.tip.x - v.tail.x, y: v.tip.y - v.tail.y };
        v.tail = { x: -20 - 5 * i, y: -20 };
        v.tip = { x: v.tail.x + d.x, y: v.tail.y + d.y };
      });
      return c;
    };
    const perms = ['ABC', 'ACB', 'BAC', 'BCA', 'CAB', 'CBA'];
    const free = perms.filter((p) => !tryOrder([...p]).blocked);
    expect(free).toEqual(['ABC', 'CBA']);
    for (const p of perms) expect(dist(tryOrder([...p]).points.at(-1)!, world.beacons[0].pos)).toBeLessThan(1e-9);
  });

  it('«Tres veces A»: 2A − B llega a la baliza al invertir B', () => {
    const { story, world } = setup(having(['vacio', 'particula', 'dos-saltos']));
    story.enter('escalar');
    const B = world.vectors.find((v) => v.label === 'B')!;
    world.flipVector(B);
    expect(B.label).toBe('−B');
    const a1 = place(world, 'A', world.probe!, 0);
    const a2 = place(world, 'A', a1.tip, 1);
    place(world, '−B', a2.tip);
    const c = world.probeChain();
    expect(c.vectors.map((v) => v.label)).toEqual(['A', 'A', '−B']);
    expect(dist(c.points.at(-1)!, world.beacons[0].pos)).toBeLessThan(1e-9);
  });

  it('«Los ejes de otra persona»: la baliza está en (4 ; 1) de unos ejes girados 30°', () => {
    const { story, world } = setup(having(['vacio', 'particula', 'dos-saltos']));
    story.enter('ejes-ajenos');
    const b = world.beacons[0];
    expect(b.hidden).toBe(true);
    world.frame!.angle = Math.PI / 6;
    const u = world.frame!.pointToUser(b.pos);
    expect(u.x).toBeCloseTo(4, 9);
    expect(u.y).toBeCloseTo(1, 9);
    world.frame!.angle = 0;
    story.handle({ type: 'frame-rotated' });
    expect(story.progress.step).toBe(0); // todavía no está en 30°
    world.frame!.angle = Math.PI / 6;
    story.handle({ type: 'frame-rotated' });
    expect(story.progress.step).toBe(1);
  });
});

describe('la deriva', () => {
  it('«Desde siempre»: se gana el tiempo y la apuesta a t = 4 s da su estrella', () => {
    const { story, world, sim } = setup(having(['vacio', 'particula']));
    story.enter('desde-siempre');
    expect(story.timeSkills().has('flow')).toBe(true);
    story.progress = { ...story.progress, step: 4 };
    const drifter = world.particles[0];
    world.addParticle({ x: drifter.pos.x + 4 * drifter.vel.x, y: drifter.pos.y + 4 * drifter.vel.y + 0.2 }, 1);
    sim.maxTime = 30;
    sim.start();
    for (let i = 0; i < 60 * 4.4 && !story.done; i++) {
      sim.advance(1 / 60);
      story.tick();
    }
    expect(story.stars('desde-siempre')).toContain('apuesta');
    expect(story.progress.step).toBe(5);
    expect(story.text()).toMatch(/achuntaste/);
  });

  it('«La boya»: hay una velocidad menor que 1,5 m/s que la alcanza', () => {
    const { story, world, sim } = setup(having(['vacio', 'particula', 'desde-siempre']));
    expect(story.enter('boya')).toBe(true);
    expect(story.unlockedTools(TOOL_ORDER).has('velocity')).toBe(true);
    const me = world.particles.find((p) => !p.locked)!;
    me.vel = { x: 0.4, y: 1 };
    sim.maxTime = 30;
    sim.start();
    const boya = world.particles.find((p) => p.locked)!;
    let closest = Infinity;
    for (let i = 0; i < 60 * 6; i++) {
      sim.advance(1 / 60);
      closest = Math.min(closest, dist(me.pos, boya.pos));
    }
    expect(closest).toBeLessThan(CATCH_DIST);
    expect(Math.hypot(0.4, 1)).toBeLessThan(1.5);
  });
});

describe('capítulos que siguen como rastros', () => {
  it('en «¿Dónde es abajo?» quedan dos masas distintas a la misma altura', () => {
    const p = having(['vacio', 'particula', 'desde-siempre']);
    p.site = 'abajo';
    p.step = 1;
    const { story, world } = setup(p);
    story.resume();
    const [a, b] = world.particles;
    expect(a.pos.y).toBe(b.pos.y);
    expect([a.mass, b.mass]).toEqual([1, 4]);
    expect(world.g).not.toBeNull();
  });

  it('el blanco de «Al blanco» queda dentro de la pantalla', () => {
    const p = having(['vacio', 'particula', 'desde-siempre', 'boya', 'abajo']);
    const { story, world, view } = setup(p);
    expect(story.enter('blanco')).toBe(true);
    const b = view.bounds();
    const t = world.targets[0].pos;
    expect(t.x).toBeGreaterThan(b.minX);
    expect(t.x).toBeLessThan(b.maxX);
    expect(t.y).toBeGreaterThan(b.minY);
    expect(t.y).toBeLessThan(b.maxY);
  });

  it('«Resortes»: al retomarlo quedan un resorte colgado y gravedad', () => {
    const p = having(['vacio', 'particula', 'desde-siempre', 'abajo']);
    p.site = 'resortes';
    p.step = 4;
    const { story, world } = setup(p);
    story.resume();
    expect(world.springs).toHaveLength(1);
    expect(world.g).not.toBeNull();
    expect('anchor' in world.springs[0].a).toBe(true);
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

  it('el relato lineal (v2) pasa al mapa: lo anterior queda resuelto y ganado', () => {
    store.set('mundoVacio.progress', JSON.stringify({ version: 2, chapter: 'abajo', step: 3, free: false, predictions: { caida: 'juntas' } }));
    const p = loadProgress(SITE_IDS);
    expect(p.version).toBe(3);
    expect(p.site).toBe('abajo');
    expect(Object.keys(p.solved).sort()).toEqual(['atajo', 'boya', 'desde-siempre', 'dos-saltos', 'ejes-ajenos', 'escalar', 'particula', 'vacio']);
    expect(p.have).toEqual(expect.arrayContaining(['tool:velocity', 'time:step', 'tool:sum']));
    expect(p.predictions.caida).toBe('juntas');
  });

  it('a mitad de «Vectores» (que se rehízo) se vuelve al mapa con el claro resuelto', () => {
    store.set('mundoVacio.progress', JSON.stringify({ version: 2, chapter: 'vectores', step: 2, free: false, predictions: {} }));
    const p = loadProgress(SITE_IDS);
    expect(p.site).toBeNull();
    expect(Object.keys(p.solved).sort()).toEqual(['particula', 'vacio']);
  });

  it('la versión 1 (capítulo por número) también se migra', () => {
    store.set('mundoVacio.progress', JSON.stringify({ version: 1, chapter: 5, step: 3, free: true }));
    const p = loadProgress(SITE_IDS);
    expect(p.free).toBe(true);
    // «Superficies» se volvió tres rastros: se vuelve al mapa con lo anterior resuelto
    expect(p.site).toBeNull();
    expect(p.solved.blanco).toBeDefined();
    expect(p.solved.suelo).toBeUndefined();
  });

  it('un progreso v3 dañado no rompe el juego', () => {
    store.set('mundoVacio.progress', JSON.stringify({ version: 3, site: 'no-existe', step: 'x', solved: { vacio: { stars: ['resuelto'] }, raro: {} } }));
    const p = loadProgress(SITE_IDS);
    expect(p.site).toBeNull();
    expect(Object.keys(p.solved)).toEqual(['vacio']);
  });
});

describe('cámara', () => {
  it('acercar deja fijo el punto bajo el puntero y «centrar» vuelve al inicio', () => {
    const v = new View();
    v.resize(1000, 700, 1);
    const before = v.toWorld(300, 200);
    v.zoomAt(300, 200, 2);
    const after = v.toWorld(300, 200);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    expect(v.moved).toBe(true);
    v.reset();
    expect(v.moved).toBe(false);
  });

  it('las balizas y la sonda se guardan y se recuperan con el mundo', async () => {
    const { worldToJSON, worldFromJSON } = await import('../src/world/serialize');
    const { story, world } = setup(having(['vacio', 'particula', 'dos-saltos']));
    story.enter('ejes-ajenos');
    const w2 = worldFromJSON(JSON.parse(JSON.stringify(worldToJSON(world))));
    expect(w2.beacons).toHaveLength(1);
    expect(w2.beacons[0].hidden).toBe(true);
    story.leave();
    story.enter('escalar');
    const w3 = worldFromJSON(JSON.parse(JSON.stringify(worldToJSON(world))));
    expect(w3.probe).toEqual(world.probe);
    expect(w3.vectors.every((v) => v.fixed)).toBe(true);
    expect(rotate({ x: 1, y: 0 }, 0).x).toBe(1);
  });
});

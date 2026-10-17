import { describe, expect, it } from 'vitest';
import { SurfaceConstraint } from '../src/physics/constraints';
import { FrictionForce, NormalForce, UniformGravity } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { namedZones, pickLabels } from '../src/map/worldMap';
import { freshProgress, splitDrift, type Progress } from '../src/state/progress';
import { peakChoices } from '../src/story/chapters';
import { SiteEngine, type StoryChange } from '../src/story/siteEngine';
import { SITES, SITE_IDS, ZONES } from '../src/story/sites';
import type { Grant, Site, StoryContext } from '../src/story/types';
import { TOOL_ORDER } from '../src/tools/registry';
import { World } from '../src/world/world';

// Correcciones de la auditoría de jugabilidad (tanda 3): estructura e interfaz.

function setup(progress: Progress = freshProgress()) {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = new Simulation(world);
  const sc = new SurfaceConstraint(() => world.surfaces);
  sim.constraints.push(sc);
  sim.forces.push(new UniformGravity(), new NormalForce(sc.contacts), new FrictionForce(sc.contacts));
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

/** Resuelve el rastro en curso de un salto (sin jugar sus pasos). */
function solveHere(story: SiteEngine): void {
  const n = story.site!.steps.length;
  story.progress = { ...story.progress, step: n - 1 };
  story.advance();
}

const openIds = (story: SiteEngine) => SITES.filter((s) => story.status(s) === 'disponible').map((s) => s.id);

describe('puertas del mapa que cierran de verdad', () => {
  it('entrar a los rastros abiertos y salir sin resolverlos no abre ninguno nuevo', () => {
    const { story } = setup(having(['vacio']));
    const before = openIds(story);
    const have = [...story.progress.have].sort();
    for (let round = 0; round < 3; round++) {
      for (const id of openIds(story)) {
        expect(story.enter(id)).toBe(true);
        story.leave();
      }
    }
    expect(openIds(story)).toEqual(before);
    expect([...story.progress.have].sort()).toEqual(have);
  });

  it('lo que presta un rastro se usa adentro, se pierde al salir y se queda al resolverlo', () => {
    const { story } = setup(having(['vacio', 'particula', 'desde-siempre']));
    expect(story.enter('boya')).toBe(true);
    expect(story.unlockedTools(TOOL_ORDER).has('velocity')).toBe(true);
    story.leave();
    expect(story.unlockedTools(TOOL_ORDER).has('velocity')).toBe(false);
    expect(story.status(story.siteById('luna')!)).toBe('cerrado');
    story.enter('boya');
    solveHere(story);
    story.leave();
    expect(story.unlockedTools(TOOL_ORDER).has('velocity')).toBe(true);
  });

  it('lo de un paso se presta desde ese paso, también al retomar tras recargar', () => {
    const p = having(['vacio', 'particula', 'desde-siempre']);
    p.site = 'cuadro-a-cuadro';
    p.step = 2;
    const { story } = setup(p);
    story.resume();
    expect(story.lenses().has('graphs')).toBe(true);
    expect(story.progress.have).not.toContain('lens:graphs');
  });

  it(`resolviendo en orden se alcanzan los ${SITES.length} rastros, partiendo de cero`, () => {
    const { story } = setup();
    story.resume();
    solveHere(story); // el vacío
    story.leave();
    for (let changed = true; changed; ) {
      changed = false;
      for (const id of openIds(story)) {
        expect(story.enter(id), id).toBe(true);
        solveHere(story);
        story.leave();
        changed = true;
      }
    }
    expect(SITES.filter((s) => !story.isSolved(s.id)).map((s) => s.id)).toEqual([]);
    expect(SITES.length).toBe(36);
  });
});

describe('«Desde siempre» dividido en dos', () => {
  const drift = () => SITES.find((s) => s.id === 'desde-siempre')!;
  const cuadro = () => SITES.find((s) => s.id === 'cuadro-a-cuadro')!;

  it('la inercia y la apuesta quedan en «Desde siempre»; el paso a paso y los gráficos, en «Cuadro a cuadro»', () => {
    expect(drift().steps).toHaveLength(5);
    expect(drift().mastery?.map((m) => m.id)).toEqual(['apuesta']);
    const grants = cuadro().steps.flatMap((st) => st.grants ?? []);
    expect(grants).toEqual(['time:rewind', 'time:step', 'lens:graphs']);
    expect(cuadro().needs).toEqual(['time:flow']);
  });

  it('migración: quien lo había resuelto tiene los dos resueltos', () => {
    const p = having(['vacio', 'particula']);
    p.solved['desde-siempre'] = { stars: ['resuelto', 'apuesta'], at: 5 };
    p.have.push('time:flow', 'time:rewind', 'time:step', 'lens:graphs');
    const out = splitDrift(p, SITE_IDS);
    expect(out.solved['cuadro-a-cuadro']).toEqual({ stars: ['resuelto'], at: 5 });
    expect(out.solved['desde-siempre'].stars).toContain('apuesta');
  });

  it('migración: quien iba en la segunda mitad sigue en «Cuadro a cuadro», en el paso que le toca', () => {
    for (const [old, now] of [
      [5, 0],
      [6, 2],
      [7, 3],
    ]) {
      const p = having(['vacio', 'particula']);
      p.site = 'desde-siempre';
      p.step = old;
      const out = splitDrift(p, SITE_IDS);
      expect(out.site).toBe('cuadro-a-cuadro');
      expect(out.step).toBe(now);
      expect(out.solved['desde-siempre']).toBeDefined();
    }
  });

  it('migración: en la primera mitad no cambia nada', () => {
    const p = having(['vacio', 'particula']);
    p.site = 'desde-siempre';
    p.step = 3;
    const out = splitDrift(p, SITE_IDS);
    expect(out.site).toBe('desde-siempre');
    expect(out.step).toBe(3);
    expect(out.solved['cuadro-a-cuadro']).toBeUndefined();
  });
});

describe('la tarjeta dice qué herramienta pide', () => {
  /** Nombres de herramientas, lentes e interruptores tal como aparecen en las tarjetas. */
  const NAMED = /\b(Origen|Partícula|Mover|Vector|Sumar|Gravedad|Velocidad|Superficie|Resorte|Atracción|Medio|Energía|Gráficos)\b/;
  const ctx = {
    world: new World(),
    sim: new Simulation(new World()),
    prediction: () => undefined,
    predictionLabel: () => undefined,
    seen: () => false,
    count: () => 0,
    total: () => 0,
    runs: () => 0,
  } as unknown as StoryContext;
  const textOf = (s: Site, i: number) => {
    const t = s.steps[i].text;
    return typeof t === 'function' ? t(ctx) : t;
  };

  it('cada paso que nombra una herramienta lleva su campo tool', () => {
    const missing: string[] = [];
    for (const s of SITES) s.steps.forEach((st, i) => NAMED.test(textOf(s, i).replace(/\*\*/g, '')) && !st.tool && missing.push(`${s.id}#${i}`));
    expect(missing).toEqual([]);
  });

  it('lo que pide cada paso es algo que se puede ganar', () => {
    const { story } = setup();
    const all = story.allGrants();
    for (const s of SITES) for (const st of s.steps) if (st.tool) expect(all.has(st.tool), `${s.id}: ${st.tool}`).toBe(true);
  });
});

describe('Gráficos con uso: vₓ en la cima de «Al blanco»', () => {
  const ready = ['vacio', 'particula', 'desde-siempre', 'cuadro-a-cuadro', 'boya', 'abajo'];

  /** Entra a «Al blanco», le da un tiro a la partícula y llega al paso de la pregunta. */
  function atQuestion() {
    const s = setup(having(ready));
    expect(s.story.enter('blanco')).toBe(true);
    const p = s.world.particles[0];
    p.vel = { x: 3, y: 6 };
    s.sim.start();
    s.sim.advance(1 / 60);
    s.story.progress = { ...s.story.progress, step: 3 };
    return s;
  }

  it('«Al blanco» pide los gráficos para entrar', () => {
    const { story } = setup(having(['vacio', 'particula', 'desde-siempre', 'boya', 'abajo']));
    expect(story.missing(story.siteById('blanco')!)).toEqual(['lens:graphs']);
    expect(story.sourceOf('lens:graphs')?.id).toBe('cuadro-a-cuadro');
  });

  it('las opciones salen del tiro: la correcta es vₓ = 3,00 m/s, entre otras dos distintas y ordenadas', () => {
    const { story } = atQuestion();
    const ch = peakChoices(story.ctx);
    expect(ch).toHaveLength(3);
    expect(ch.find((c) => c.id === 'vx')?.label).toBe('3,00 m/s');
    expect(new Set(ch.map((c) => c.label)).size).toBe(3);
    const vals = ch.map((c) => Number(c.label.replace(' m/s', '').replace(',', '.').replace('−', '-')));
    expect([...vals].sort((a, b) => a - b)).toEqual(vals);
  });

  it('con los ejes girados, vₓ es la de los ejes del jugador (lo que muestra el gráfico)', () => {
    const { story, world } = atQuestion();
    world.frame!.angle = Math.PI / 2; // x del jugador hacia arriba de la pantalla
    // en la cima la velocidad es horizontal: vista desde estos ejes, su componente x es 0
    expect(peakChoices(story.ctx).find((c) => c.id === 'vx')?.label).toBe('0,00 m/s');
  });

  it('una respuesta equivocada pide mirar de nuevo; la correcta avanza', () => {
    const { story, changes } = atQuestion();
    story.choose('cero');
    expect(story.progress.step).toBe(3);
    expect(changes.at(-1)?.notice).toMatch(/Mira de nuevo vₓ\(t\)/);
    story.choose('vx');
    expect(story.progress.step).toBe(4);
  });

  it('la pregunta no cuenta para la estrella de predicción', () => {
    const { story } = setup(having(ready));
    expect(story.starParts(story.siteById('blanco')!).map((p) => [p.id, p.max])).toEqual([
      ['resuelto', 1],
      ['prediccion', 1],
      ['reto', 1],
    ]);
  });
});

describe('mapa legible', () => {
  it('con nombre, solo las zonas abiertas y sus vecinas', () => {
    const { story } = setup(having(['vacio']));
    // recién salido del vacío: el claro y las zonas a menos de 20 unidades
    expect([...namedZones(story)].sort()).toEqual(['astro', 'central', 'claro', 'mar']);
    const later = setup(having(['vacio', 'particula'])).story;
    const named = namedZones(later);
    expect(named.has('constelacion')).toBe(true);
    expect(named.has('deriva')).toBe(true);
    expect(named.has('laderas')).toBe(false);
    expect(named.has('pozo')).toBe(false);
  });

  it('una etiqueta que pisa otra o queda cortada en el borde no se muestra', () => {
    const shown = pickLabels(
      [
        { x: 10, y: 10, w: 80, h: 16 }, // cabe
        { x: 60, y: 14, w: 80, h: 16 }, // pisa la anterior
        { x: 700, y: 40, w: 80, h: 16 }, // se sale por la derecha (W = 740)
        { x: 200, y: 40, w: 80, h: 16 }, // cabe
        { x: 300, y: 100, w: 40, h: 16 }, // pisa un obstáculo (la tarjeta)
      ],
      740,
      820,
      [{ x: 290, y: 90, w: 100, h: 40 }],
    );
    expect(shown).toEqual([true, false, false, true, false]);
  });
});

describe('retos que piden Vector, Paso a paso y la línea de tiempo', () => {
  it('«El muro»: dibujar con Vector la flecha directa de la sonda a la baliza', () => {
    const { story, world } = setup(having(['vacio', 'particula', 'dos-saltos']));
    expect(story.enter('atajo')).toBe(true);
    const v = world.addVector({ x: 0, y: 0 }, { x: 1, y: 1 });
    story.tick();
    expect(story.stars('atajo')).not.toContain('directa');
    v.tail = { x: world.probe!.x + 0.1, y: world.probe!.y };
    v.tip = { x: world.beacons[0].pos.x, y: world.beacons[0].pos.y - 0.1 };
    story.tick();
    expect(story.stars('atajo')).toContain('directa');
  });

  it('«¿Dónde es abajo?»: con +0,1 s hasta t = 1,0 s gana el reto; fluyendo, no', () => {
    const play = (useStep: boolean) => {
      const { story, world, sim } = setup(having(['vacio', 'particula', 'desde-siempre', 'cuadro-a-cuadro']));
      story.enter('abajo');
      world.g = { x: 0, y: -9.8 };
      if (useStep) {
        for (let i = 0; i < 10; i++) {
          sim.stepBy(0.1);
          story.handle({ type: 'time-step' });
        }
      } else {
        sim.start();
        for (let i = 0; i < 60; i++) sim.advance(1 / 60);
        sim.pause();
        story.handle({ type: 'time-paused' });
      }
      return story.stars('abajo');
    };
    expect(play(true)).toContain('paso');
    expect(play(false)).not.toContain('paso');
  });

  it('«¿Adónde se fue?»: con la línea de tiempo en el instante en que Q iguala a K', () => {
    const { story, world, sim } = setup(having(['vacio', 'particula', 'desde-siempre', 'abajo', 'conserva']));
    expect(story.enter('adonde')).toBe(true);
    // la caja frena con a = μc g: Q = K cuando v = v₀/√2
    sim.start();
    for (let i = 0; i < 240 && !sim.finished; i++) sim.advance(1 / 60);
    const v0 = 4;
    const tHalf = (v0 - v0 / Math.SQRT2) / (0.3 * 9.8);
    sim.seek(0.2);
    story.handle({ type: 'timeline-seek' });
    expect(story.stars('adonde')).not.toContain('mitad');
    sim.seek(tHalf);
    story.handle({ type: 'timeline-seek' });
    expect(world.particles[0]).toBeDefined();
    expect(story.stars('adonde')).toContain('mitad');
  });
});

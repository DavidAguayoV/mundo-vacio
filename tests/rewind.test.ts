import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/physics/simulation';
import { View } from '../src/render/view';
import { freshProgress, giveRewind } from '../src/state/progress';
import { SiteEngine } from '../src/story/siteEngine';
import { SITES, ZONES } from '../src/story/sites';
import type { Grant, Site, Step, StoryContext } from '../src/story/types';
import { World } from '../src/world/world';

// «Vuelve a t = 0» solo puede pedirse a quien ya tiene el botón t = 0 (hallazgo P1 n.º 0 de la auditoría).

function ctx(): StoryContext {
  const world = new World();
  const view = new View();
  view.resize(1200, 800, 1);
  const sim = new Simulation(world);
  return new SiteEngine(SITES, ZONES, freshProgress(), { world, view, sim }, () => {}).ctx;
}

const REWIND: Grant = 'time:rewind';

/** ¿El paso pide volver a t = 0? (en su texto o como la herramienta que destaca) */
function asksRewind(step: Step, c: StoryContext): boolean {
  if (step.tool === REWIND) return true;
  let text = '';
  try {
    text = typeof step.text === 'function' ? step.text(c) : step.text;
  } catch {
    return false;
  }
  return /vuelve a t = 0/i.test(text);
}

const gives = (s: Site): Set<Grant> => new Set([...(s.grants ?? []), ...s.steps.flatMap((st) => st.grants ?? [])]);

/**
 * ¿Tener esta herramienta asegura tener ya t = 0? Sí, si todos los rastros que la dan entregan t = 0
 * al resolverse, o piden para entrar algo que a su vez lo asegura.
 */
function impliesRewind(g: Grant, seen = new Set<Grant>()): boolean {
  if (g === REWIND) return true;
  // un rastro que pide lo mismo que da no puede ser la primera forma de ganarlo
  if (seen.has(g)) return true;
  seen.add(g);
  const sources = SITES.filter((s) => gives(s).has(g));
  return sources.length > 0 && sources.every((s) => gives(s).has(REWIND) || (s.needs ?? []).some((n) => impliesRewind(n, new Set(seen))));
}

describe('t = 0 antes de pedirlo', () => {
  it('«Desde siempre» entrega t = 0 en su último paso, después de la apuesta', () => {
    const drift = SITES.find((s) => s.id === 'desde-siempre')!;
    const last = drift.steps.at(-1)!;
    expect(last.grants).toEqual([REWIND]);
    drift.steps.slice(0, -1).forEach((st) => expect(st.grants ?? []).not.toContain(REWIND));
  });

  it('el tiempo que fluye solo se gana en «Desde siempre», así que quien lo tiene también tiene t = 0', () => {
    expect(SITES.filter((s) => gives(s).has('time:flow')).map((s) => s.id)).toEqual(['desde-siempre']);
    expect(impliesRewind('time:flow')).toBe(true);
  });

  it('ningún rastro pide «vuelve a t = 0» sin que el jugador tenga ya ese botón', () => {
    const c = ctx();
    const bad: string[] = [];
    for (const site of SITES) {
      const needsOk = (site.needs ?? []).some((n) => impliesRewind(n));
      site.steps.forEach((st, i) => {
        if (!asksRewind(st, c)) return;
        const lent = new Set([...(site.grants ?? []), ...site.steps.slice(0, i + 1).flatMap((x) => x.grants ?? [])]);
        if (!needsOk && !lent.has(REWIND)) bad.push(`${site.id} (paso ${i + 1})`);
      });
    }
    expect(bad).toEqual([]);
  });

  it('los rastros de la auditoría (boya, pozo, órbita, escape, Luna) piden t = 0 y quedan cubiertos', () => {
    const c = ctx();
    for (const id of ['boya', 'abajo', 'orbita', 'escape', 'luna']) {
      const site = SITES.find((s) => s.id === id)!;
      expect(site.steps.some((st) => asksRewind(st, c)), id).toBe(true);
      expect((site.needs ?? []).some((n) => impliesRewind(n)), id).toBe(true);
    }
  });

  it('un avance guardado con «Desde siempre» resuelto recibe t = 0 al cargarse', () => {
    const p = freshProgress();
    p.solved['desde-siempre'] = { stars: ['resuelto'], at: 1 };
    p.have = ['tool:particle', 'time:flow'];
    expect(giveRewind(p).have).toContain(REWIND);
    const q = freshProgress();
    expect(giveRewind(q).have).not.toContain(REWIND);
  });
});

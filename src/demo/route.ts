// El juego simple («Lanza y acierta»): siete rastros del juego completo, en orden, «del vacío a una
// órbita», en cuatro zonas. Cada parada es un rastro que ya existe; las diferencias van aquí como
// datos, sin tocar el rastro del juego completo. Ver PROPUESTA_JUEGO_SIMPLE.md.

import { CHAPTERS, ensureG } from '../story/chapters';
import { SITES, ZONES } from '../story/sites';
import type { Site, Step, StoryContext, Zone, ZoneId } from '../story/types';

export interface RouteStop {
  id: string;
  /** retos que en el juego simple no van (piden algo que no se entrega, o sobran) */
  dropMastery?: string[];
  /** cambia el rastro solo dentro del juego simple */
  variant?(site: Site): Site;
}

/**
 * «En órbita» sin haber pasado por «Todo atrae a todo»: presta la atracción desde que se entra (ya lo
 * hace, como en el juego completo) y antes presenta la idea con el primer paso de la gravitación.
 */
function orbitIntro(site: Site): Site {
  const intro = CHAPTERS.find((c) => c.id === 'gravitacion')!.steps[0];
  const first: Step = {
    ...intro,
    text: 'Lejos de la Tierra no hay un «abajo»: aquí no hay g. Quedan dos partículas, una de 64 kg y otra de 1 kg. Newton se dio cuenta de que **toda masa atrae a toda masa**: lo que hace caer una manzana es lo mismo que mantiene a la Luna dando vueltas. Enciende la **Atracción** en la barra.',
  };
  const [launch, ...rest] = site.steps;
  return {
    ...site,
    // la atracción la presta el rastro: basta con tener Velocidad
    needs: (site.needs ?? []).filter((g) => g !== 'force:gravitation'),
    steps: [
      first,
      {
        ...launch,
        text: 'Con **Velocidad**, dale a la de 1 kg una velocidad de lado, perpendicular a la línea que las une. ¿Logras que dé una vuelta completa sin chocar ni escaparse? Si no resulta, vuelve a t = 0 y prueba otra.',
      },
      ...rest,
    ],
  };
}

/** «¿Dónde es abajo?» sin cámara lenta: las marcas cada 0,1 s ya muestran que la caída se acelera. */
function fallWithoutSlowMotion(site: Site): Site {
  const i = site.steps.findIndex((st) => st.tool === 'time:slow');
  if (i < 0) return site;
  const steps = site.steps.filter((_, k) => k !== i);
  const after = steps[i];
  steps[i] = {
    ...after,
    text: 'Mira las marcas: ya no quedan igual de separadas. En cada 0,1 s recorre más que en el anterior: la velocidad crece lo mismo cada segundo, 9,80 m/s más. Eso mide la **aceleración**: cuánto cambia la velocidad por unidad de tiempo.',
  };
  return { ...site, steps };
}

/**
 * Cuándo llega a la cima el tiro del jugador: −(v₀·g)/|g|² (0 si sale de lado o hacia abajo y no
 * tiene un punto más alto).
 */
export function peakTime(ctx: StoryContext): number {
  const me = ctx.world.particles.find((p) => !p.locked);
  if (!me) return 0;
  const s = ctx.sim.initialState(me.id);
  const pos = s?.pos ?? me.pos;
  const v0 = s?.vel ?? me.vel;
  const g = ctx.world.gAt(pos);
  if (!g) return 0;
  const g2 = g.x * g.x + g.y * g.y;
  return g2 > 0 ? Math.max(0, -(v0.x * g.x + v0.y * g.y) / g2) : 0;
}

/** Un tiro sin punto más alto (de lado o hacia abajo) no sirve para mirar la cima. */
const MIN_PEAK_TIME = 0.1;

/**
 * «Al blanco» sin herramientas nuevas: se acierta, se apuesta qué pasa en la cima y, para comprobarlo,
 * el tiempo se detiene solo en el punto más alto (en el juego completo se busca con la línea de
 * tiempo y se lee en los gráficos; detenerlo a mano no sirve: la cima dura unas centésimas).
 */
function targetWithoutTimeline(site: Site): Site {
  const [hit, bet, , , reveal, ...rest] = site.steps;
  const peak: Step = {
    text: (ctx) =>
      peakTime(ctx) > MIN_PEAK_TIME
        ? 'Compruébalo: vuelve a t = 0 y deja fluir el tiempo. Se detendrá solo en el punto más alto: mira ahí la flecha de la velocidad.'
        : 'Tu tiro no subió, así que no tuvo un punto más alto. Vuelve a t = 0, dale con Velocidad un poco hacia arriba y deja fluir el tiempo: se detendrá solo en la cima.',
    on: 'tick',
    tool: 'time:rewind',
    enter: ensureG,
    when: (ctx) => {
      const tp = peakTime(ctx);
      if (tp <= MIN_PEAK_TIME) {
        ctx.sim.pauseAt = null;
        return false;
      }
      ctx.sim.pauseAt = tp;
      return ctx.sim.hasRun && !ctx.sim.running && Math.abs(ctx.sim.t - tp) < 0.02;
    },
  };
  return {
    ...site,
    needs: (site.needs ?? []).filter((g) => g !== 'lens:graphs'),
    steps: [
      hit,
      bet,
      peak,
      {
        ...reveal,
        // desde aquí el tiempo vuelve a fluir hasta el final del tiro
        enter: (ctx) => {
          ctx.sim.pauseAt = null;
          reveal.enter?.(ctx);
        },
      },
      ...rest,
    ],
  };
}

export const DEMO_ROUTE: RouteStop[] = [
  { id: 'vacio' },
  { id: 'particula' },
  { id: 'desde-siempre' },
  // un reto por rastro: el de la rapidez menor que 1,5 m/s queda para el juego completo
  { id: 'boya', dropMastery: ['calma'] },
  // «Con +0,1 s, detente justo…» pide el paso a paso, que el juego simple no entrega
  { id: 'abajo', dropMastery: ['paso'], variant: fallWithoutSlowMotion },
  { id: 'blanco', variant: targetWithoutTimeline },
  { id: 'orbita', variant: orbitIntro },
];

export const ROUTE_IDS = DEMO_ROUTE.map((r) => r.id);

/** Los rastros del juego simple: solo los siete de la ruta, con sus ajustes. */
export function demoSites(sites: Site[] = SITES): Site[] {
  return DEMO_ROUTE.map((stop) => {
    const s = sites.find((x) => x.id === stop.id);
    if (!s) throw new Error(`Falta el rastro ${stop.id}`);
    let out = s;
    if (stop.dropMastery) out = { ...out, mastery: out.mastery?.filter((m) => !stop.dropMastery!.includes(m.id)) };
    if (stop.variant) out = stop.variant(out);
    return out;
  });
}

/** Las zonas del juego simple: solo las que tienen un rastro de la ruta (el claro primero). */
export function demoZones(): Zone[] {
  const used = new Set<ZoneId>(demoSites().map((s) => s.zone));
  return ZONES.filter((z) => used.has(z.id));
}

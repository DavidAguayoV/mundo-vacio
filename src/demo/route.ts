// La ruta de la demo: siete rastros del juego completo, en orden, «del vacío a una órbita».
// Cada parada es un rastro que ya existe; las pocas diferencias van aquí como datos, sin tocar
// el rastro del juego completo.

import { CHAPTERS } from '../story/chapters';
import { SITES } from '../story/sites';
import type { Site, Step } from '../story/types';

export interface RouteStop {
  id: string;
  /** retos que en la demo no se pueden lograr (piden algo que la ruta no entrega) */
  dropMastery?: string[];
  /** cambia el rastro solo dentro de la demo */
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
    // la atracción la presta el rastro: en la demo basta con tener Velocidad
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

export const DEMO_ROUTE: RouteStop[] = [
  { id: 'vacio' },
  { id: 'particula' },
  { id: 'dos-saltos' },
  { id: 'desde-siempre' },
  // «Con +0,1 s, detente justo…» pide el paso a paso, que se gana en «Cuadro a cuadro» (fuera de la ruta)
  { id: 'abajo', dropMastery: ['paso'] },
  { id: 'boya' },
  { id: 'orbita', variant: orbitIntro },
];

export const ROUTE_IDS = DEMO_ROUTE.map((r) => r.id);

/** Los rastros de la demo: los 36 del juego completo, con las paradas de la ruta ajustadas. */
export function demoSites(sites: Site[] = SITES): Site[] {
  return sites.map((s) => {
    const stop = DEMO_ROUTE.find((r) => r.id === s.id);
    if (!stop) return s;
    let out = s;
    if (stop.dropMastery) out = { ...out, mastery: out.mastery?.filter((m) => !stop.dropMastery!.includes(m.id)) };
    if (stop.variant) out = stop.variant(out);
    return out;
  });
}

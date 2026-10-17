// Las puertas de la demo: durante la ruta solo se abre el siguiente rastro; los demás de la ruta se
// ven cerrados con su nombre, y el resto del mundo es apenas un punto. Al resolver el último, el
// mundo se abre y las puertas vuelven a ser las del juego completo.

import type { SiteEngine, SitePolicy } from '../story/siteEngine';
import type { Site } from '../story/types';
import { ROUTE_IDS } from './route';

/** Dónde va el jugador en la ruta. */
export interface RouteState {
  /** rastros de la ruta resueltos */
  done: number;
  /** el siguiente rastro de la ruta (null si ya terminó) */
  next: Site | null;
  /** ¿terminó la ruta? (el mundo está abierto) */
  complete: boolean;
}

export function routeState(story: SiteEngine): RouteState {
  const sites = ROUTE_IDS.map((id) => story.siteById(id)!);
  const nextIdx = sites.findIndex((s) => !story.isSolved(s.id));
  return {
    done: nextIdx < 0 ? sites.length : nextIdx,
    next: nextIdx < 0 ? null : sites[nextIdx],
    complete: nextIdx < 0,
  };
}

/** Posición en la ruta (0 = el primero), o −1 si el rastro no es de la ruta. */
export const routeIndex = (site: Site): number => ROUTE_IDS.indexOf(site.id);

export const demoPolicy: SitePolicy = {
  status(site, base, story) {
    const route = routeState(story);
    if (route.complete) return base;
    if (story.isSolved(site.id)) return 'resuelto';
    // el siguiente se abre siempre (la ruta entrega lo que pide; tests/demo.test.ts lo comprueba)
    return route.next?.id === site.id ? 'disponible' : 'cerrado';
  },
  lockReason(site, story) {
    const route = routeState(story);
    if (route.complete) return null;
    const i = routeIndex(site);
    if (i < 0) return 'Este rastro se abre al final del recorrido.';
    const prev = story.siteById(ROUTE_IDS[i - 1]);
    return prev ? `Se abre después de «${prev.title}».` : null;
  },
};

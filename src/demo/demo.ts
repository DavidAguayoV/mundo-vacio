// El modo demo: la ruta de siete rastros con «Siguiente» y el progreso a la vista.

import type { GameHost, ModeHooks } from '../mode';
import { ZONES } from '../story/sites';
import type { Site } from '../story/types';
import type { CardButton, MapCardContent } from '../ui/card';
import { demoPolicy, routeIndex, routeState } from './policy';
import { demoSites, ROUTE_IDS } from './route';

/** Zonas con nombre durante la ruta: las que tienen un rastro de la ruta. */
const ROUTE_ZONES = new Set(['claro', ...ZONES.filter((z) => demoSites().some((s) => s.zone === z.id && ROUTE_IDS.includes(s.id))).map((z) => z.id)]);

export function createDemo(): ModeHooks {
  let host: GameHost | null = null;

  const story = () => host!.story;
  const route = () => routeState(story());
  const zoneName = (site: Site) => story().zone(site.zone)?.name ?? '';

  const nextButton = (next: Site, fromSite: boolean): CardButton => ({
    label: `Siguiente: ${next.title}`,
    primary: true,
    run: () => (fromSite ? host!.travelTo(next.id) : host!.goToSite(next.id)),
  });

  const pageOf = (site: Site): CardButton => ({ label: 'Ver su página', run: () => host!.openJournal(site.id) });

  return {
    sites: demoSites(),
    policy: demoPolicy,
    card: {
      eyebrow(site) {
        const i = routeIndex(site);
        if (i < 0 || route().complete) return null;
        return `Rastro ${i + 1} de ${ROUTE_IDS.length} · ${zoneName(site)}`;
      },
      pageButtons(site) {
        const r = route();
        if (routeIndex(site) < 0) return null;
        // el último de la ruta deja la tarjeta de siempre
        return r.next ? [nextButton(r.next, true), pageOf(site)] : null;
      },
      solvedButtons(site) {
        const r = route();
        if (r.complete || routeIndex(site) < 0 || !r.next) return null;
        return [nextButton(r.next, false), pageOf(site)];
      },
      mapCard(): MapCardContent | null {
        const r = route();
        if (r.complete || !r.next) return null;
        return {
          key: `ruta:${r.next.id}`,
          eyebrow: `Rastro ${r.done + 1} de ${ROUTE_IDS.length} · ${zoneName(r.next)}`,
          title: r.next.title,
          text: `«${r.next.note}»`,
          buttons: [{ label: 'Entrar', primary: true, run: () => host!.goToSite(r.next!.id) }],
        };
      },
    },
    map: {
      named: () => (route().complete ? null : ROUTE_ZONES),
      faint: (site) => !route().complete && routeIndex(site) < 0,
      focus() {
        const r = route();
        if (r.complete || !r.next) return null;
        return [ZONES[0].at, r.next.at];
      },
    },
    mapSelection(left) {
      const r = route();
      return r.complete ? left : (r.next?.id ?? left);
    },
    bind(h) {
      host = h;
    },
  };
}

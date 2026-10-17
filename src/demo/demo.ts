// El modo demo: la ruta de siete rastros con «Siguiente», el progreso a la vista, la pantalla de
// entrada y el final «El mundo se abre».

import type { GameHost, ModeHooks } from '../mode';
import { storageKey } from '../state/storage';
import { ZONES } from '../story/sites';
import type { Site } from '../story/types';
import type { CardButton, MapCardContent } from '../ui/card';
import { showIntro } from './intro';
import { demoPolicy, routeIndex, routeState } from './policy';
import { demoSites, ROUTE_IDS } from './route';

export const FINALE_TEXT =
  'Empezaste sin un «aquí». Ahora tienes ejes, vectores, tiempo, gravedad y una órbita: una caída que nunca llega. Quien estuvo antes dejó más rastros (resortes, planos con roce, aire, energía, cuerpos que giran), y ya están todos abiertos. Tus herramientas también.';

/** ¿Ya se vio «El mundo se abre»? (con la ruta terminada, el mundo queda abierto desde entonces) */
function finaleSeen(): boolean {
  try {
    return localStorage.getItem(storageKey('finale')) === '1';
  } catch {
    return false;
  }
}

function markFinaleSeen(): void {
  try {
    localStorage.setItem(storageKey('finale'), '1');
  } catch {
    /* sin almacenamiento: el mundo se abre igual en esta visita */
  }
}

/** Zonas con nombre durante la ruta: las que tienen un rastro de la ruta. */
const ROUTE_ZONES = new Set(['claro', ...ZONES.filter((z) => demoSites().some((s) => s.zone === z.id && ROUTE_IDS.includes(s.id))).map((z) => z.id)]);

export function createDemo(): ModeHooks {
  let host: GameHost | null = null;
  /** la tarjeta del final está a la vista (hasta «Explorar el mapa») */
  let finale = false;

  const story = () => host!.story;
  const route = () => routeState(story());
  const zoneName = (site: Site) => story().zone(site.zone)?.name ?? '';

  /** El mundo se abre: todo ganado, la cámara se aleja y las zonas aparecen una tras otra. */
  function openWorld(): void {
    if (!host) return;
    story().grantAll();
    markFinaleSeen();
    finale = true;
    host.toMap();
    host.map.showAll(1800);
    host.map.reveal(ZONES.map((z) => z.id));
  }

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
        if (r.next) return [nextButton(r.next, true), pageOf(site)];
        // el último de la ruta: el mundo se abre (si ya estaba abierto, la tarjeta de siempre)
        if (site.id !== ROUTE_IDS.at(-1) || finaleSeen()) return null;
        return [{ label: 'El mundo se abre', primary: true, run: openWorld }, pageOf(site)];
      },
      solvedButtons(site) {
        const r = route();
        if (r.complete || routeIndex(site) < 0 || !r.next) return null;
        return [nextButton(r.next, false), pageOf(site)];
      },
      mapCard(): MapCardContent | null {
        if (finale) {
          const solved = story().sites.filter((s) => story().isSolved(s.id)).length;
          return {
            key: 'final',
            eyebrow: 'Fin del recorrido',
            title: 'El mundo se abre',
            text: FINALE_TEXT,
            extra: `${solved} de ${story().sites.length} rastros resueltos.`,
            buttons: [
              {
                label: 'Explorar el mapa',
                primary: true,
                run: () => {
                  finale = false;
                  host!.selectSite(null);
                },
              },
              { label: 'Abrir el laboratorio', run: () => host!.openLab() },
              { label: 'Ver mi bitácora', run: () => host!.openJournal() },
            ],
          };
        }
        const r = route();
        // la ruta terminó, pero se salió (o se recargó) antes de abrir el mundo
        if (r.complete && !finaleSeen()) {
          return {
            key: 'abrir',
            eyebrow: `Rastro ${ROUTE_IDS.length} de ${ROUTE_IDS.length} · resuelto`,
            title: 'El mundo se abre',
            text: 'Resolviste los siete rastros del recorrido.',
            buttons: [{ label: 'El mundo se abre', primary: true, run: openWorld }],
          };
        }
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
      if (finale || (r.complete && !finaleSeen())) return null;
      return r.complete ? left : (r.next?.id ?? left);
    },
    groupedBar: () => route().complete,
    bind(h) {
      host = h;
    },
    attach(h) {
      // el mundo ya se abrió en otra visita: todo sigue ganado
      if (route().complete && finaleSeen() && story().grantAll().length) h.refresh();
      showIntro(h);
    },
  };
}

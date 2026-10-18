// El juego simple («Lanza y acierta», en demo.html): siete rastros en cuatro zonas, con «Siguiente»
// y el progreso a la vista, la pantalla de entrada y, al final, todas las herramientas del juego.
// Con ?kiosco, el reinicio por inactividad.

import type { GameHost, ModeHooks } from '../mode';
import { storageKey } from '../state/storage';
import { FORCE_SWITCHES, LENSES, TIME_SKILLS, type Grant, type Site } from '../story/types';
import { TOOL_ORDER } from '../tools/registry';
import type { CardButton, MapCardContent } from '../ui/card';
import { mountChrome } from './chrome';
import { showIntro } from './intro';
import { demoPolicy, routeIndex, routeState } from './policy';
import { demoSites, demoZones, ROUTE_IDS } from './route';

export interface DemoOptions {
  /** computador o tablet de feria: vuelve sola al comienzo tras un rato sin nadie */
  kiosk: boolean;
}

/** Todo lo que se puede tener en el juego completo: lo que se entrega al terminar el recorrido. */
export const ALL_GRANTS: Grant[] = [
  ...TOOL_ORDER.map((t) => `tool:${t}` as Grant),
  ...TIME_SKILLS.map((t) => `time:${t}` as Grant),
  ...FORCE_SWITCHES.map((f) => `force:${f}` as Grant),
  ...LENSES.map((l) => `lens:${l}` as Grant),
];

export const FINALE_TEXT =
  'Empezaste sin un «aquí». Ahora tienes ejes, tiempo, velocidad, gravedad y una órbita: una caída que nunca llega. Desde ahora tienes **todas las herramientas** (superficies, resortes, el aire, la energía, los gráficos y más) para probarlas en el laboratorio o en los rastros.';

/** ¿Ya se vio el final? (con la ruta terminada, todo queda ganado desde entonces) */
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
    /* sin almacenamiento: el final vale para esta visita */
  }
}

export function createDemo(opts: DemoOptions): ModeHooks {
  let host: GameHost | null = null;
  /** la tarjeta del final está a la vista (hasta «Volver al mapa») */
  let finale = false;

  const sites = demoSites();
  const zones = demoZones();
  const story = () => host!.story;
  const route = () => routeState(story());
  const zoneName = (site: Site) => story().zone(site.zone)?.name ?? '';
  /** ¿Terminó el recorrido y ya se entregó todo? */
  const open = () => route().complete && finaleSeen();

  /** El final: todas las herramientas, la cámara muestra las cuatro zonas y aparecen una tras otra. */
  function finish(): void {
    if (!host) return;
    story().grantAll(ALL_GRANTS);
    markFinaleSeen();
    finale = true;
    host.toMap();
    const map = host.map;
    const all = map.frameOf([...zones.map((z) => z.at), ...sites.map((s) => s.at)]);
    map.flyTo(all.center, all.zoom, 1800);
    map.reveal(zones.map((z) => z.id), 380);
  }

  const nextButton = (next: Site, fromSite: boolean): CardButton => ({
    label: `Siguiente: ${next.title}`,
    primary: true,
    run: () => (fromSite ? host!.travelTo(next.id) : host!.goToSite(next.id)),
  });

  const pageOf = (site: Site): CardButton => ({ label: 'Ver su página', run: () => host!.openJournal(site.id) });

  const starCount = () => {
    const s = story();
    return { got: s.sites.reduce((n, x) => n + s.stars(x.id).length, 0), max: s.sites.reduce((n, x) => n + s.maxStars(x), 0) };
  };

  return {
    sites,
    zones,
    policy: {
      ...demoPolicy,
      // el laboratorio libre se abre al terminar: con todo
      freeGrants: () => new Set(ALL_GRANTS),
    },
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
        // el último de la ruta cierra el recorrido (si ya se cerró, la tarjeta de siempre)
        if (site.id !== ROUTE_IDS.at(-1) || finaleSeen()) return null;
        return [{ label: 'Terminar el recorrido', primary: true, run: finish }, pageOf(site)];
      },
      solvedButtons(site) {
        const r = route();
        if (r.complete || routeIndex(site) < 0 || !r.next) return null;
        return [nextButton(r.next, false), pageOf(site)];
      },
      mapCard(): MapCardContent | null {
        if (finale) {
          const { got, max } = starCount();
          return {
            key: 'final',
            eyebrow: 'Fin del recorrido',
            title: 'Del vacío a una órbita',
            text: FINALE_TEXT,
            extra: `${got} de ${max} estrellas: vuelve a cualquier rastro para ganar las que faltan.`,
            buttons: [
              { label: 'Abrir el laboratorio', primary: true, run: () => host!.openLab() },
              { label: 'Ver mi bitácora', run: () => host!.openJournal() },
              {
                label: 'Volver al mapa',
                run: () => {
                  finale = false;
                  host!.selectSite(null);
                },
              },
            ],
          };
        }
        const r = route();
        // la ruta terminó, pero se salió (o se recargó) antes de cerrarla
        if (r.complete && !finaleSeen()) {
          return {
            key: 'cerrar',
            eyebrow: `Rastro ${ROUTE_IDS.length} de ${ROUTE_IDS.length} · resuelto`,
            title: 'Del vacío a una órbita',
            text: 'Resolviste los siete rastros del recorrido.',
            buttons: [{ label: 'Terminar el recorrido', primary: true, run: finish }],
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
      // solo hay cuatro zonas: todas con nombre desde el comienzo
      named: () => new Set(zones.map((z) => z.id)),
      focus() {
        const r = route();
        if (r.complete || !r.next) return [...zones.map((z) => z.at), ...sites.map((s) => s.at)];
        return [zones[0].at, r.next.at];
      },
    },
    mapSelection(left) {
      const r = route();
      if (finale || (r.complete && !finaleSeen())) return null;
      return r.complete ? left : (r.next?.id ?? left);
    },
    // con todas las herramientas son más de veinte botones: en grupos
    groupedBar: open,
    // el laboratorio y el árbol aparecen al terminar el recorrido
    bar: () => ({ lab: open(), tree: open() }),
    bind(h) {
      host = h;
    },
    attach(h) {
      // el recorrido ya se cerró en otra visita: todo sigue ganado
      if (open() && story().grantAll(ALL_GRANTS).length) h.refresh();
      mountChrome(h, opts);
      showIntro(h);
    },
  };
}

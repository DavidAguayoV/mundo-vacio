// Un modo de juego aparte (la demo) cambia algunas cosas del juego completo sin tocar su código:
// qué rastros hay, cuáles se abren, qué dicen la tarjeta y el mapa, y agrega su propia interfaz.
// Sin modo, el juego es el de siempre.

import type { MapHooks, WorldMap } from './map/worldMap';
import type { SiteEngine, SitePolicy } from './story/siteEngine';
import type { Site, Zone } from './story/types';
import type { CardHooks } from './ui/card';

/** Lo que el juego le deja manejar a un modo. */
export interface GameHost {
  readonly story: SiteEngine;
  readonly map: WorldMap;
  /** desde el mapa: acercarse al rastro y entrar */
  goToSite(id: string): void;
  /** desde un rastro: volver al mapa, viajar hasta otro rastro y entrar */
  travelTo(id: string): void;
  /** volver al mapa; done, cuando la cámara llegó */
  toMap(done?: () => void): void;
  selectSite(id: string | null): void;
  /** empezar de nuevo, con el avance borrado */
  restart(): void;
  openLab(): void;
  openJournal(site?: string): void;
  /** vuelve a dibujar la tarjeta, la barra y el mapa */
  refresh(): void;
  toast(message: string, ms?: number): void;
  /** entrar al laboratorio libre (o salir de él) */
  setFree(free: boolean): void;
  /** dónde están en la pantalla el origen y el asa de los ejes (null si no hay ejes) */
  axisOnScreen(): { origin: { x: number; y: number }; handle: { x: number; y: number } } | null;
}

export interface ModeHooks {
  /** los rastros del modo (por defecto, los del juego completo) */
  sites?: Site[];
  /** las zonas del mapa (por defecto, las diez del juego completo) */
  zones?: Zone[];
  /** qué rastros se abren */
  policy?: SitePolicy;
  card?: CardHooks;
  map?: MapHooks;
  /** qué rastro queda elegido al llegar al mapa; `left` es el rastro del que se sale */
  mapSelection?(left: string | null): string | null;
  /** la barra en grupos con rótulo (herramientas · fuerzas y lentes · tiempo · navegación) */
  groupedBar?(): boolean;
  /** qué botones de navegación se ven (por defecto, los de siempre) */
  bar?(): { lab?: boolean; tree?: boolean };
  /** el juego ya existe (al final de su constructor, antes de dibujar nada): el modo lo recibe */
  bind?(host: GameHost): void;
  /** el juego arrancó: el modo agrega su interfaz */
  attach?(host: GameHost): void;
}

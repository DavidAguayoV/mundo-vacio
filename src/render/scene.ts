import type { Simulation } from '../physics/simulation';
import type { EntityRef, World } from '../world/world';
import type { Painter } from './painter';
import type { View } from './view';

/** Todo lo que una capa necesita para dibujar un cuadro. */
export interface Scene {
  world: World;
  sim: Simulation;
  view: View;
  painter: Painter;
  selection: EntityRef | null;
  /** ids resaltados por la herramienta activa (por ejemplo, el primer vector elegido para sumar) */
  highlighted: ReadonlySet<string>;
  /** segundos que le quedan al destello del blanco */
  hitFlash: number;
  /** borrador de la herramienta activa (flecha en construcción, etc.) */
  draft: ((p: Painter) => void) | null;
  /** qué dibujar (el laboratorio permite ocultar r y las trayectorias cuando hay muchas partículas) */
  display: { positions: boolean; trails: boolean };
}

export type Layer = (scene: Scene) => void;

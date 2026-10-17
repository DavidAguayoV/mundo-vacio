import type { Simulation } from '../physics/simulation';
import type { EntityRef, World } from '../world/world';
import type { Vec2 } from '../core/vec';
import type { Painter, Rect } from './painter';
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
  /** zonas del lienzo tapadas por la interfaz (tarjeta del relato, paneles, barra), en px CSS: los rótulos las evitan */
  avoid: readonly Rect[];
  /** dónde se dibuja la sonda (en su partida o en pleno salto); null si el rastro no tiene sonda */
  probe?: Vec2 | null;
}

export type Layer = (scene: Scene) => void;

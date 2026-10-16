import type { GameEvent } from '../core/events';
import type { Vec2 } from '../core/vec';
import type { Simulation } from '../physics/simulation';
import type { Painter } from '../render/painter';
import type { View } from '../render/view';
import type { EntityRef, World } from '../world/world';

export type ToolId = 'move' | 'origin' | 'particle' | 'vector' | 'sum' | 'gravity' | 'velocity' | 'surface' | 'spring';

/** Un toque o clic ya convertido a metros. */
export interface WorldPointer {
  /** posición en coordenadas globales, m */
  p: Vec2;
  /** radio de toque en metros: mayor con el dedo que con el mouse */
  tol: number;
}

/** Lo que una herramienta puede leer y cambiar. */
export interface ToolContext {
  world: World;
  view: View;
  sim: Simulation;
  readonly selection: EntityRef | null;
  select(ref: EntityRef | null): void;
  /** ids que la herramienta quiere resaltar en el lienzo */
  highlighted: Set<string>;
  emit(ev: GameEvent): void;
  toast(msg: string): void;
}

/** Interfaz común de las herramientas (plugins de la caja de herramientas). */
export interface Tool {
  id: ToolId;
  name: string;
  /** SVG en línea, 24×24, con stroke="currentColor" */
  icon: string;
  onActivate?(ctx: ToolContext): void;
  onDeactivate?(ctx: ToolContext): void;
  onPointerDown(e: WorldPointer, ctx: ToolContext): void;
  onPointerMove(e: WorldPointer, ctx: ToolContext): void;
  onPointerUp(e: WorldPointer, ctx: ToolContext): void;
  /** dibuja lo que está en construcción (flecha de g mientras se arrastra, etc.) */
  renderDraft?(p: Painter, ctx: ToolContext): void;
}

import type { GameEventType } from '../core/events';
import type { Simulation } from '../physics/simulation';
import type { View } from '../render/view';
import type { ToolId } from '../tools/tool';
import type { World } from '../world/world';

/** Lo que un capítulo puede consultar o preparar. */
export interface StoryContext {
  world: World;
  view: View;
  sim: Simulation;
  /** ¿ocurrió este evento desde que empezó el paso actual? */
  seen(type: GameEventType): boolean;
}

export interface Step {
  text: string;
  /** evento que completa el paso; 'end' marca el cierre de la historia (no se completa solo) */
  on: GameEventType | 'end';
  /** condición adicional que debe cumplirse cuando llega el evento */
  when?(ctx: StoryContext): boolean;
  /** se llama al entrar al paso, y también al retomarlo tras recargar la página */
  enter?(ctx: StoryContext): void;
}

export interface Chapter {
  id: string;
  title: string;
  /** herramientas que se desbloquean al empezar el capítulo */
  unlocks: ToolId[];
  /** muestra los controles Lanzar / Reiniciar */
  sim?: boolean;
  /** deja el mundo como debería estar al empezar el capítulo (al retomarlo o al llegar a él) */
  seed?(ctx: StoryContext): void;
  steps: Step[];
}

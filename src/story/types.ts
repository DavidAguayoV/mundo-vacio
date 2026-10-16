import type { GameEventType } from '../core/events';
import type { Simulation } from '../physics/simulation';
import type { View } from '../render/view';
import type { ToolId } from '../tools/tool';
import type { World } from '../world/world';

/** Habilidades para controlar el tiempo. */
export type TimeSkill = 'flow' | 'rewind' | 'step' | 'slow' | 'timeline';

/** Fuerzas que son una propiedad del mundo y se encienden con un interruptor (no con el puntero). */
export type ForceSwitch = 'gravitation' | 'drag';

/** Algo que el relato le entrega al jugador: una herramienta, una habilidad del tiempo o un interruptor de fuerza. */
export type Grant = `tool:${ToolId}` | `time:${TimeSkill}` | `force:${ForceSwitch}`;

export const TIME_SKILLS: TimeSkill[] = ['flow', 'rewind', 'step', 'slow', 'timeline'];
export const FORCE_SWITCHES: ForceSwitch[] = ['gravitation', 'drag'];

/** Lo que un capítulo puede consultar o preparar. */
export interface StoryContext {
  world: World;
  view: View;
  sim: Simulation;
  /** ¿ocurrió este evento desde que empezó el paso actual? */
  seen(type: GameEventType): boolean;
  /** cuántas veces ocurrió desde que empezó el paso actual */
  count(type: GameEventType): number;
  /** la opción que eligió el jugador en una predicción (undefined si no respondió) */
  prediction(key: string): string | undefined;
}

export interface Choice {
  id: string;
  label: string;
}

export interface Step {
  /** texto de la tarjeta; **así** va en negrita. Puede depender de las predicciones. */
  text: string | ((ctx: StoryContext) => string);
  /** evento que completa el paso; 'end' marca el cierre (no se completa solo) */
  on: GameEventType | 'end';
  /** condición adicional que debe cumplirse cuando llega el evento */
  when?(ctx: StoryContext): boolean;
  /** se llama al entrar al paso, y también al retomarlo tras recargar la página */
  enter?(ctx: StoryContext): void;
  /** herramientas o habilidades que se ganan al llegar a este paso */
  grants?: Grant[];
  /** predicción: la tarjeta muestra estas opciones y el paso se completa al elegir una */
  choices?: Choice[];
  /** clave con que se guarda la predicción */
  ask?: string;
  /** texto del botón cuando on === 'next' (por defecto, «Siguiente») */
  button?: string;
  /** tarjeta de cierre «Mirada de ingeniería» */
  kind?: 'engineering';
}

export interface Chapter {
  id: string;
  /** acto del relato: «I · Dónde», «II · Cuándo», «III · Por qué» */
  act: string;
  title: string;
  /** herramientas o habilidades que se ganan al empezar el capítulo */
  grants?: Grant[];
  /** deja el mundo como debería estar al empezar el capítulo (al retomarlo o al llegar a él) */
  seed?(ctx: StoryContext): void;
  steps: Step[];
}

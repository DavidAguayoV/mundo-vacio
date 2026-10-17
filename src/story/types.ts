import type { GameEventType } from '../core/events';
import type { Simulation } from '../physics/simulation';
import type { View } from '../render/view';
import type { ToolId } from '../tools/tool';
import type { World } from '../world/world';

/** Habilidades para controlar el tiempo. */
export type TimeSkill = 'flow' | 'rewind' | 'step' | 'slow' | 'timeline';

/** Fuerzas que son una propiedad del mundo y se encienden con un interruptor (no con el puntero). */
export type ForceSwitch = 'gravitation' | 'drag';

/** Formas de mirar el mundo que no cambian la física (solo muestran). */
export type LensId = 'energy' | 'graphs';

/** Algo que el relato le entrega al jugador: una herramienta, una habilidad del tiempo, un interruptor de fuerza o un lente. */
export type Grant = `tool:${ToolId}` | `time:${TimeSkill}` | `force:${ForceSwitch}` | `lens:${LensId}`;

export const TIME_SKILLS: TimeSkill[] = ['flow', 'rewind', 'step', 'slow', 'timeline'];
export const FORCE_SWITCHES: ForceSwitch[] = ['gravitation', 'drag'];
export const LENSES: LensId[] = ['energy', 'graphs'];

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
  /** el texto de la opción que eligió el jugador (para repetírselo al revelar) */
  predictionLabel?(key: string): string | undefined;
  /** cuántas veces ocurrió desde que se entró al rastro (para los retos de maestría) */
  total(type: GameEventType): number;
  /** cuántos lanzamientos distintos hubo desde que se entró al rastro */
  runs(): number;
}

export interface Choice {
  id: string;
  label: string;
}

export interface Step {
  /** texto de la tarjeta; **así** va en negrita. Puede depender de las predicciones. */
  text: string | ((ctx: StoryContext) => string);
  /**
   * evento que completa el paso; 'end' marca el cierre (no se completa solo);
   * 'tick' se revisa en cada cuadro con `when` (para objetivos que son una condición del mundo)
   */
  on: GameEventType | 'end' | 'tick';
  /** condición adicional que debe cumplirse cuando llega el evento */
  when?(ctx: StoryContext): boolean;
  /**
   * Cuando llega el evento, si devuelve un texto el paso no se da por cumplido: el texto se muestra
   * como aviso y pide repetir (por ejemplo, «te pasaste del ángulo justo»).
   */
  retry?(ctx: StoryContext): string | null;
  /** se llama al entrar al paso, y también al retomarlo tras recargar la página */
  enter?(ctx: StoryContext): void;
  /** herramientas o habilidades que se ganan al llegar a este paso */
  grants?: Grant[];
  /** predicción: la tarjeta muestra estas opciones y el paso se completa al elegir una */
  choices?: Choice[];
  /** clave con que se guarda la predicción */
  ask?: string;
  /** la opción que acierta (da la estrella de predicción) */
  correct?: string;
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

// ---------- el mundo abierto: zonas y rastros ----------

export type ZoneId = 'claro' | 'constelacion' | 'deriva' | 'pozo' | 'laderas' | 'taller' | 'astro' | 'mar' | 'central' | 'puente';

/** Una región del mapa. Las coordenadas del mapa son unidades propias, no metros del mundo. */
export interface Zone {
  id: ZoneId;
  name: string;
  /** centro en el mapa */
  at: { x: number; y: number };
  /** qué física hay allí, en pocas palabras (se muestra en el mapa) */
  hint: string;
}

/** Página de la bitácora que se escribe al resolver un rastro. */
export interface Page {
  /** la idea, en una línea */
  law: string;
  /** lo que midió el estudiante, si el rastro lo permite (se calcula al resolver) */
  measured?(ctx: StoryContext): string | null;
  /** mirada de ingeniería */
  engineering: string;
}

/** Reto de maestría: una estrella extra, opcional. */
export interface Mastery {
  id: string;
  label: string;
  /** evento que se revisa ('tick' = cada cuadro) */
  on: GameEventType | 'tick';
  when?(ctx: StoryContext): boolean;
}

/**
 * Un rastro: una situación en un lugar del mapa, con un objetivo. Se juega como un capítulo
 * (pasos que avanzan con eventos), pero se elige desde el mapa y se puede repetir.
 */
export interface Site {
  id: string;
  zone: ZoneId;
  title: string;
  /** posición en el mapa */
  at: { x: number; y: number };
  /** la nota que dejó quien estuvo antes: lo primero que se lee del rastro */
  note: string;
  /** lo que hace falta para resolverlo (puertas suaves: se ve, pero no se entra sin esto) */
  needs?: Grant[];
  /** lo que se gana al entrar */
  grants?: Grant[];
  /** arma el mundo del rastro desde cero */
  seed?(ctx: StoryContext): void;
  steps: Step[];
  page: Page;
  mastery?: Mastery[];
}

/** Estrellas: resolver, predecir bien y los retos de maestría. */
export const STAR_SOLVED = 'resuelto';
export const STAR_PREDICTION = 'prediccion';

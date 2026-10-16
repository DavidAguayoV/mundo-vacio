import type { ToolId } from '../tools/tool';

export interface SkillNode {
  id: string;
  name: string;
  desc: string;
  tier: number;
  /** herramienta del juego que representa (si ya existe) */
  tool?: ToolId;
  /** nodos que deben estar disponibles antes */
  requires?: string[];
}

export type SkillState = 'disponible' | 'próxima' | 'bloqueada';

export const TIERS = ['I · Espacio', 'II · Vectores', 'III · Movimiento', 'IV · Contacto', 'V · Más fuerzas', 'VI · Marcos'];

export const SKILLS: SkillNode[] = [
  { id: 'origin', tier: 0, tool: 'origin', name: 'Origen', desc: 'Fija un punto y orienta los ejes.' },
  { id: 'particle', tier: 0, tool: 'particle', name: 'Partícula', desc: 'Un punto con masa y posición.' },
  { id: 'move', tier: 0, tool: 'move', name: 'Mover', desc: 'Arrastra, selecciona y mide.' },
  { id: 'vector', tier: 1, tool: 'vector', name: 'Vector', desc: 'Magnitud, dirección y componentes.' },
  { id: 'sum', tier: 1, tool: 'sum', name: 'Sumar', desc: 'Cola con punta.' },
  { id: 'dot', tier: 1, name: 'Escalar y producto punto', desc: 'Estirar, invertir y proyectar vectores.', requires: ['vector'] },
  { id: 'gravity', tier: 2, tool: 'gravity', name: 'Gravedad', desc: 'Campo uniforme g. Tú decides dónde es abajo.' },
  { id: 'velocity', tier: 2, tool: 'velocity', name: 'Velocidad', desc: 'Condición inicial v₀.' },
  { id: 'surface', tier: 3, name: 'Superficie', desc: 'Un plano que las partículas no pueden atravesar.', requires: ['gravity'] },
  { id: 'normal', tier: 3, name: 'Normal', desc: 'La fuerza que hace la superficie.', requires: ['surface'] },
  { id: 'friction', tier: 3, name: 'Roce', desc: 'Estático y cinético.', requires: ['normal'] },
  { id: 'spring', tier: 4, name: 'Resorte', desc: 'Ley de Hooke entre dos partículas.', requires: ['vector'] },
  { id: 'gravitation', tier: 4, name: 'Gravitación', desc: 'Masas que se atraen entre sí: órbitas.', requires: ['velocity'] },
  { id: 'drag', tier: 4, name: 'Arrastre', desc: 'Fuerza que depende de la velocidad.', requires: ['velocity'] },
  { id: 'accel-frame', tier: 5, name: 'Marco acelerado', desc: '¿Qué ve alguien dentro de un ascensor?', requires: ['gravity'] },
  { id: '3d', tier: 5, name: 'Tercera dimensión', desc: 'El mismo juego con un eje z.' },
];

/** Primer nodo de la hoja de ruta cuando ya no quedan capítulos. */
const ROADMAP_NEXT = 'surface';

export function skillState(node: SkillNode, unlocked: ReadonlySet<ToolId>, upcoming: readonly ToolId[]): SkillState {
  if (node.tool && unlocked.has(node.tool)) return 'disponible';
  if (node.tool && upcoming.includes(node.tool)) return 'próxima';
  if (!upcoming.length && node.id === ROADMAP_NEXT) return 'próxima';
  return 'bloqueada';
}

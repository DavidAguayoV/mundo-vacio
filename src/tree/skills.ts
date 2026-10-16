export interface SkillNode {
  id: string;
  name: string;
  desc: string;
  tier: number;
  /** capítulo del relato que la desbloquea (sin capítulo: todavía en la hoja de ruta) */
  chapter?: string;
  /** nodos que deben estar disponibles antes */
  requires?: string[];
}

export type SkillState = 'disponible' | 'próxima' | 'bloqueada';

export const TIERS = ['I · Espacio', 'II · Vectores', 'III · Movimiento', 'IV · Contacto', 'V · Más fuerzas', 'VI · Marcos'];

export const SKILLS: SkillNode[] = [
  { id: 'origin', tier: 0, chapter: 'vacio', name: 'Origen', desc: 'Fija un punto y orienta los ejes.' },
  { id: 'particle', tier: 0, chapter: 'particula', name: 'Partícula', desc: 'Un punto con masa y posición.' },
  { id: 'move', tier: 0, chapter: 'particula', name: 'Mover', desc: 'Arrastra, selecciona y mide.' },
  { id: 'vector', tier: 1, chapter: 'vectores', name: 'Vector', desc: 'Magnitud, dirección y componentes.' },
  { id: 'sum', tier: 1, chapter: 'vectores', name: 'Sumar', desc: 'Cola con punta.' },
  { id: 'dot', tier: 1, name: 'Escalar y producto punto', desc: 'Estirar, invertir y proyectar vectores.', requires: ['vector'] },
  { id: 'gravity', tier: 2, chapter: 'abajo', name: 'Gravedad', desc: 'Campo uniforme g. Tú decides dónde es abajo.' },
  { id: 'velocity', tier: 2, chapter: 'velocidad', name: 'Velocidad', desc: 'Condición inicial v₀.' },
  { id: 'surface', tier: 3, chapter: 'superficies', name: 'Superficie', desc: 'Un plano que las partículas no pueden atravesar.' },
  { id: 'normal', tier: 3, chapter: 'superficies', name: 'Normal', desc: 'La fuerza que hace la superficie.' },
  { id: 'friction', tier: 3, chapter: 'superficies', name: 'Roce', desc: 'Estático y cinético.' },
  { id: 'spring', tier: 4, name: 'Resorte', desc: 'Ley de Hooke entre dos partículas.', requires: ['vector'] },
  { id: 'gravitation', tier: 4, name: 'Gravitación', desc: 'Masas que se atraen entre sí: órbitas.', requires: ['velocity'] },
  { id: 'drag', tier: 4, name: 'Arrastre', desc: 'Fuerza que depende de la velocidad.', requires: ['velocity'] },
  { id: 'accel-frame', tier: 5, name: 'Marco acelerado', desc: '¿Qué ve alguien dentro de un ascensor?', requires: ['gravity'] },
  { id: '3d', tier: 5, name: 'Tercera dimensión', desc: 'El mismo juego con un eje z.' },
];

/** Primer nodo de la hoja de ruta cuando ya no quedan capítulos. */
const ROADMAP_NEXT = 'spring';

/**
 * @param reached capítulos ya alcanzados
 * @param next capítulo siguiente (null si ya no quedan)
 */
export function skillState(node: SkillNode, reached: ReadonlySet<string>, next: string | null): SkillState {
  if (node.chapter && reached.has(node.chapter)) return 'disponible';
  if (node.chapter && node.chapter === next) return 'próxima';
  if (!next && node.id === ROADMAP_NEXT) return 'próxima';
  return 'bloqueada';
}

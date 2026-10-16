import type { Grant } from '../story/types';

export interface SkillNode {
  id: string;
  name: string;
  desc: string;
  tier: number;
  /** lo que el relato entrega con este nodo (una herramienta o una habilidad del tiempo) */
  grant?: Grant;
  /** para ideas que no son herramientas (normal, roce): el capítulo que las presenta */
  chapter?: string;
  /** nodos que deben estar disponibles antes */
  requires?: string[];
}

export type SkillState = 'disponible' | 'próxima' | 'bloqueada';

export const TIERS = ['I · Espacio', 'II · Vectores', 'III · Tiempo', 'IV · Movimiento', 'V · Contacto', 'VI · Más fuerzas', 'VII · Más allá'];

export const SKILLS: SkillNode[] = [
  { id: 'origin', tier: 0, grant: 'tool:origin', name: 'Origen', desc: 'Fija un punto y orienta los ejes.' },
  { id: 'particle', tier: 0, grant: 'tool:particle', name: 'Partícula', desc: 'Un punto con masa y posición.' },
  { id: 'move', tier: 0, grant: 'tool:move', name: 'Mover', desc: 'Arrastra, selecciona y mide.' },
  { id: 'vector', tier: 1, grant: 'tool:vector', name: 'Vector', desc: 'Magnitud, dirección y componentes.' },
  { id: 'sum', tier: 1, grant: 'tool:sum', name: 'Sumar', desc: 'Cola con punta.' },
  { id: 'dot', tier: 1, name: 'Escalar y producto punto', desc: 'Estirar, invertir y proyectar vectores.', requires: ['vector'] },
  { id: 'flow', tier: 2, grant: 'time:flow', name: 'Tiempo', desc: 'Dejar que el tiempo fluya y detenerlo.' },
  { id: 'rewind', tier: 2, grant: 'time:rewind', name: 'Volver a t = 0', desc: 'Regresar al instante inicial.' },
  { id: 'step', tier: 2, grant: 'time:step', name: 'Paso a paso', desc: 'Avanzar 0,1 s por toque.' },
  { id: 'slow', tier: 2, grant: 'time:slow', name: 'Cámara lenta', desc: 'Ver pasar el tiempo a ×½ o ×¼.' },
  { id: 'timeline', tier: 2, grant: 'time:timeline', name: 'Línea de tiempo', desc: 'Ir a cualquier instante, hacia adelante o hacia atrás.' },
  { id: 'velocity', tier: 3, grant: 'tool:velocity', name: 'Velocidad', desc: 'v = Δr/Δt. Lo que se mueve sigue moviéndose.' },
  { id: 'gravity', tier: 3, grant: 'tool:gravity', name: 'Gravedad', desc: 'Campo uniforme g. Tú decides dónde es abajo.' },
  { id: 'surface', tier: 4, grant: 'tool:surface', name: 'Superficie', desc: 'Un plano que las partículas no pueden atravesar.' },
  { id: 'normal', tier: 4, chapter: 'superficies', name: 'Normal', desc: 'La fuerza que hace la superficie.' },
  { id: 'friction', tier: 4, chapter: 'superficies', name: 'Roce', desc: 'Estático y cinético.' },
  { id: 'spring', tier: 5, grant: 'tool:spring', name: 'Resorte', desc: 'Ley de Hooke y oscilaciones.' },
  { id: 'gravitation', tier: 5, grant: 'force:gravitation', name: 'Gravitación', desc: 'Masas que se atraen entre sí: órbitas y escape.' },
  { id: 'drag', tier: 5, grant: 'force:drag', name: 'Arrastre', desc: 'Aire y agua: la velocidad terminal.' },
  { id: 'energy', tier: 6, grant: 'lens:energy', name: 'Energía', desc: 'Lo que se conserva cuando todo cambia.' },
  { id: 'heat', tier: 6, name: 'Calor', desc: 'Adónde va la energía cuando algo frena.', requires: ['energy'] },
  { id: 'accel-frame', tier: 6, name: 'Marco acelerado', desc: '¿Qué ve alguien dentro de un ascensor?', requires: ['gravity'] },
  { id: '3d', tier: 6, name: 'Tercera dimensión', desc: 'El mismo juego con un eje z.' },
];

/** Primer nodo de la hoja de ruta cuando ya no quedan capítulos. */
const ROADMAP_NEXT = 'heat';

export interface TreeProgress {
  /** herramientas y habilidades ya ganadas */
  have: ReadonlySet<Grant>;
  /** las que faltan en este capítulo o llegan en el siguiente */
  upcoming: ReadonlySet<Grant>;
  /** capítulos alcanzados */
  reached: ReadonlySet<string>;
  /** capítulo siguiente (null si ya no quedan) */
  next: string | null;
}

export function skillState(node: SkillNode, p: TreeProgress): SkillState {
  if (node.grant) {
    if (p.have.has(node.grant)) return 'disponible';
    if (p.upcoming.has(node.grant)) return 'próxima';
  }
  if (node.chapter) {
    if (p.reached.has(node.chapter)) return 'disponible';
    if (node.chapter === p.next) return 'próxima';
  }
  const nothingLeft = !p.next && !p.upcoming.size;
  if (nothingLeft && node.id === ROADMAP_NEXT) return 'próxima';
  return 'bloqueada';
}

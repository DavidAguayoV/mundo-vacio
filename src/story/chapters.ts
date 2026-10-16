import { ReferenceFrame } from '../world/frame';
import { G_EARTH } from '../world/world';
import type { Chapter, StoryContext } from './types';

// ---------- preparación del mundo al retomar un capítulo ----------

function ensureFrame({ world }: StoryContext): void {
  if (!world.frame) world.frame = new ReferenceFrame({ x: 0, y: 0 }, 0);
}

function ensureParticles({ world }: StoryContext): void {
  if (world.particles.length) return;
  world.addParticle({ x: -3, y: 1.5 }, 1);
  world.addParticle({ x: -1.5, y: 3 }, 4);
}

function ensureVectors({ world }: StoryContext): void {
  if (world.vectors.length >= 2) return;
  // abajo a la derecha, lejos de las partículas sembradas
  if (world.vectors.length === 0) world.addVector({ x: 1.5, y: -2.5 }, { x: 4, y: -1.2 });
  world.addVector({ x: 5.5, y: 0.5 }, { x: 6.5, y: -1.5 });
}

function ensureSum(ctx: StoryContext): void {
  ensureVectors(ctx);
  const { world } = ctx;
  if (!world.sums.length) world.addSum(world.vectors[0].id, world.vectors[1].id);
}

function ensureG({ world }: StoryContext): void {
  if (!world.g) world.g = { x: 0, y: -G_EARTH };
}

/**
 * Pone un blanco alcanzable: a unos 4,5 m de la primera partícula, perpendicular a g
 * y un poco "abajo", dentro de la pantalla.
 */
export function spawnTarget(ctx: StoryContext): void {
  const { world, view } = ctx;
  ensureParticles(ctx);
  const p = world.particles[0];
  const g = world.g ?? { x: 0, y: -G_EARTH };
  const gL = Math.hypot(g.x, g.y) || 1;
  const down = { x: g.x / gL, y: g.y / gL };
  const side = { x: -down.y, y: down.x };
  const b = view.bounds(-view.S);
  const inside = (q: { x: number; y: number }) => q.x > b.minX && q.x < b.maxX && q.y > b.minY + 1 && q.y < b.maxY - 1;
  let t = { x: p.pos.x + 4.5 * side.x + 1.5 * down.x, y: p.pos.y + 4.5 * side.y + 1.5 * down.y };
  if (!inside(t)) t = { x: p.pos.x - 4.5 * side.x + 1.5 * down.x, y: p.pos.y - 4.5 * side.y + 1.5 * down.y };
  t = {
    x: Math.max(b.minX, Math.min(b.maxX, t.x)),
    y: Math.max(b.minY + 1, Math.min(b.maxY - 1, t.y)),
  };
  world.targets = [{ id: world.newId('t'), pos: t, radius: 0.45 }];
}

// ---------- capítulos ----------

export const CHAPTERS: Chapter[] = [
  {
    id: 'vacio',
    title: 'El vacío',
    unlocks: ['origin'],
    steps: [
      {
        text: 'Esto es un espacio vacío. Sin un punto de referencia no existe un «aquí» ni un «allá». Toca en cualquier lugar para fijar un origen.',
        on: 'origin-placed',
      },
      {
        text: 'Ya tienes un sistema de referencia: un origen y dos ejes. Arrastra el círculo en la punta del eje x para girarlos. Nadie dijo que x tenga que apuntar a la derecha.',
        on: 'frame-rotated',
      },
    ],
  },
  {
    id: 'particula',
    title: 'Una partícula',
    unlocks: ['particle', 'move'],
    seed: ensureFrame,
    steps: [
      {
        text: 'Lo más simple que puede existir es una partícula: un punto con masa y nada más. Elige Partícula y coloca una.',
        on: 'particle-placed',
      },
      {
        text: 'La flecha punteada que sale del origen es su vector posición r. Coloca una segunda partícula.',
        on: 'particle-placed',
        when: ({ world }) => world.particles.length >= 2,
      },
      {
        text: 'Elige Mover y arrastra el origen a otro lugar. Las partículas siguen donde estaban, pero sus vectores r cambiaron. La posición depende de quién mide.',
        on: 'origin-moved',
      },
    ],
  },
  {
    id: 'vectores',
    title: 'Vectores',
    unlocks: ['vector', 'sum'],
    seed: (ctx) => {
      ensureFrame(ctx);
      ensureParticles(ctx);
    },
    steps: [
      {
        text: 'Un vector es una flecha con magnitud y dirección; puedes trasladarlo sin cambiarlo. Elige Vector y arrastra para dibujar uno.',
        on: 'vector-drawn',
      },
      {
        text: 'El panel muestra sus componentes en tus ejes, su magnitud y su ángulo; las líneas punteadas son esas componentes. Dibuja un segundo vector.',
        on: 'vector-drawn',
        when: ({ world }) => world.vectors.length >= 2,
      },
      {
        text: 'Elige Sumar y toca un vector y después otro. El segundo se traslada a la punta del primero: cola con punta.',
        on: 'sum-done',
        enter: ensureVectors,
      },
      {
        text: 'Gira ahora los ejes desde el círculo en la punta del eje x. La flecha suma no cambia; sus componentes sí. El vector existe antes que las coordenadas que usas para describirlo.',
        on: 'frame-rotated',
        enter: ensureSum,
      },
    ],
  },
  {
    id: 'abajo',
    title: '¿Dónde es abajo?',
    unlocks: ['gravity'],
    sim: true,
    seed: (ctx) => {
      ensureFrame(ctx);
      ensureParticles(ctx);
    },
    steps: [
      {
        text: 'Hasta aquí nada se mueve: falta una interacción. ¿Dónde es abajo? Elige Gravedad y arrastra en la dirección en que crees que caen las cosas.',
        on: 'g-set',
      },
      {
        text: 'Abajo es la dirección de g, no el borde de tu pantalla. Presiona Lanzar y observa. Los puntos marcan la posición cada 0,1 s.',
        on: 'fell',
        enter: ensureG,
      },
      {
        text: 'Toca una partícula con Mover, cambia su masa con + o −, reinicia y lanza otra vez. ¿Cae distinto?',
        on: 'fell',
        when: (ctx) => ctx.seen('mass-changed'),
        enter: ensureG,
      },
      {
        text: 'Caen igual. En un campo gravitacional uniforme todas las partículas tienen la misma aceleración g, sin importar su masa. Galileo lo notó antes que Newton.',
        on: 'next',
      },
    ],
  },
  {
    id: 'velocidad',
    title: 'Velocidad',
    unlocks: ['velocity'],
    sim: true,
    seed: (ctx) => {
      ensureFrame(ctx);
      ensureParticles(ctx);
      ensureG(ctx);
    },
    steps: [
      {
        text: 'Una partícula también puede partir moviéndose. Elige Velocidad y arrastra desde una partícula: la flecha cian es su velocidad inicial v₀.',
        on: 'v-set',
      },
      {
        text: 'Apareció un blanco. Dale a una partícula la velocidad justa para que pase por él. Mientras vuela, mira que la flecha de v cambia y la de g no.',
        on: 'target-hit',
        enter: (ctx) => {
          if (!ctx.world.targets.length) spawnTarget(ctx);
        },
      },
      {
        text: 'Resolviste un problema de proyectiles sin escribir una ecuación. Cada punto salió de integrar a = g paso a paso con Runge-Kutta de orden 4. Lo que sigue: superficies, normal y roce.',
        on: 'end',
      },
    ],
  },
];

/** Mundo inicial del modo libre. */
export function seedFree(ctx: StoryContext): void {
  ensureFrame(ctx);
  ensureParticles(ctx);
  ensureG(ctx);
}

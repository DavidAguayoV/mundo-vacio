import { ReferenceFrame } from '../world/frame';
import { G_EARTH } from '../world/world';
import type { Chapter, Step, StoryContext } from './types';

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

/** Un suelo bajo las partículas sembradas. */
function ensureSurface({ world }: StoryContext): void {
  if (!world.surfaces.length) world.addSurface({ x: -5, y: -1 }, { x: 5, y: -1 });
}

function ensureG({ world }: StoryContext): void {
  if (!world.g) world.g = { x: 0, y: -G_EARTH };
}

/** Todas las partículas en reposo y sin lanzamiento pendiente. */
function stopAll({ world, sim }: StoryContext): void {
  sim.reset();
  for (const p of world.particles) p.vel = { x: 0, y: 0 };
}

/** Dos partículas a la misma altura, de 1 kg y 4 kg, en reposo. */
function twoMasses(ctx: StoryContext): void {
  const { world } = ctx;
  stopAll(ctx);
  while (world.particles.length < 2) world.addParticle({ x: 0, y: 0 }, 1);
  const [a, b] = world.particles;
  a.pos = { x: -2, y: 3 };
  a.mass = 1;
  b.pos = { x: 2, y: 3 };
  b.mass = 4;
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

// ---------- ayudas para escribir los pasos ----------

/** Tarjeta que retoma una predicción: texto común y una línea según lo que eligió el jugador. */
const reveal = (key: string, base: string, byChoice: Record<string, string>): Step['text'] => (ctx) => {
  const extra = byChoice[ctx.prediction(key) ?? ''];
  return extra ? `${base} ${extra}` : base;
};

const engineering = (text: string): Step => ({ text, on: 'next', kind: 'engineering' });

const I = 'I · Dónde';
const II = 'II · Cuándo';
const III = 'III · Por qué';

// ---------- capítulos ----------

export const CHAPTERS: Chapter[] = [
  // ===== Acto I · Dónde =====
  {
    id: 'vacio',
    act: I,
    title: 'El vacío',
    grants: ['tool:origin'],
    steps: [
      {
        text: 'Esto es un espacio vacío. Sin un punto de referencia no hay un «aquí» ni un «allá»: nada tiene posición. Toca en cualquier lugar para fijar un **origen**.',
        on: 'origin-placed',
      },
      {
        text: 'Ahora tienes un **sistema de referencia**: un origen y dos ejes perpendiculares. ¿Tiene que apuntar x a la derecha? Arrastra el círculo en la punta del eje x y gíralos.',
        on: 'frame-rotated',
      },
      {
        text: 'Nadie dijo que x apunte a la derecha. Los ejes son una elección tuya, no una propiedad del espacio, y elegirlos bien hace que un problema sea fácil o difícil.',
        on: 'next',
      },
      engineering('Un topógrafo empieza cada obra igual: fija un punto de referencia y unos ejes. Sin eso, un plano no dice dónde va nada.'),
    ],
  },
  {
    id: 'particula',
    act: I,
    title: 'Una partícula',
    grants: ['tool:particle', 'tool:move'],
    seed: ensureFrame,
    steps: [
      {
        text: '¿Qué es lo más simple que puede existir? Un punto con masa y nada más: una **partícula**. Elige Partícula y coloca una.',
        on: 'particle-placed',
      },
      {
        text: 'La flecha punteada que va del origen a la partícula es su **vector posición** r; el panel muestra sus componentes en tus ejes. Coloca una segunda partícula.',
        on: 'particle-placed',
        when: ({ world }) => world.particles.length >= 2,
      },
      {
        text: 'Una pregunta antes de seguir: si mueves el origen a otro lugar, ¿qué cambia?',
        on: 'end',
        ask: 'origen',
        choices: [
          { id: 'particulas', label: 'Las partículas se mueven' },
          { id: 'r', label: 'Cambian los vectores r' },
          { id: 'nada', label: 'No cambia nada' },
        ],
      },
      {
        text: 'Compruébalo: elige Mover y arrastra el origen a otro lugar.',
        on: 'origin-moved',
      },
      {
        text: reveal('origen', 'Las partículas no se movieron, pero sus vectores r cambiaron. La posición no es una propiedad de la partícula: depende de quién mide y desde dónde.', {
          particulas: 'Es fácil pensarlo, porque en la pantalla parece que todo se desplaza; pero las partículas siguen exactamente donde estaban.',
          r: 'Lo predijiste bien.',
          nada: 'Las partículas no cambian, es cierto; lo que cambia son los números con que las describes.',
        }),
        on: 'next',
      },
      engineering('Para planificar la ruta de un camión, el camión es un punto. Elegir el modelo más simple que sirve es la primera decisión de ingeniería.'),
    ],
  },
  {
    id: 'vectores',
    act: I,
    title: 'Vectores',
    grants: ['tool:vector', 'tool:sum'],
    seed: (ctx) => {
      ensureFrame(ctx);
      ensureParticles(ctx);
    },
    steps: [
      {
        text: 'Un **vector** es una flecha: tiene magnitud y dirección, y puedes trasladarlo sin cambiarlo. Elige Vector y arrastra para dibujar uno.',
        on: 'vector-drawn',
      },
      {
        text: 'El panel muestra sus **componentes** en tus ejes (las líneas punteadas), su magnitud y su ángulo. Dibuja un segundo vector.',
        on: 'vector-drawn',
        when: ({ world }) => world.vectors.length >= 2,
      },
      {
        text: 'Elige Sumar y toca un vector y después el otro. El segundo se traslada a la punta del primero: cola con punta.',
        on: 'sum-done',
        enter: ensureVectors,
      },
      {
        text: 'Si ahora giras los ejes, ¿qué le pasa a la flecha suma?',
        on: 'end',
        ask: 'giro',
        enter: ensureSum,
        choices: [
          { id: 'gira', label: 'Gira con los ejes' },
          { id: 'componentes', label: 'No cambia; cambian sus componentes' },
          { id: 'magnitud', label: 'Cambia su magnitud' },
        ],
      },
      {
        text: 'Gira los ejes desde el círculo en la punta del eje x y mira el panel.',
        on: 'frame-rotated',
        enter: ensureSum,
      },
      {
        text: reveal('giro', 'La flecha no se movió y su magnitud tampoco; sus componentes sí. El vector existe antes que las coordenadas con que lo describes.', {
          gira: 'Los ejes giraron, pero la flecha es la misma: lo que gira es tu forma de describirla.',
          componentes: 'Lo predijiste bien.',
          magnitud: 'Fíjate en |A+B| en el panel: no cambió. La magnitud no depende de los ejes.',
        }),
        on: 'next',
      },
      engineering('Un avión con viento cruzado: su velocidad respecto al suelo es la suma de dos vectores, y el piloto apunta la nariz para que esa suma vaya hacia la pista.'),
    ],
  },

  // ===== Acto II · Cuándo =====
  {
    id: 'tiempo',
    act: II,
    title: 'El tiempo',
    seed: (ctx) => {
      ensureFrame(ctx);
      ensureParticles(ctx);
      // todavía no hay gravedad: lo que se mueve, sigue
      ctx.world.g = null;
      ctx.world.targets = [];
    },
    steps: [
      {
        text: 'Mira lo que armaste: un origen, partículas, flechas. Nada cambia. ¿Pasa el tiempo aquí? No hay forma de saberlo: el tiempo solo se nota cuando algo cambia.',
        on: 'next',
        button: 'Desbloquear el tiempo',
      },
      {
        text: 'Ahora tienes el **tiempo**. Toca Tiempo en la barra para que fluya: el reloj t avanza… y todo sigue igual. Detenlo cuando quieras.',
        on: 'time-paused',
        grants: ['time:flow'],
      },
      {
        text: 'Elige Velocidad y arrastra desde una partícula. La flecha cian es su **velocidad**.',
        on: 'v-set',
        grants: ['tool:velocity'],
        enter: stopAll,
      },
      {
        text: 'Antes de dejar fluir el tiempo: ¿qué hará esa partícula?',
        on: 'end',
        ask: 'inercia',
        choices: [
          { id: 'frena', label: 'Se frena hasta detenerse' },
          { id: 'recto', label: 'Sigue recto, igual de rápido' },
          { id: 'curva', label: 'Se curva' },
        ],
      },
      {
        text: 'Deja fluir el tiempo y mira las marcas: cada punto es su posición cada 0,1 s.',
        on: 'coasted',
      },
      {
        text: reveal('inercia', 'Sigue recto, y las marcas quedan igual de separadas: recorre lo mismo cada 0,1 s. Eso es su **velocidad**, v = Δr/Δt. Nada la frena porque nada la toca: es la **inercia**.', {
          frena: 'Dijiste que se frenaba. Es la intuición más común: en la vida diaria todo se frena por el roce. Aquí no hay roce… todavía.',
          recto: 'Lo predijiste bien: es la primera ley de Newton.',
          curva: 'Dijiste que se curvaba. Para curvarse, algo tendría que empujarla de lado, y aquí no hay nada.',
        }),
        on: 'next',
      },
      {
        text: 'Toca t = 0 para volver al inicio y luego +0,1 s para avanzar paso a paso: cada toque es una marca nueva. Mira en el panel cuánto cambia r en cada paso.',
        on: 'time-step',
        when: (ctx) => ctx.count('time-step') >= 3,
        grants: ['time:rewind', 'time:step'],
      },
      engineering('Algunos países controlan la velocidad por tramo: dos cámaras registran tu auto y se divide la distancia por el tiempo. Lo que miden es tu velocidad media en ese tramo.'),
    ],
  },
  {
    id: 'abajo',
    act: II,
    title: '¿Dónde es abajo?',
    grants: ['tool:gravity'],
    seed: (ctx) => {
      ensureFrame(ctx);
      ensureParticles(ctx);
      stopAll(ctx);
      ctx.world.targets = [];
    },
    steps: [
      {
        text: 'Lo que se mueve en el vacío sigue recto para siempre. Pero lo que sueltas en la vida real cae. ¿Dónde es abajo? Elige Gravedad y arrastra en la dirección en que crees que caen las cosas.',
        on: 'g-set',
      },
      {
        text: '**Abajo** es la dirección de g, no el borde de tu pantalla. Aquí hay dos partículas a la misma altura: una de 1 kg y otra de 4 kg. Si dejas fluir el tiempo, ¿cuál cae más rápido?',
        on: 'end',
        ask: 'caida',
        enter: (ctx) => {
          ensureG(ctx);
          twoMasses(ctx);
        },
        choices: [
          { id: 'pesada', label: 'La de 4 kg' },
          { id: 'liviana', label: 'La de 1 kg' },
          { id: 'juntas', label: 'Caen juntas' },
        ],
      },
      {
        text: 'Deja fluir el tiempo.',
        on: 'fell',
        enter: ensureG,
      },
      {
        text: reveal('caida', 'Caen juntas. En un campo gravitacional uniforme todas las partículas tienen la misma **aceleración**, g, sin importar su masa. Galileo lo notó antes que Newton.', {
          pesada: 'Dijiste que la de 4 kg. Es lo que dice la intuición, y lo que enseñaba Aristóteles; Galileo mostró que no.',
          liviana: 'Dijiste que la de 1 kg. La masa no cambia cómo caen: las dos llegan al mismo tiempo.',
          juntas: 'Lo predijiste bien.',
        }),
        on: 'next',
        enter: ensureG,
      },
      {
        text: 'Mira las marcas: ya no quedan igual de separadas, porque la velocidad cambia. Ganaste la **cámara lenta**: vuelve a t = 0, elige ×½ o ×¼ y deja fluir el tiempo otra vez.',
        on: 'fell',
        when: (ctx) => ctx.seen('slow-set'),
        grants: ['time:slow'],
        enter: ensureG,
      },
      {
        text: 'En cada 0,1 s recorre más que en el anterior: la velocidad crece lo mismo cada segundo, 9,80 m/s más. Eso mide la **aceleración**: cuánto cambia la velocidad por unidad de tiempo.',
        on: 'next',
        enter: ensureG,
      },
      engineering('En una prueba de caída de un celular, la altura fija la velocidad del impacto; la masa no cambia cuánto tarda en llegar al suelo.'),
    ],
  },
  {
    id: 'blanco',
    act: II,
    title: 'Al blanco',
    seed: (ctx) => {
      ensureFrame(ctx);
      ensureParticles(ctx);
      ensureG(ctx);
      stopAll(ctx);
    },
    steps: [
      {
        text: 'Ahora junta lo que tienes: una velocidad inicial y la gravedad. Apareció un blanco. Dale a una partícula la velocidad justa con Velocidad y deja fluir el tiempo.',
        on: 'target-hit',
        enter: (ctx) => {
          ensureG(ctx);
          if (!ctx.world.targets.length) spawnTarget(ctx);
        },
      },
      {
        text: '¡Le diste! Ganaste la **línea de tiempo**: arrástrala para recorrer el vuelo hacia adelante y hacia atrás. Busca el punto más alto de la trayectoria.',
        on: 'peak-found',
        grants: ['time:timeline'],
        enter: ensureG,
      },
      {
        text: 'Estás en el punto más alto. ¿Cuánto vale ahí la velocidad?',
        on: 'end',
        ask: 'cima',
        choices: [
          { id: 'cero', label: 'Cero: se detiene un instante' },
          { id: 'horizontal', label: 'No es cero: solo deja de subir' },
        ],
      },
      {
        text: reveal('cima', 'Mira la flecha cian: en el punto más alto queda perpendicular a g. La velocidad no es cero; lo que se anula es su parte a lo largo de g. La otra parte no cambió en todo el vuelo, porque nada empuja de lado.', {
          cero: 'Dijiste que se detenía. Si se detuviera, caería recto desde ahí; en cambio sigue avanzando.',
          horizontal: 'Lo predijiste bien.',
        }),
        on: 'next',
      },
      engineering('Un chorro de agua de bomberos o un aspersor: el ángulo con que sale el agua decide hasta dónde llega.'),
    ],
  },

  // ===== Acto III · Por qué =====
  {
    id: 'superficies',
    act: III,
    title: 'Superficies',
    grants: ['tool:surface'],
    seed: (ctx) => {
      ensureFrame(ctx);
      ensureParticles(ctx);
      ensureG(ctx);
      stopAll(ctx);
      ctx.world.targets = [];
    },
    steps: [
      {
        text: 'Hasta ahora nada detenía una caída. Elige Superficie y arrastra para dibujar un suelo bajo las partículas.',
        on: 'surface-drawn',
      },
      {
        text: 'Cuando la partícula llegue al suelo, ¿por qué no lo atraviesa?',
        on: 'end',
        ask: 'suelo',
        enter: ensureSurface,
        choices: [
          { id: 'apaga', label: 'La gravedad deja de actuar' },
          { id: 'empuja', label: 'El suelo la empuja hacia arriba' },
          { id: 'sinv', label: 'Ya no tiene velocidad' },
        ],
      },
      {
        text: 'Deja fluir el tiempo.',
        on: 'landed',
        enter: ensureSurface,
      },
      {
        text: reveal('suelo', 'La gravedad no se apagó: la flecha mg sigue ahí. El suelo la empuja con una fuerza perpendicular a él, la **normal** N, justo la necesaria para que no lo atraviese. Las flechas ámbar son las fuerzas sobre la partícula; la rosa, su aceleración.', {
          apaga: 'Dijiste que la gravedad dejaba de actuar. La Tierra no sabe que hay un suelo: lo que cambia es que ahora hay otra fuerza.',
          empuja: 'Lo predijiste bien.',
          sinv: 'No tener velocidad no basta: algo tiene que anular la gravedad, o volvería a acelerar hacia abajo.',
        }),
        on: 'next',
        enter: ensureSurface,
      },
      {
        text: 'Con Mover, arrastra un extremo de la superficie para inclinarla un poco y deja fluir el tiempo. ¿Se queda quieta en la pendiente?',
        on: 'held',
        enter: ensureSurface,
      },
      {
        text: 'Se queda: algo la sostiene a lo largo de la superficie. Es el **roce estático** f. Ahora inclínala más, hasta que deslice.',
        on: 'slid',
        enter: ensureSurface,
      },
      {
        text: 'El roce estático tiene un máximo, μₛN. Cuando la componente del peso a lo largo de la superficie lo supera, la partícula desliza y el roce pasa a ser **cinético**: f = μc N, opuesto al deslizamiento. Toca la superficie para ver μₛ, μc y su inclinación α: empieza a deslizar cuando tan α supera μₛ.',
        on: 'next',
        enter: ensureSurface,
      },
      engineering('El ángulo en que una pila de arena o de áridos deja de sostenerse depende del roce entre los granos: con eso se diseñan taludes y acopios.'),
      {
        text: 'Ya tienes las fuerzas de contacto. Fíjate en que a, la flecha rosa, es la suma de las fuerzas dividida por m: es la segunda ley de Newton. Lo que sigue: resortes, gravitación entre masas y arrastre.',
        on: 'end',
        enter: ensureSurface,
      },
    ],
  },
];

/** Mundo inicial del modo libre. */
export function seedFree(ctx: StoryContext): void {
  ensureFrame(ctx);
  ensureParticles(ctx);
  ensureG(ctx);
  ensureSurface(ctx);
}

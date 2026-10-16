import { G_GAME } from '../physics/forces/gravitation';
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

/** Un resorte colgando de un punto fijo, con la primera partícula en reposo en su extremo. */
function ensureSpring(ctx: StoryContext): void {
  const { world } = ctx;
  ensureParticles(ctx);
  if (world.springs.length) return;
  const p = world.particles[0];
  p.vel = { x: 0, y: 0 };
  world.addSpring({ anchor: { x: p.pos.x, y: p.pos.y + 2 } }, { particle: p.id }, 20, 2);
}

/** Dos cuerpos en el espacio: uno de 64 kg en el centro y otro de 1 kg a 3 m, en reposo. */
function twoBodies(ctx: StoryContext): void {
  const { world } = ctx;
  stopAll(ctx);
  ensureParticles(ctx);
  while (world.particles.length < 2) world.addParticle({ x: 0, y: 0 }, 1);
  world.particles = world.particles.slice(0, 2);
  const [big, small] = world.particles;
  big.pos = { x: 0, y: 0 };
  big.mass = 64;
  small.pos = { x: 0, y: 3 };
  small.mass = 1;
}

function ensureGravitation({ world }: StoryContext): void {
  if (!world.gravitation) world.gravitation = { G: G_GAME };
}

function ensureAir(ctx: StoryContext): void {
  ensureG(ctx);
  if (!ctx.world.medium) ctx.world.medium = 'aire';
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
function twoMasses(ctx: StoryContext, height = 3): void {
  const { world } = ctx;
  stopAll(ctx);
  while (world.particles.length < 2) world.addParticle({ x: 0, y: 0 }, 1);
  const [a, b] = world.particles;
  a.pos = { x: -2, y: height };
  a.mass = 1;
  b.pos = { x: 2, y: height };
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
        text: 'Ya tienes las fuerzas de contacto. Fíjate en que a, la flecha rosa, es la suma de las fuerzas dividida por m: es la **segunda ley de Newton**. Ahora, una fuerza que depende de dónde está la partícula.',
        on: 'next',
        enter: ensureSurface,
      },
    ],
  },
  {
    id: 'resortes',
    act: III,
    title: 'Resortes',
    grants: ['tool:spring'],
    seed: (ctx) => {
      ensureFrame(ctx);
      ensureParticles(ctx);
      ensureG(ctx);
      stopAll(ctx);
      // sin suelo: que nada estorbe la oscilación
      ctx.world.surfaces = [];
      ctx.world.targets = [];
    },
    steps: [
      {
        text: 'Un resorte hace algo que ninguna fuerza anterior hacía: tira o empuja según cuánto lo deformes. Quitamos el suelo para que nada estorbe. Elige Resorte y arrastra desde un punto vacío, que quedará fijo, hasta una partícula.',
        on: 'spring-made',
      },
      {
        text: 'Antes de estirarlo: si lo estiras el doble, ¿con cuánta fuerza tira?',
        on: 'end',
        ask: 'hooke',
        enter: ensureSpring,
        choices: [
          { id: 'doble', label: 'El doble' },
          { id: 'mas', label: 'Más del doble' },
          { id: 'igual', label: 'La misma' },
        ],
      },
      {
        text: 'Compruébalo con el tiempo detenido: con Mover, arrastra la partícula para estirar el resorte y toca el resorte para ver ΔL y |F| en el panel. Estíralo un poco, y después el doble.',
        on: 'spring-stretched',
        when: (ctx) => ctx.count('spring-stretched') >= 2,
        enter: ensureSpring,
      },
      {
        text: reveal('hooke', '|F| = k ΔL: el doble de estiramiento, el doble de fuerza. Es la **ley de Hooke**, y k, la **constante del resorte**, dice qué tan duro es. La fuerza apunta siempre hacia donde el resorte recupera su largo natural L₀.', {
          doble: 'Lo predijiste bien.',
          mas: 'Dijiste que más del doble. Un resorte real estirado en exceso puede hacerlo, pero el resorte ideal es proporcional: exactamente el doble.',
          igual: 'Dijiste que la misma. Mira el panel: |F| crece con ΔL.',
        }),
        on: 'next',
        enter: ensureSpring,
      },
      {
        text: 'Deja fluir el tiempo y mira el panel del resorte.',
        on: 'oscillated',
        enter: ensureSpring,
      },
      {
        text: 'La partícula **oscila**: el resorte la tira hacia el equilibrio, ella se pasa de largo por inercia, y vuelve. El panel mide cuánto tarda una ida y vuelta: el **período** T.',
        on: 'next',
        enter: ensureSpring,
      },
      {
        text: 'Si la estiras el doble antes de soltarla, ¿cuánto tarda una oscilación?',
        on: 'end',
        ask: 'amplitud',
        enter: ensureSpring,
        choices: [
          { id: 'doble', label: 'El doble de tiempo' },
          { id: 'mismo', label: 'Lo mismo' },
          { id: 'mitad', label: 'La mitad' },
        ],
      },
      {
        text: 'Compruébalo: vuelve a t = 0, arrastra la partícula para estirar más el resorte y deja fluir el tiempo. Compara T.',
        on: 'oscillated',
        when: (ctx) => ctx.seen('spring-stretched'),
        enter: ensureSpring,
      },
      {
        text: reveal('amplitud', 'Tarda lo mismo: el período no depende de cuánto la estires. Recorre más camino, pero también va más rápido. Por eso un resorte, o un péndulo, sirve para medir el tiempo.', {
          doble: 'Dijiste el doble: recorre el doble de camino, pero el resorte también tira el doble, y las dos cosas se compensan.',
          mismo: 'Lo predijiste bien.',
          mitad: 'Dijiste la mitad. Tira más fuerte, sí, pero también tiene más camino que recorrer.',
        }),
        on: 'next',
        enter: ensureSpring,
      },
      {
        text: '¿Y si la partícula tiene cuatro veces más masa?',
        on: 'end',
        ask: 'masa',
        enter: ensureSpring,
        choices: [
          { id: 'rapido', label: 'Oscila más rápido' },
          { id: 'igual', label: 'Igual' },
          { id: 'lento', label: 'Oscila más lento' },
        ],
      },
      {
        text: 'Compruébalo: vuelve a t = 0, toca la partícula del resorte y duplica su masa dos veces con +. Deja fluir el tiempo.',
        on: 'oscillated',
        when: (ctx) => ctx.seen('mass-changed'),
        enter: ensureSpring,
      },
      {
        text: reveal('masa', 'Más lento: con cuatro veces la masa, el período se duplica, T = 2π√(m/k). Con la misma fuerza, una masa mayor acelera menos.', {
          rapido: 'Dijiste más rápido. Con el mismo resorte, una masa mayor acelera menos, así que va más lento.',
          igual: 'Dijiste igual. Eso vale para la caída libre del capítulo 5, donde la fuerza crece con la masa; la del resorte, no.',
          lento: 'Lo predijiste bien.',
        }),
        on: 'next',
        enter: ensureSpring,
      },
      engineering('La suspensión de un auto es un resorte: su período decide si el viaje se siente firme o blando.'),
      {
        text: 'Ya tienes una fuerza que depende de la posición, y con ella, el movimiento que se repite. Ahora, una fuerza que actúa a distancia, sin resorte ni contacto.',
        on: 'next',
        enter: ensureSpring,
      },
    ],
  },
  {
    id: 'gravitacion',
    act: III,
    title: 'Gravitación',
    grants: ['force:gravitation'],
    seed: (ctx) => {
      ensureFrame(ctx);
      // lejos de la Tierra: sin campo uniforme, sin suelo ni resortes
      ctx.world.g = null;
      ctx.world.surfaces = [];
      ctx.world.springs = [];
      ctx.world.targets = [];
      ctx.world.gravitation = null;
      twoBodies(ctx);
    },
    steps: [
      {
        text: 'Lejos de la Tierra no hay un «abajo»: aquí apagamos g. Quedan dos partículas, una de 64 kg y otra de 1 kg. Newton se preguntó si lo que hace caer una manzana es lo mismo que mantiene a la Luna dando vueltas. Enciende la **Atracción** entre masas en la barra.',
        on: 'gravitation-on',
      },
      {
        text: 'Las dos están en reposo. Si dejas fluir el tiempo, ¿qué pasa?',
        on: 'end',
        ask: 'atraccion',
        enter: ensureGravitation,
        choices: [
          { id: 'nada', label: 'Nada, porque no hay g' },
          { id: 'cae', label: 'La de 1 kg cae hacia la de 64 kg' },
          { id: 'juntas', label: 'Las dos se acercan' },
        ],
      },
      {
        text: 'Deja fluir el tiempo.',
        on: 'fell',
        enter: ensureGravitation,
      },
      {
        text: reveal('atraccion', 'Se acercan las dos, aunque la de 64 kg se mueve muy poco. Cada masa atrae a la otra, **F = G m₁ m₂ / r²**, con fuerzas iguales y opuestas (tercera ley): compara |Fg| en el panel de cada una. La de 64 kg acelera 64 veces menos. Aquí G vale 0,5 N·m²/kg²; la real es 6,67·10⁻¹¹, y con masas de kilogramos no notarías nada.', {
          nada: 'Dijiste que nada. No hay g, pero toda masa atrae a toda masa.',
          cae: 'Dijiste que caía la de 1 kg. Cae, sí, pero la de 64 kg también se mueve hacia ella, solo que muy poco.',
          juntas: 'Lo predijiste bien.',
        }),
        on: 'next',
        enter: ensureGravitation,
      },
      {
        text: 'Vuelve a t = 0. Con Velocidad, dale a la de 1 kg una velocidad de lado, perpendicular a la línea que las une. ¿Logras que dé una vuelta completa sin chocar ni escaparse?',
        on: 'orbited',
        enter: ensureGravitation,
      },
      {
        text: 'Está **en órbita**: cae todo el tiempo hacia la de 64 kg, pero avanza tan rápido de lado que nunca llega. La manzana y la Luna caen por la misma razón; la diferencia es que la Luna también va de lado.',
        on: 'next',
        enter: ensureGravitation,
      },
      {
        text: '¿Qué pasa si le das mucha más velocidad?',
        on: 'end',
        ask: 'escape',
        enter: ensureGravitation,
        choices: [
          { id: 'grande', label: 'Da una vuelta más grande' },
          { id: 'escapa', label: 'Se escapa y no vuelve' },
          { id: 'rapido', label: 'Gira más rápido en la misma órbita' },
        ],
      },
      {
        text: 'Pruébalo: vuelve a t = 0 y dale bastante más velocidad.',
        on: 'escaped',
        enter: ensureGravitation,
      },
      {
        text: reveal('escape', 'Con suficiente velocidad se escapa: es la **velocidad de escape**, √2 veces la de una órbita circular. Entre la órbita circular y el escape hay órbitas alargadas, **elipses**: prueba velocidades intermedias.', {
          grande: 'Dijiste una vuelta más grande. Con un poco más de velocidad, sí: una elipse. Con mucha más, se escapa.',
          escapa: 'Lo predijiste bien.',
          rapido: 'Dijiste que giraba más rápido en la misma órbita. Para eso haría falta más fuerza hacia el centro; con la misma, la órbita se abre.',
        }),
        on: 'next',
        enter: ensureGravitation,
      },
      engineering('Un satélite de GPS está cayendo todo el tiempo; su velocidad hace que «falle» el suelo.'),
      {
        text: 'Ya tienes la gravitación: la misma ley para una manzana, la Luna y un satélite. Ahora, de vuelta en la Tierra, falta algo que siempre estuvo ahí: el aire.',
        on: 'next',
        enter: ensureGravitation,
      },
    ],
  },
  {
    id: 'arrastre',
    act: III,
    title: 'Arrastre',
    grants: ['force:drag'],
    seed: (ctx) => {
      ensureFrame(ctx);
      // de vuelta en la Tierra, sin suelo para ver la caída completa
      ctx.world.g = null;
      ensureG(ctx);
      ctx.world.gravitation = null;
      ctx.world.surfaces = [];
      ctx.world.springs = [];
      ctx.world.targets = [];
      ctx.world.medium = null;
      twoMasses(ctx, 5);
    },
    steps: [
      {
        text: 'En el capítulo 5 todo caía igual, sin importar su masa. Pero una pluma y una piedra no caen igual. ¿Qué falta? El aire. Cambia el **Medio** en la barra a aire.',
        on: 'medium-set',
      },
      {
        text: 'Las mismas dos partículas, de 1 kg y 4 kg, ahora en aire. Si dejas fluir el tiempo, ¿cuál llega primero abajo?',
        on: 'end',
        ask: 'masa_aire',
        enter: ensureAir,
        choices: [
          { id: 'juntas', label: 'Caen juntas, como antes' },
          { id: 'pesada', label: 'La de 4 kg' },
          { id: 'liviana', label: 'La de 1 kg' },
        ],
      },
      {
        text: 'Deja fluir el tiempo.',
        on: 'fell',
        enter: ensureAir,
      },
      {
        text: reveal('masa_aire', 'Ahora gana la de 4 kg. El aire empuja contra el movimiento con una fuerza que crece con la rapidez, la **fuerza de arrastre** Fa. A la misma rapidez frena igual a las dos, pero a la de 4 kg le cuesta 4 veces más cambiar su velocidad. Aquí la masa sí importa.', {
          juntas: 'Dijiste que caían juntas: eso vale en el vacío, como en el capítulo 5. Con aire, no.',
          pesada: 'Lo predijiste bien.',
          liviana: 'Dijiste la de 1 kg. Es al revés: las dos sienten el mismo arrastre, pero la liviana tiene menos peso que lo compense.',
        }),
        on: 'next',
        enter: ensureAir,
      },
      {
        text: 'Vuelve a t = 0 y mira la flecha v de la de 1 kg mientras cae; usa la cámara lenta si quieres. ¿Sigue creciendo?',
        on: 'terminal',
        enter: ensureAir,
      },
      {
        text: 'Deja de crecer: llega a su **velocidad terminal**, cuando el arrastre iguala al peso. La fuerza total es cero (la flecha a desaparece) y sigue cayendo a velocidad constante: otra vez la inercia.',
        on: 'next',
        enter: ensureAir,
      },
      {
        text: 'Si cambias el medio a agua, ¿cómo será la velocidad terminal?',
        on: 'end',
        ask: 'agua',
        enter: ensureAir,
        choices: [
          { id: 'mayor', label: 'Mayor' },
          { id: 'menor', label: 'Menor' },
          { id: 'igual', label: 'Igual' },
        ],
      },
      {
        text: 'Cambia el Medio a agua, vuelve a t = 0 y deja fluir el tiempo.',
        on: 'terminal',
        when: (ctx) => ctx.world.medium === 'agua',
      },
      {
        text: reveal('agua', 'Menor: el agua arrastra mucho más, así que el arrastre iguala al peso a una rapidez menor. Ignoramos el empuje del agua, que en partículas muy densas es pequeño.', {
          mayor: 'Dijiste mayor. El agua frena más, no menos: el equilibrio llega antes, a menor rapidez.',
          menor: 'Lo predijiste bien.',
          igual: 'Dijiste igual. La velocidad terminal depende del medio: cuanto más arrastra, menor es.',
        }),
        on: 'next',
      },
      engineering('Un paracaídas no reduce la gravedad: aumenta el arrastre hasta que la velocidad terminal sea segura.'),
      {
        text: 'Ya tienes las fuerzas que mueven casi todo lo que ves: peso, contacto, resortes, gravitación y arrastre. En el modo libre puedes combinarlas todas.',
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
  ensureSurface(ctx);
}

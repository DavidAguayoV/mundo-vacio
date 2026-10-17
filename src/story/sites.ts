import { fmt, fmtVec } from '../core/format';
import { dist, len, rotate, type Vec2 } from '../core/vec';
import { IDENTITY_FRAME, ReferenceFrame } from '../world/frame';
import type { World } from '../world/world';
import { CHAPTERS, reveal } from './chapters';
import type { Grant, Mastery, Page, Site, Step, StoryContext, Zone, ZoneId } from './types';

// ---------- el mapa ----------

/** Zonas alrededor del claro, en un círculo: el mapa se lee de un vistazo. */
const ring = (deg: number, r = 24): { x: number; y: number } => ({
  x: Math.round(r * Math.cos((deg * Math.PI) / 180) * 10) / 10,
  y: Math.round(r * Math.sin((deg * Math.PI) / 180) * 10) / 10,
});

export const ZONES: Zone[] = [
  { id: 'claro', name: 'El claro', at: { x: 0, y: 0 }, hint: 'solo espacio' },
  { id: 'constelacion', name: 'La constelación', at: ring(20), hint: 'flechas que nadie usó' },
  { id: 'taller', name: 'El taller', at: ring(70), hint: 'cosas que oscilan' },
  { id: 'astro', name: 'El astro', at: ring(112), hint: 'algo muy masivo' },
  { id: 'mar', name: 'El mar', at: ring(160), hint: 'aire y agua' },
  { id: 'laderas', name: 'Las laderas', at: ring(202), hint: 'planos con roce' },
  { id: 'pozo', name: 'El pozo', at: ring(248), hint: 'aquí las cosas caen' },
  { id: 'central', name: 'La central', at: ring(292), hint: 'algo se conserva' },
  { id: 'deriva', name: 'La deriva', at: ring(332), hint: 'sin gravedad' },
];

const zoneAt = (z: ZoneId, dx: number, dy: number) => {
  const c = ZONES.find((x) => x.id === z)!.at;
  return { x: c.x + dx, y: c.y + dy };
};

// ---------- ayudas ----------

const frameAt = (w: World, origin: Vec2 = { x: 0, y: 0 }, angleDeg = 0) => {
  w.frame = new ReferenceFrame(origin, (angleDeg * Math.PI) / 180);
};

/** Una tarjeta de la sonda: se traslada y se invierte, pero no se estira. */
function card(w: World, label: string, tail: Vec2, d: Vec2): void {
  const v = w.addVector(tail, { x: tail.x + d.x, y: tail.y + d.y });
  v.label = label;
  v.fixed = true;
}

const userVec = (ctx: StoryContext, v: Vec2) => (ctx.world.frame ?? IDENTITY_FRAME).toUser(v);

/** La partícula del jugador: la primera que no está bloqueada. */
const mine = (w: World) => w.particles.find((p) => !p.locked);

const deg = (rad: number) => (rad * 180) / Math.PI;

// ---------- El claro y los capítulos que siguen siendo un rastro ----------

/** Convierte un capítulo del relato lineal en un rastro: su cierre de ingeniería pasa a la bitácora. */
function fromChapter(
  id: string,
  opts: { zone: ZoneId; at: { x: number; y: number }; note: string; needs?: Grant[]; law: string; measured?: Page['measured']; mastery?: Mastery[] },
): Site {
  const ch = CHAPTERS.find((c) => c.id === id);
  if (!ch) throw new Error(`Falta el capítulo ${id}`);
  const eng = ch.steps.find((s) => s.kind === 'engineering');
  return {
    id,
    zone: opts.zone,
    title: ch.title,
    at: opts.at,
    note: opts.note,
    needs: opts.needs,
    grants: ch.grants,
    seed: ch.seed,
    steps: ch.steps.filter((s) => s.kind !== 'engineering'),
    page: { law: opts.law, measured: opts.measured, engineering: typeof eng?.text === 'string' ? eng.text : '' },
    mastery: opts.mastery,
  };
}

// ---------- La constelación: vectores como instrucciones ----------

const dosSaltos: Site = {
  id: 'dos-saltos',
  zone: 'constelacion',
  title: 'Dos saltos',
  at: zoneAt('constelacion', -4.5, 0),
  note: 'Esta sonda no camina: salta. Le dejé dos instrucciones, A y B, pero nunca supe en qué orden dárselas.',
  needs: ['tool:move'],
  seed: ({ world }) => {
    frameAt(world, { x: -7.5, y: -4 });
    world.probe = { x: -5, y: -1 };
    world.beacons = [{ id: world.newId('b'), pos: { x: 2, y: 2 }, radius: 0.45 }];
    card(world, 'A', { x: -2.5, y: -2.8 }, { x: 4, y: -1 });
    card(world, 'B', { x: 4.5, y: -2.8 }, { x: 3, y: 4 });
  },
  steps: [
    {
      text: 'Cada flecha es una instrucción: cuánto saltar y hacia dónde. Elige Mover y arrastra la flecha A hasta que su cola quede sobre la sonda.',
      on: 'vector-snapped',
      when: ({ world }) => world.probeChain().vectors.length >= 1,
    },
    {
      text: 'La sonda saltaría hasta la punta de A. Ahora pon la cola de B en la punta de A: **cola con punta**.',
      on: 'probe-arrived',
    },
    {
      text: 'Llegó. Si las pones al revés, primero B y después A, ¿adónde llega la sonda?',
      on: 'end',
      ask: 'conmuta',
      correct: 'misma',
      choices: [
        { id: 'misma', label: 'A la misma baliza' },
        { id: 'otro', label: 'A otro lugar' },
        { id: 'largo', label: 'Depende de cuál flecha es más larga' },
      ],
    },
    {
      text: 'Pruébalo: separa las flechas y arma la cadena en el otro orden.',
      on: 'probe-arrived',
      when: ({ world }) => world.probeLog.includes('A,B') && world.probeLog.includes('B,A'),
    },
    {
      text: reveal('conmuta', 'Llega igual: A + B = B + A. Sumar vectores es ponerlos cola con punta, y el resultado no depende del orden. La flecha que va directo de la sonda a la baliza es la **suma**. Ganaste Vector y Sumar: ya puedes dibujar tus propias flechas.', {
        misma: 'Lo predijiste bien.',
        otro: 'Es fácil pensarlo, porque el camino cambia; pero el punto de llegada es el mismo.',
        largo: 'El largo no importa: cualquier orden llega al mismo punto.',
      }),
      on: 'next',
      grants: ['tool:vector', 'tool:sum'],
    },
  ],
  page: {
    law: 'Sumar vectores es ponerlos cola con punta, y A + B = B + A.',
    measured: (ctx) => `A + B = ${fmtVec(userVec(ctx, { x: 7, y: 3 }), 'm')}, medido en tus ejes.`,
    engineering: 'Un avión con viento cruzado: su velocidad respecto al suelo es la suma de dos vectores, y el piloto apunta la nariz para que esa suma vaya hacia la pista.',
  },
};

const atajo: Site = {
  id: 'atajo',
  zone: 'constelacion',
  title: 'El muro',
  at: zoneAt('constelacion', 0, 4.5),
  note: 'Puse un muro entre la sonda y la baliza. Con estas tres flechas se puede llegar igual, si se elige bien el orden.',
  needs: ['tool:sum'],
  seed: ({ world }) => {
    frameAt(world, { x: -7, y: -2.5 });
    world.probe = { x: -4, y: 0 };
    world.beacons = [{ id: world.newId('b'), pos: { x: 4, y: 1 }, radius: 0.45 }];
    world.addSurface({ x: 0, y: -2 }, { x: 0, y: 2.5 }, 0, 0).locked = true;
    card(world, 'A', { x: -6.5, y: -5 }, { x: 2, y: 4 });
    card(world, 'B', { x: -2.5, y: -4 }, { x: 4, y: -1 });
    card(world, 'C', { x: 3, y: -3 }, { x: 2, y: -2 });
  },
  steps: [
    {
      text: 'La línea gruesa es un muro: la sonda no lo puede atravesar. Arma una cadena con A, B y C que llegue a la baliza sin cruzarlo.',
      on: 'probe-arrived',
    },
    {
      text: 'Encontraste un camino. Si usaras las mismas tres flechas en otro orden y no hubiera muro, ¿dónde terminaría la cadena?',
      on: 'end',
      ask: 'orden',
      correct: 'misma',
      choices: [
        { id: 'misma', label: 'En la misma baliza' },
        { id: 'otro', label: 'En otro lugar' },
      ],
    },
    {
      text: reveal('orden', 'En la misma: A + B + C no depende del orden. Lo que cambia es el **camino**, y por eso solo algunos órdenes esquivan el muro.', {
        misma: 'Lo predijiste bien.',
        otro: 'Prueba otro orden y mira dónde queda la última punta: es el mismo punto.',
      }),
      on: 'next',
    },
  ],
  page: {
    law: 'A + B + C llega al mismo punto en cualquier orden; el orden solo cambia el camino.',
    engineering: 'Un brazo robótico llega al mismo punto con distintas combinaciones de giros: se elige la que no choca con nada.',
  },
  mastery: [
    {
      id: 'dos-caminos',
      label: 'Llega por arriba y por abajo del muro',
      on: 'probe-arrived',
      when: ({ world }) => world.probeLog.includes('A,B,C') && world.probeLog.includes('C,B,A'),
    },
  ],
};

const escalar: Site = {
  id: 'escalar',
  zone: 'constelacion',
  title: 'Tres veces A',
  at: zoneAt('constelacion', 4.5, 0),
  note: 'Me sobraron tres copias de A y una B. Con eso llegué, pero tuve que dar vuelta una flecha.',
  needs: ['tool:sum'],
  seed: ({ world }) => {
    frameAt(world, { x: -6, y: -5 });
    world.probe = { x: -4, y: 1 };
    world.beacons = [{ id: world.newId('b'), pos: { x: 1, y: 0 }, radius: 0.45 }];
    card(world, 'A', { x: -6, y: -3.5 }, { x: 3, y: 1 });
    card(world, 'A', { x: -2, y: -4 }, { x: 3, y: 1 });
    card(world, 'A', { x: 2, y: -3.5 }, { x: 3, y: 1 });
    card(world, 'B', { x: 4.5, y: -0.5 }, { x: 1, y: 3 });
  },
  steps: [
    {
      text: 'Tres copias de A y una B. Llega a la baliza. Pista: toca una flecha con Mover; en el panel la puedes **invertir**.',
      on: 'probe-arrived',
    },
    {
      text: 'Llegaste con A + A − B. Cuando invertiste B, ¿cambió su largo?',
      on: 'end',
      ask: 'invertir',
      correct: 'igual',
      choices: [
        { id: 'igual', label: 'No: apunta al revés, igual de larga' },
        { id: 'mas', label: 'Sí: quedó más corta' },
      ],
    },
    {
      text: reveal('invertir', 'Lo que hiciste se escribe **2A − B**. Multiplicar una flecha por un número la estira; multiplicarla por −1 la invierte sin cambiar su largo. 2A − B es un vector como cualquier otro.', {
        igual: 'Lo predijiste bien.',
        mas: 'Mira |−B| en el panel: es igual a |B|. Invertir no acorta.',
      }),
      on: 'next',
    },
  ],
  page: {
    law: 'Multiplicar por un número estira la flecha; por −1 la invierte. 2A − B es otro vector.',
    engineering: 'En una grúa, la fuerza del cable y el peso apuntan en sentidos opuestos: equilibrarlas es sumar un vector con su opuesto.',
  },
};

const ejesAjenos: Site = {
  id: 'ejes-ajenos',
  zone: 'constelacion',
  title: 'Los ejes de otra persona',
  at: zoneAt('constelacion', 0, -4.5),
  note: 'Dejé una baliza en (4 ; 1). Medí desde este mismo origen, pero con mis ejes girados 30° respecto de los tuyos.',
  needs: ['tool:particle', 'tool:sum'],
  seed: ({ world }) => {
    frameAt(world, { x: -2, y: -2 });
    const at = rotate({ x: 4, y: 1 }, Math.PI / 6);
    world.beacons = [{ id: world.newId('b'), pos: { x: -2 + at.x, y: -2 + at.y }, radius: 0.35, hidden: true }];
  },
  steps: [
    {
      text: 'Sus ejes no son los tuyos. Gira los tuyos 30° desde el círculo en la punta del eje x; arriba a la derecha ves cuánto los giraste.',
      on: 'frame-rotated',
      when: ({ world }) => !!world.frame && Math.abs(deg(world.frame.angle) - 30) < 0.6,
    },
    {
      text: 'Ahora tus ejes son los suyos. Coloca una partícula en (4 ; 1): el panel muestra sus coordenadas en tus ejes. Si no queda justo, muévela.',
      on: 'beacon-found',
    },
    {
      text: '¡Ahí estaba! Si vuelves a dejar tus ejes como al principio, ¿qué pasa con las coordenadas de la baliza?',
      on: 'end',
      ask: 'ajenos',
      correct: 'otras',
      choices: [
        { id: 'iguales', label: 'Siguen siendo (4 ; 1)' },
        { id: 'otras', label: 'Cambian, pero su distancia al origen no' },
        { id: 'todo', label: 'Cambian las coordenadas y la distancia' },
      ],
    },
    {
      text: 'Compruébalo: gira tus ejes de vuelta hasta 0° y mira la partícula en el panel.',
      on: 'frame-rotated',
      when: ({ world }) => !!world.frame && Math.abs(deg(world.frame.angle)) < 0.6,
    },
    {
      text: reveal('ajenos', 'En tus ejes de antes, la baliza está en (2,96 ; 2,87). Las **componentes** dependen de los ejes; la flecha r y su largo, |r| = 4,12 m, no.', {
        iguales: 'Las coordenadas son una descripción: con otros ejes, otros números.',
        otras: 'Lo predijiste bien.',
        todo: 'Mira |r| en el panel: no cambió. Girar los ejes no acerca ni aleja nada.',
      }),
      on: 'next',
    },
  ],
  page: {
    law: 'Las componentes de un vector dependen de los ejes; su largo y su dirección en el espacio, no.',
    engineering: 'Dos topógrafos con ejes distintos describen el mismo terreno con números distintos; para juntar sus planos hay que girar uno sobre el otro.',
  },
  mastery: [
    {
      id: 'primera',
      label: 'Encuéntrala con la primera partícula que colocas',
      on: 'beacon-found',
      when: (ctx) => ctx.total('particle-placed') <= 1,
    },
  ],
};

// ---------- La deriva: sin gravedad, lo que se mueve sigue ----------

/** Dónde estará a t = 4 s la partícula que se mueve sola en «Desde siempre». */
const DRIFT_START = { x: -6, y: 1 };
const DRIFT_V = { x: 1.5, y: 0.5 };
const DRIFT_AT_4 = { x: DRIFT_START.x + 4 * DRIFT_V.x, y: DRIFT_START.y + 4 * DRIFT_V.y };

/** La apuesta más cercana al punto donde estará a t = 4 s (m), o null si no apostó. */
const betMiss = (w: World): number | null => {
  const bets = w.particles.filter((p) => !p.locked);
  if (!bets.length) return null;
  return Math.min(...bets.map((p) => dist(p.pos, DRIFT_AT_4)));
};

const desdeSiempre: Site = {
  id: 'desde-siempre',
  zone: 'deriva',
  title: 'Desde siempre',
  at: zoneAt('deriva', -3.2, 1.6),
  note: 'Esta partícula ya se movía cuando llegué. Nadie la empuja. Nunca se detuvo.',
  needs: ['tool:particle'],
  grants: ['time:flow'],
  seed: ({ world }) => {
    frameAt(world, { x: -7, y: -2 });
    world.g = null;
    const p = world.addParticle(DRIFT_START, 1, DRIFT_V);
    p.locked = true;
  },
  steps: [
    {
      text: 'Aquí no hay gravedad. Ganaste el **tiempo**: con ▶ fluye y con ‖ se detiene. Antes de tocarlo, ¿qué hará esta partícula?',
      on: 'end',
      ask: 'inercia',
      correct: 'recto',
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
        frena: 'Dijiste que se frenaba. Es la intuición más común: en la vida diaria todo se frena por el roce. Aquí no hay roce.',
        recto: 'Lo predijiste bien: es la primera ley de Newton.',
        curva: 'Dijiste que se curvaba. Para curvarse, algo tendría que empujarla de lado, y aquí no hay nada.',
      }),
      on: 'next',
    },
    {
      text: 'Toca t = 0 para volver al inicio y luego +0,1 s para avanzar paso a paso. Selecciona la partícula y mira en el panel cuánto cambia r en cada paso.',
      on: 'time-step',
      when: (ctx) => ctx.count('time-step') >= 3,
      grants: ['time:rewind', 'time:step'],
    },
    {
      text: 'Ahora una apuesta: coloca una partícula donde crees que estará a t = 4 s. Después vuelve a t = 0 y deja fluir el tiempo.',
      on: 'tick',
      when: ({ world, sim }) => sim.t >= 4.2 && betMiss(world) !== null,
    },
    {
      text: ({ world }) => {
        const miss = betMiss(world) ?? 0;
        const verdict = miss < 0.5 ? 'Le achuntaste: a t = 4 s pasó por tu marca.' : `A t = 4 s pasó a ${fmt(miss)} m de tu marca.`;
        return `${verdict} Con velocidad constante, la posición cambia lo mismo cada segundo: r = r₀ + v t. Si sabes v, sabes dónde estará.`;
      },
      on: 'next',
    },
  ],
  page: {
    law: 'Sin nada que la empuje, una partícula sigue recto con la misma velocidad: r = r₀ + v t.',
    measured: (ctx) => {
      const v = userVec(ctx, DRIFT_V);
      return `v = ${fmtVec(v, 'm/s')}: avanza ${fmt(len(v))} m cada segundo.`;
    },
    engineering: 'Algunos países controlan la velocidad por tramo: dos cámaras registran tu auto y se divide la distancia por el tiempo. Lo que miden es tu velocidad media en ese tramo.',
  },
  mastery: [
    {
      id: 'apuesta',
      label: 'Acierta dónde estará a t = 4 s (a menos de 0,5 m)',
      on: 'tick',
      when: ({ world, sim }) => sim.t >= 4 && (betMiss(world) ?? Infinity) < 0.5,
    },
  ],
};

/** Distancia a la que se considera que la partícula alcanzó a la boya (m). */
export const CATCH_DIST = 0.4;

const boya: Site = {
  id: 'boya',
  zone: 'deriva',
  title: 'La boya',
  at: zoneAt('deriva', 3.2, -1.6),
  note: 'La boya pasa siempre por aquí, a la misma velocidad. Nunca pude alcanzarla.',
  needs: ['time:flow', 'tool:particle'],
  grants: ['tool:velocity'],
  seed: ({ world }) => {
    frameAt(world, { x: -5, y: -4 });
    world.g = null;
    const b = world.addParticle({ x: 5, y: 3 }, 1, { x: -1.2, y: 0 });
    b.locked = true;
    world.addParticle({ x: -3, y: -2 }, 1);
  },
  steps: [
    {
      text: 'Elige **Velocidad** y arrastra desde tu partícula para darle una velocidad. Después deja fluir el tiempo. Si no la alcanzas, vuelve a t = 0 y prueba otra.',
      on: 'caught',
    },
    {
      text: 'La alcanzaste. No apuntaste a donde estaba la boya, sino a donde iba a estar: las dos tenían que llegar al mismo punto en el mismo instante.',
      on: 'next',
    },
  ],
  page: {
    law: 'Para encontrarse, dos cuerpos tienen que estar en el mismo punto en el mismo instante: se apunta a donde estará, no a donde está.',
    measured: (ctx) => {
      const me = mine(ctx.world);
      const v0 = me ? (ctx.sim.initialState(me.id)?.vel ?? me.vel) : null;
      return v0 ? `La alcanzaste con v = ${fmtVec(userVec(ctx, v0), 'm/s')}.` : null;
    },
    engineering: 'Un sistema antimisiles, o un perro que atrapa un disco en el aire: ninguno corre hacia donde está el objetivo, sino hacia donde estará.',
  },
  mastery: [
    { id: 'primera', label: 'Alcánzala en el primer intento', on: 'caught', when: (ctx) => ctx.runs() <= 1 },
    {
      id: 'calma',
      label: 'Alcánzala con una rapidez menor que 1,5 m/s',
      on: 'caught',
      when: (ctx) => {
        const me = mine(ctx.world);
        const v0 = me ? (ctx.sim.initialState(me.id)?.vel ?? me.vel) : null;
        return !!v0 && len(v0) < 1.5;
      },
    },
  ],
};

// ---------- todos los rastros ----------

export const SITES: Site[] = [
  fromChapter('vacio', {
    zone: 'claro',
    at: zoneAt('claro', -2.6, 1.6),
    note: 'Si estás leyendo esto, tú también llegaste al vacío. Lo primero que hice fue decidir dónde estaba yo.',
    law: 'Sin un origen y unos ejes no hay posición. Los ejes son una elección, no una propiedad del espacio.',
  }),
  fromChapter('particula', {
    zone: 'claro',
    at: zoneAt('claro', 2.6, -1.6),
    note: 'Puse dos piedras y le pedí a alguien que midiera dónde estaban. Nuestros números no coincidieron.',
    needs: ['tool:origin'],
    law: 'La posición r depende de desde dónde se mide: mover el origen cambia r, no la partícula.',
  }),
  dosSaltos,
  atajo,
  escalar,
  ejesAjenos,
  desdeSiempre,
  boya,
  fromChapter('abajo', {
    zone: 'pozo',
    at: zoneAt('pozo', -3.2, 1.6),
    note: 'Aquí las cosas caen. Pero ¿hacia dónde, y por qué todas igual?',
    needs: ['time:flow'],
    law: 'Cerca de la superficie, todo cae con la misma aceleración g, sea cual sea su masa.',
  }),
  fromChapter('blanco', {
    zone: 'pozo',
    at: zoneAt('pozo', 3.2, -1.6),
    note: 'Nunca le acerté a este blanco. Siempre me quedé corto o me pasé.',
    needs: ['tool:gravity', 'tool:velocity'],
    law: 'En un tiro, la parte de v perpendicular a g no cambia; en la cima solo se anula la parte a lo largo de g.',
  }),
  fromChapter('superficies', {
    zone: 'laderas',
    at: zoneAt('laderas', 0, 1.5),
    note: 'Puse un suelo para que dejaran de caer. Algo lo empuja de vuelta.',
    needs: ['tool:gravity'],
    law: 'Una superficie empuja perpendicular a sí misma (la normal); el roce sostiene hasta que tan α supera μₛ.',
  }),
  fromChapter('resortes', {
    zone: 'taller',
    at: zoneAt('taller', 0, 0),
    note: 'Esto oscila desde que lo colgué, siempre con el mismo ritmo.',
    needs: ['tool:gravity'],
    law: '|F| = k ΔL. El período no depende de la amplitud y crece con la masa.',
  }),
  fromChapter('gravitacion', {
    zone: 'astro',
    at: zoneAt('astro', 0, 0),
    note: 'Aquí no hay g, y aun así las cosas caen hacia algo.',
    needs: ['tool:velocity'],
    law: 'Todas las masas se atraen; con la velocidad justa, una caída se vuelve órbita.',
  }),
  fromChapter('arrastre', {
    zone: 'mar',
    at: zoneAt('mar', 0, 0),
    note: 'En el agua, las piedras no caen como allá afuera.',
    needs: ['tool:gravity'],
    law: 'El arrastre crece con la rapidez hasta igualar el peso: es la velocidad terminal. Aquí la masa sí importa.',
  }),
  fromChapter('energia', {
    zone: 'central',
    at: zoneAt('central', 0, 0),
    note: 'Algo se conserva cuando todo cambia. Me falta saber qué.',
    needs: ['tool:gravity', 'tool:velocity'],
    law: 'Si solo actúan la gravedad y los resortes, la energía total K + U se mantiene.',
  }),
];

export const SITE_IDS = SITES.map((s) => s.id);

/** Pasos de un rastro en formato de texto plano (para los tests). */
export const stepTexts = (s: Site, ctx: StoryContext): string[] => s.steps.map((st: Step) => (typeof st.text === 'function' ? st.text(ctx) : st.text));

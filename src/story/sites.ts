import { fmt, fmtVec } from '../core/format';
import { dist, len, rotate, type Vec2 } from '../core/vec';
import { IDENTITY_FRAME, ReferenceFrame } from '../world/frame';
import type { World } from '../world/world';
import { placeOnPivot, placeOnSurface } from '../physics/rigid';
import { G_EARTH } from '../world/world';
import { CHAPTERS, reveal } from './chapters';
import { CATCH_DIST } from './missMonitor';
import type { Grant, Mastery, Page, Site, Step, StoryContext, Zone, ZoneId } from './types';

// ---------- el mapa ----------

/**
 * Zonas alrededor del claro, ubicadas a mano: más anchas que altas (como la pantalla) y dejando
 * libre la esquina de arriba a la izquierda, donde va la tarjeta del relato.
 */
export const ZONES: Zone[] = [
  { id: 'claro', name: 'El claro', at: { x: 0, y: 0 }, hint: 'solo espacio' },
  { id: 'constelacion', name: 'La constelación', at: { x: 27, y: 6 }, hint: 'flechas que nadie usó' },
  { id: 'taller', name: 'El taller', at: { x: 20, y: 17 }, hint: 'cosas que oscilan' },
  { id: 'astro', name: 'El astro', at: { x: 6, y: 19 }, hint: 'algo muy masivo' },
  { id: 'mar', name: 'El mar', at: { x: -8, y: 15 }, hint: 'aire y agua' },
  { id: 'laderas', name: 'Las laderas', at: { x: -28, y: -5 }, hint: 'planos con roce' },
  { id: 'pozo', name: 'El pozo', at: { x: -22, y: -21 }, hint: 'aquí las cosas caen' },
  { id: 'central', name: 'La central', at: { x: 0, y: -18 }, hint: 'algo se conserva' },
  { id: 'deriva', name: 'La deriva', at: { x: 22, y: -21 }, hint: 'sin gravedad' },
  { id: 'puente', name: 'El puente', at: { x: 31, y: -11 }, hint: 'cuerpos que giran' },
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
  opts: {
    zone: ZoneId;
    at: { x: number; y: number };
    note: string;
    needs?: Grant[];
    law: string;
    measured?: Page['measured'];
    mastery?: Mastery[];
    /** para usar solo una parte del capítulo como rastro propio */
    id?: string;
    title?: string;
    steps?: [number, number];
    engineering?: string;
  },
): Site {
  const ch = CHAPTERS.find((c) => c.id === id);
  if (!ch) throw new Error(`Falta el capítulo ${id}`);
  const eng = ch.steps.find((s) => s.kind === 'engineering');
  const steps = ch.steps.filter((s) => s.kind !== 'engineering');
  return {
    id: opts.id ?? id,
    zone: opts.zone,
    title: opts.title ?? ch.title,
    at: opts.at,
    note: opts.note,
    needs: opts.needs,
    grants: ch.grants,
    seed: ch.seed,
    steps: opts.steps ? steps.slice(opts.steps[0], opts.steps[1]) : steps,
    page: { law: opts.law, measured: opts.measured, engineering: opts.engineering ?? (typeof eng?.text === 'string' ? eng.text : '') },
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
      tool: 'tool:move',
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
      tool: 'tool:vector',
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
    {
      id: 'directa',
      label: 'Dibuja con Vector la flecha que va directo de la sonda a la baliza',
      on: 'tick',
      when: ({ world }) => {
        const probe = world.probe;
        const goal = world.beacons[0]?.pos;
        return !!probe && !!goal && world.vectors.some((v) => !v.fixed && dist(v.tail, probe) < 0.3 && dist(v.tip, goal) < 0.3);
      },
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
      tool: 'tool:move',
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

/** Hasta dónde se ve el movimiento antes de apostar (s). */
const BET_PEEK = 1;

/**
 * La apuesta se juzga una sola vez: la primera vez que el tiempo pasa por t = 4 s con una marca
 * puesta. Así, mover la marca después de haber visto el resultado no cambia el veredicto ni el reto.
 */
export const driftBet = { miss: null as number | null };

/** El tiempo no pasa de t = 1 s hasta que haya una marca: la apuesta se hace sin haber visto el resto. */
const holdForBet = ({ sim }: StoryContext) => {
  sim.pauseAt = BET_PEEK;
};

const desdeSiempre: Site = {
  id: 'desde-siempre',
  zone: 'deriva',
  title: 'Desde siempre',
  at: zoneAt('deriva', -3.2, 1.6),
  note: 'Esta partícula ya se movía cuando llegué. Nadie la empuja. Nunca se detuvo.',
  needs: ['tool:particle'],
  seed: ({ world }) => {
    frameAt(world, { x: -7, y: -2 });
    world.g = null;
    const p = world.addParticle(DRIFT_START, 1, DRIFT_V);
    p.locked = true;
    driftBet.miss = null;
  },
  steps: [
    {
      text: 'Aquí no hay gravedad, y esta partícula se mueve sola. ¿Qué hará si dejas pasar el tiempo?',
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
      text: 'Ganaste el **tiempo**: con ▶ fluye y con ‖ se detiene. Déjalo fluir y mira las marcas: cada punto es su posición cada 0,1 s. Se detendrá solo en t = 1 s.',
      on: 'tick',
      grants: ['time:flow'],
      tool: 'time:flow',
      enter: (ctx) => {
        // quien ya tenía el tiempo pudo dejarlo correr antes de responder: se vuelve a t = 0
        if (ctx.sim.hasRun && ctx.sim.t > BET_PEEK) ctx.sim.reset();
        holdForBet(ctx);
      },
      when: ({ sim }) => sim.hasRun && sim.t >= BET_PEEK - 1e-6,
    },
    {
      text: reveal('inercia', 'Sigue recto, y las marcas quedan igual de separadas: recorre lo mismo cada 0,1 s. Eso es su **velocidad**, v = Δr/Δt. Nada la frena porque nada la toca: es la **inercia**.', {
        frena: 'Dijiste que se frenaba. Es la intuición más común: en la vida diaria todo se frena por el roce. Aquí no hay roce.',
        recto: 'Lo predijiste bien: es la primera ley de Newton.',
        curva: 'Dijiste que se curvaba. Para curvarse, algo tendría que empujarla de lado, y aquí no hay nada.',
      }),
      on: 'next',
      enter: holdForBet,
    },
    {
      text: 'Ahora una apuesta: coloca una partícula donde crees que estará a t = 4 s. El tiempo queda detenido hasta que pongas tu marca; después déjalo fluir.',
      on: 'tick',
      tool: 'tool:particle',
      enter: holdForBet,
      when: ({ world, sim }) => {
        sim.pauseAt = betMiss(world) === null ? BET_PEEK : null;
        if (driftBet.miss === null && sim.t >= 4 - 1e-6) driftBet.miss = betMiss(world);
        return driftBet.miss !== null && sim.t >= 4.2;
      },
    },
    {
      text: () => {
        const miss = driftBet.miss ?? 0;
        const verdict = miss < 0.5 ? 'Le achuntaste: a t = 4 s pasó por tu marca.' : `A t = 4 s pasó a ${fmt(miss)} m de tu marca.`;
        return `${verdict} Con velocidad constante, la posición cambia lo mismo cada segundo: r = r₀ + v t. Si sabes v, sabes dónde estará. Ganaste **t = 0**: vuelve al instante inicial para repetir un movimiento (también con la tecla R).`;
      },
      on: 'next',
      // t = 0 se gana aquí, después de la apuesta: así no se puede volver atrás a mirar antes de marcar.
      // Los rastros que se abren con el tiempo (la boya, el pozo, el astro) piden «vuelve a t = 0».
      grants: ['time:rewind'],
      tool: 'time:rewind',
    },
  ],
  page: {
    law: 'Sin nada que la empuje, una partícula sigue recto con la misma velocidad: r = r₀ + v t.',
    measured: (ctx) => {
      const v = userVec(ctx, DRIFT_V);
      return `v = ${fmtVec(v, 'm/s')}: avanza ${fmt(len(v))} m cada segundo.`;
    },
    engineering: 'Las sondas Voyager viajan desde 1977 con los motores apagados: allá afuera no hay aire ni roce que las frene, y solo la gravedad del Sol las retiene un poco.',
  },
  mastery: [
    {
      id: 'apuesta',
      label: 'Acierta dónde estará a t = 4 s (a menos de 0,5 m)',
      on: 'tick',
      when: () => driftBet.miss !== null && driftBet.miss < 0.5,
    },
  ],
};

/** La misma partícula de «Desde siempre», mirada de a 0,1 s y en gráficos. */
const cuadro: Site = {
  id: 'cuadro-a-cuadro',
  zone: 'deriva',
  title: 'Cuadro a cuadro',
  at: zoneAt('deriva', -1, -4.6),
  note: 'Anoté dónde estaba cada décima de segundo. Los números decían algo que a simple vista no se ve.',
  needs: ['time:flow'],
  seed: ({ world }) => {
    frameAt(world, { x: -7, y: -2 });
    world.g = null;
    world.addParticle(DRIFT_START, 1, DRIFT_V).locked = true;
  },
  steps: [
    {
      text: 'Ganaste **+0,1 s**: el tiempo avanza de a un paso. Toca la partícula y avanza de a un paso (con t = 0 vuelves al inicio): mira en el panel cuánto cambia r en cada uno.',
      on: 'time-step',
      when: (ctx) => ctx.count('time-step') >= 3,
      grants: ['time:rewind', 'time:step'],
      tool: 'time:step',
    },
    {
      text: (ctx) => {
        const v = userVec(ctx, DRIFT_V);
        const dr = { x: v.x * 0.1, y: v.y * 0.1 };
        return `En cada paso, r cambió lo mismo: Δr = ${fmtVec(dr, 'm')}. Dividido por Δt = 0,1 s da v = ${fmtVec(v, 'm/s')}: la **velocidad** es Δr/Δt, y aquí no cambia.`;
      },
      on: 'next',
    },
    {
      text: 'Ganaste los **gráficos**: abajo a la derecha están x(t), y(t), vₓ(t) y v_y(t) de la partícula elegida. Con velocidad constante, x(t) es una recta y vₓ(t) es plana. Vuelve a t = 0 y míralos crecer mientras fluye el tiempo.',
      on: 'next',
      grants: ['lens:graphs'],
      tool: 'lens:graphs',
    },
  ],
  page: {
    law: 'La velocidad es cuánto cambia r en cada intervalo: v = Δr/Δt. Con v constante, x(t) es una recta y vₓ(t) es plana.',
    engineering: 'Algunos países controlan la velocidad por tramo: dos cámaras registran tu auto y se divide la distancia por el tiempo. Lo que miden es tu velocidad media en ese tramo.',
  },
};

export { CATCH_DIST };

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
      tool: 'tool:velocity',
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


// ---------- El pozo: regiones con su propia gravedad ----------

/** Inclinación de una superficie respecto de la horizontal de su g, en grados. */
function inclineDeg(world: World, a: Vec2, b: Vec2): number | null {
  const g = world.gAt({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const d = { x: b.x - a.x, y: b.y - a.y };
  if (!g || !len(g) || !len(d)) return null;
  const sin = Math.abs(d.x * g.x + d.y * g.y) / (len(d) * len(g));
  return deg(Math.asin(Math.min(1, sin)));
}

const rincon: Site = {
  id: 'rincon',
  zone: 'pozo',
  title: 'El rincón torcido',
  at: zoneAt('pozo', -0.5, -4.2),
  note: 'En este rincón las cosas no caen hacia donde uno espera. Tardé en entender por qué.',
  needs: ['tool:gravity', 'tool:particle'],
  seed: ({ world }) => {
    frameAt(world, { x: 5, y: -3.5 });
    world.g = null;
    world.regions = [{ id: world.newId('r'), min: { x: -6, y: -5 }, max: { x: 10, y: 6 }, g: { x: -G_EARTH, y: 0 }, name: 'Rincón' }];
    world.targets = [{ id: world.newId('t'), pos: { x: -3.5, y: 1 }, radius: 0.5 }];
  },
  steps: [
    {
      text: 'Aquí g apunta hacia la izquierda de tu pantalla. Si sueltas una partícula, ¿hacia dónde cae?',
      on: 'end',
      ask: 'rincon',
      correct: 'g',
      choices: [
        { id: 'pantalla', label: 'Hacia el borde de abajo de la pantalla' },
        { id: 'g', label: 'Hacia donde apunta g' },
        { id: 'quieta', label: 'Se queda quieta' },
      ],
    },
    {
      text: 'Coloca una partícula donde quieras y deja fluir el tiempo para que caiga en el blanco.',
      on: 'target-hit',
    },
    {
      text: reveal('rincon', 'Cayó hacia la izquierda: **abajo** es la dirección de g, y aquí g apunta de lado. Todo lo que sabes de caídas y tiros sigue valiendo; solo cambió hacia dónde es abajo.', {
        pantalla: 'El borde de la pantalla no tiene nada de especial: lo que decide es g.',
        g: 'Lo predijiste bien.',
        quieta: 'Sin velocidad no se queda quieta: g la acelera desde el primer instante.',
      }),
      on: 'next',
    },
  ],
  page: {
    law: 'Abajo es la dirección de g, no el borde de la pantalla: las leyes no cambian si g apunta hacia otro lado.',
    engineering: 'En una estación espacial que gira, «abajo» es hacia afuera: los pisos se diseñan sobre la pared exterior.',
  },
  mastery: [
    {
      id: 'de-lado',
      label: 'Acierta lanzándola de lado, con una velocidad perpendicular a g',
      on: 'target-hit',
      when: ({ world, sim }) =>
        world.particles.some((p) => {
          const v = sim.initialState(p.id)?.vel ?? p.vel;
          return len(v) > 1 && Math.abs(v.x) < 0.3 * len(v);
        }),
    },
  ],
};

const G_MOON = 1.62;
/** Alcance de un tiro que sale y cae a la misma altura: R = 2 vₓ v_y / g. */
const range = (v: Vec2, g: number) => (2 * Math.abs(v.x) * Math.max(0, v.y)) / g;

/** Velocidad con que salió la partícula de la Luna (la que maneja el jugador). */
const moonV0 = (ctx: StoryContext): Vec2 | null => {
  const me = mine(ctx.world);
  return me ? (ctx.sim.initialState(me.id)?.vel ?? me.vel) : null;
};

const luna: Site = {
  id: 'luna',
  zone: 'pozo',
  title: 'El mismo tiro en la Luna',
  at: zoneAt('pozo', 4.5, 1.5),
  note: 'A un lado dejé la gravedad de la Luna; al otro, la de la Tierra. El mismo tiro no llega igual de lejos.',
  needs: ['tool:gravity', 'tool:velocity'],
  seed: ({ world }) => {
    frameAt(world, { x: 1.5, y: -3.6 });
    world.g = null;
    world.regions = [
      { id: world.newId('r'), min: { x: -9.5, y: -4.2 }, max: { x: -0.5, y: 5 }, g: { x: 0, y: -G_EARTH }, name: 'Tierra' },
      { id: world.newId('r'), min: { x: 0.5, y: -4.2 }, max: { x: 9.5, y: 5 }, g: { x: 0, y: -G_MOON }, name: 'Luna' },
    ];
    world.addSurface({ x: -9.5, y: -3 }, { x: -0.5, y: -3 }, 0.6, 0.4).locked = true;
    world.addSurface({ x: 0.5, y: -3 }, { x: 9.5, y: -3 }, 0.6, 0.4).locked = true;
    const earth = world.addParticle({ x: -8.5, y: -3 }, 1);
    earth.locked = true;
    world.addParticle({ x: 1.5, y: -3 }, 1);
    world.targets = [{ id: world.newId('t'), pos: { x: 7, y: -2.6 }, radius: 0.45 }];
  },
  steps: [
    {
      text: 'A la derecha, g es la de la Luna: 1,62 m/s². Elige Velocidad, dale una a la partícula de la Luna y deja fluir el tiempo para que caiga en el blanco.',
      on: 'target-hit',
      tool: 'tool:velocity',
    },
    {
      text: 'Si la partícula de la Tierra sale con exactamente la misma velocidad, ¿hasta dónde llega?',
      on: 'end',
      ask: 'luna',
      correct: 'sexto',
      choices: [
        { id: 'igual', label: 'Igual de lejos' },
        { id: 'mitad', label: 'A la mitad' },
        { id: 'sexto', label: 'Más o menos a un sexto' },
      ],
    },
    {
      text: 'Le di a la de la Tierra la misma velocidad. Vuelve a t = 0 y deja fluir el tiempo hasta que las dos toquen el suelo.',
      on: 'tick',
      tool: 'time:rewind',
      enter: (ctx) => {
        const v = moonV0(ctx);
        const earth = ctx.world.particles.find((p) => p.locked);
        if (ctx.sim.hasRun) ctx.sim.reset();
        if (v && earth) earth.vel = { ...v };
      },
      when: ({ world, sim }) =>
        sim.hasRun &&
        sim.t > 0.6 &&
        world.particles.every((p) => !!sim.contactNormal(p.id)) &&
        world.particles.some((p) => dist(p.pos, sim.initialState(p.id)?.pos ?? p.pos) > 1),
    },
    {
      text: reveal('luna', 'En la Luna llegó unas seis veces más lejos y más alto: 9,80 / 1,62 ≈ 6. Con la misma v₀, el alcance y la altura máxima son inversamente proporcionales a g.', {
        igual: 'La velocidad de salida es la misma, pero en la Tierra g la frena seis veces más rápido.',
        mitad: 'Más que la mitad: g es seis veces mayor, y el alcance va como 1/g.',
        sexto: 'Lo predijiste bien.',
      }),
      on: 'next',
    },
  ],
  page: {
    law: 'Con la misma velocidad de salida, el alcance y la altura máxima van como 1/g.',
    measured: (ctx) => {
      const v = moonV0(ctx);
      if (!v) return null;
      return `Con v₀ = ${fmtVec(userVec(ctx, v), 'm/s')}: alcance ${fmt(range(v, G_MOON))} m en la Luna y ${fmt(range(v, G_EARTH))} m en la Tierra.`;
    },
    engineering: 'Los trajes y vehículos lunares se prueban pensando en esto: un salto que en la Tierra sube 30 cm, en la Luna sube casi 2 m.',
  },
};

// ---------- Las laderas: la normal y el roce ----------

const quedarse: Site = {
  id: 'quedarse',
  zone: 'laderas',
  title: '¿Se queda o desliza?',
  at: zoneAt('laderas', 4.5, 0),
  note: 'Dos rampas del mismo material, una más empinada. Nunca anoté qué pasaba en cada una.',
  needs: ['tool:surface'],
  seed: ({ world }) => {
    frameAt(world, { x: -7, y: -3 });
    world.g = { x: 0, y: -G_EARTH };
    world.addSurface({ x: -6.5, y: -3 }, { x: 6.5, y: -3 }).locked = true;
    for (const [x, a] of [
      [-6, 20],
      [1, 40],
    ]) {
      const th = (a * Math.PI) / 180;
      const A = { x, y: -3 };
      const B = { x: x + 5 * Math.cos(th), y: -3 + 5 * Math.sin(th) };
      world.addSurface(A, B).locked = true;
      world.addParticle({ x: A.x + 0.6 * (B.x - A.x), y: A.y + 0.6 * (B.y - A.y) }, 1);
    }
  },
  steps: [
    {
      text: 'Las dos rampas tienen el mismo roce: μₛ = 0,60. En la rampa de 20°, ¿la partícula se queda o desliza?',
      on: 'end',
      ask: 'rampa20',
      correct: 'queda',
      choices: [
        { id: 'queda', label: 'Se queda' },
        { id: 'desliza', label: 'Desliza' },
      ],
    },
    {
      text: '¿Y en la de 40°?',
      on: 'end',
      ask: 'rampa40',
      correct: 'desliza',
      choices: [
        { id: 'queda', label: 'Se queda' },
        { id: 'desliza', label: 'Desliza' },
      ],
    },
    {
      text: 'Deja fluir el tiempo y mira las dos. Toca una partícula para ver sus fuerzas en el panel.',
      on: 'tick',
      when: (ctx) => ctx.total('held') > 0 && ctx.total('slid') > 0,
    },
    {
      text: (ctx) => {
        const ok = ctx.prediction('rampa20') === 'queda' && ctx.prediction('rampa40') === 'desliza';
        const verdict = ok ? 'Predijiste las dos.' : 'No predijiste las dos: la clave no es el ángulo solo, sino compararlo con el roce.';
        return `${verdict} En la de 20° se queda y en la de 40° desliza. El **roce estático** se ajusta a lo que haga falta, hasta un máximo μₛN: la partícula se queda mientras tan α ≤ μₛ. Aquí tan 20° = 0,36 y tan 40° = 0,84.`;
      },
      on: 'next',
    },
  ],
  page: {
    law: 'Una partícula se queda en una pendiente mientras tan α ≤ μₛ: el roce estático llega hasta μₛN.',
    engineering: 'El ángulo en que una pila de arena o de áridos deja de sostenerse depende del roce entre los granos: con eso se diseñan taludes y acopios.',
  },
};

/** μₛ del plano de «La pendiente justa»: el jugador no lo ve. */
const SECRET_MU = 0.45;
/** Ángulo en que empieza a deslizar: tan α = μₛ (≈ 24,2°). */
const CRITICAL_DEG = deg(Math.atan(SECRET_MU));
/** Si empezó a deslizar más de esto sobre el ángulo justo, la medición no vale: se pide repetir de a poco. */
export const OVERSHOOT_DEG = 5;

/** Inclinación del plano de «La pendiente justa», en grados. */
const slopeAngle = (world: World): number | null => {
  const s = world.surfaces[0];
  return s ? inclineDeg(world, s.a, s.b) : null;
};

const pendiente: Site = {
  id: 'mu',
  zone: 'laderas',
  title: 'La pendiente justa',
  at: zoneAt('laderas', 0, -4.5),
  note: 'Este plano tiene un roce que no alcancé a medir. Sé que se puede medir sin instrumentos.',
  needs: ['tool:surface'],
  seed: ({ world }) => {
    frameAt(world, { x: -6, y: -3.5 });
    world.g = { x: 0, y: -G_EARTH };
    const th = (10 * Math.PI) / 180;
    const A = { x: -5, y: -2.5 };
    const B = { x: A.x + 8 * Math.cos(th), y: A.y + 8 * Math.sin(th) };
    const s = world.addSurface(A, B, SECRET_MU, 0.35);
    s.secret = true;
    world.addParticle({ x: A.x + 0.55 * (B.x - A.x), y: A.y + 0.55 * (B.y - A.y) }, 1);
  },
  steps: [
    {
      text: 'Con Mover, inclina el plano de a poco arrastrando su extremo derecho y deja fluir el tiempo en cada ángulo. Busca el ángulo justo en que la partícula empieza a deslizar; el panel del plano muestra α.',
      on: 'slid',
      tool: 'tool:move',
      retry: ({ world }) => {
        const a = slopeAngle(world);
        if (a === null || a - CRITICAL_DEG <= OVERSHOOT_DEG) return null;
        return `Deslizó con α = ${fmt(a, 1)}°, pero ahí ya no se mide el ángulo justo: te pasaste. Baja el plano y súbelo de a poco, uno o dos grados cada vez.`;
      },
    },
    {
      text: ({ world }) => {
        const s = world.surfaces[0];
        const a = s ? inclineDeg(world, s.a, s.b) : null;
        if (a === null) return 'Empezó a deslizar.';
        return `Empezó a deslizar con α = ${fmt(a, 1)}°. Justo ahí la componente del peso a lo largo del plano igualó el roce máximo, así que **μₛ = tan α** ≈ ${fmt(Math.tan((a * Math.PI) / 180))}. El valor que dejé anotado era ${fmt(SECRET_MU)}: si te pasaste del ángulo justo, tu medición queda un poco más alta.`;
      },
      on: 'next',
    },
  ],
  page: {
    law: 'En el ángulo en que una partícula empieza a deslizar, μₛ = tan α: el roce se mide con una pendiente.',
    measured: ({ world }) => {
      const s = world.surfaces[0];
      const a = s ? inclineDeg(world, s.a, s.b) : null;
      return a === null ? null : `Mediste α = ${fmt(a, 1)}°: μₛ ≈ ${fmt(Math.tan((a * Math.PI) / 180))} (el valor real era ${fmt(SECRET_MU)}).`;
    },
    engineering: 'Así se mide el roce en un laboratorio de materiales: un plano que se inclina de a poco, y el ángulo en que la muestra empieza a deslizar.',
  },
  mastery: [
    {
      id: 'justo',
      label: 'Encuentra el ángulo con menos de 2° de error',
      on: 'slid',
      when: ({ world }) => {
        const s = world.surfaces[0];
        const a = s ? inclineDeg(world, s.a, s.b) : null;
        return a !== null && a - deg(Math.atan(SECRET_MU)) < 2;
      },
    },
  ],
};


// ---------- El taller: resortes ----------

/** Período de una masa m en un resorte k: T = 2π√(m/k). */
const period = (m: number, k: number) => 2 * Math.PI * Math.sqrt(m / k);

/** El resorte del jugador y el que marca el ritmo, con la masa que cuelga de cada uno. */
function springPair(world: World): { mine?: { k: number; m: number }; ref?: { k: number; m: number } } {
  const massOf = (sp: World['springs'][number]) => {
    const end = 'particle' in sp.b ? sp.b.particle : 'particle' in sp.a ? sp.a.particle : null;
    return end ? (world.particle(end)?.mass ?? null) : null;
  };
  const out: { mine?: { k: number; m: number }; ref?: { k: number; m: number } } = {};
  for (const sp of world.springs) {
    const m = massOf(sp);
    if (m === null) continue;
    if (sp.locked) out.ref = { k: sp.k, m };
    else out.mine = { k: sp.k, m };
  }
  return out;
}

/** ¿Los dos resortes oscilan al mismo compás (períodos a menos de un 3 %)? */
const inTune = (world: World) => {
  const { mine, ref } = springPair(world);
  return !!mine && !!ref && Math.abs(period(mine.m, mine.k) / period(ref.m, ref.k) - 1) < 0.03;
};

const sintonia: Site = {
  id: 'sintonia',
  zone: 'taller',
  title: 'Al mismo compás',
  at: zoneAt('taller', 0, -4.5),
  note: 'Dejé un resorte marcando el ritmo. El otro nunca logré que siguiera el compás.',
  needs: ['tool:spring'],
  seed: ({ world }) => {
    frameAt(world, { x: -6, y: -4 });
    world.g = { x: 0, y: -G_EARTH };
    const hang = (x: number, m: number, locked: boolean) => {
      const anchor = { x, y: 4 };
      const L0 = 1.5;
      const eq = L0 + (m * G_EARTH) / 20;
      const p = world.addParticle({ x, y: anchor.y - eq - 0.6 }, m);
      if (locked) p.locked = true;
      const sp = world.addSpring({ anchor }, { particle: p.id }, 20, L0);
      if (locked) sp.locked = true;
    };
    hang(-3, 2, true);
    hang(3, 0.5, false);
  },
  steps: [
    {
      text: 'El resorte de la izquierda (k = 20 N/m, 2 kg) marca el ritmo. Toca el de la derecha y su partícula: cambia su masa, o su k, hasta que oscilen al mismo compás. Después deja fluir el tiempo.',
      on: 'oscillated',
      when: ({ world }) => inTune(world),
    },
    {
      text: ({ world }) => {
        const { mine } = springPair(world);
        const how = mine && Math.abs(mine.k - 20) > 0.5 ? `Lo lograste con k = ${fmt(mine.k, 0)} N/m y ${fmt(mine.m)} kg: m/k es la misma.` : 'Lo lograste con la misma masa, 2 kg.';
        return `${how} El período depende solo de la razón entre masa y dureza: **T = 2π√(m/k)**. Dos resortes con la misma m/k marcan el mismo ritmo.`;
      },
      on: 'next',
    },
  ],
  page: {
    law: 'El período de un resorte depende solo de m/k: T = 2π√(m/k).',
    measured: ({ world }) => {
      const { mine } = springPair(world);
      return mine ? `Tu resorte: k = ${fmt(mine.k, 0)} N/m, m = ${fmt(mine.m)} kg, T = ${fmt(period(mine.m, mine.k))} s.` : null;
    },
    engineering: 'Los edificios altos llevan un péndulo o una masa con resortes afinada al ritmo del edificio: cuando el viento lo hace oscilar, esa masa oscila en contra y lo calma.',
  },
  mastery: [
    {
      id: 'otro-k',
      label: 'Logra el mismo compás con un resorte de otra dureza',
      on: 'oscillated',
      when: ({ world }) => inTune(world) && Math.abs((springPair(world).mine?.k ?? 20) - 20) > 0.5,
    },
  ],
};

// ---------- El astro: gravitación ----------

/** La más masiva y la más liviana (el astro y lo que gira a su alrededor). */
const bodies = (w: World) => {
  if (w.particles.length < 2) return null;
  const sorted = [...w.particles].sort((a, b) => b.mass - a.mass);
  return { big: sorted[0], small: sorted[sorted.length - 1] };
};

/** Qué tan circular fue la órbita: distancia máxima / mínima al astro, según la trayectoria. */
function roundness(ctx: StoryContext): number {
  const b = bodies(ctx.world);
  if (!b) return Infinity;
  const tb = ctx.sim.trails.get(b.big.id) ?? [];
  const ts = ctx.sim.trails.get(b.small.id) ?? [];
  const n = Math.min(tb.length, ts.length);
  if (n < 10) return Infinity;
  let min = Infinity;
  let max = 0;
  for (let i = 0; i < n; i++) {
    const d = dist(tb[i], ts[i]);
    min = Math.min(min, d);
    max = Math.max(max, d);
  }
  return max / min;
}

/** Rapidez inicial de lo liviano respecto del astro, en veces la velocidad de escape. */
function escapeRatio(ctx: StoryContext): number {
  const b = bodies(ctx.world);
  const G = ctx.world.gravitation?.G;
  if (!b || !G) return Infinity;
  const sb = ctx.sim.initialState(b.big.id);
  const ss = ctx.sim.initialState(b.small.id);
  if (!sb || !ss) return Infinity;
  const r = dist(sb.pos, ss.pos);
  const v = len({ x: ss.vel.x - sb.vel.x, y: ss.vel.y - sb.vel.y });
  return v / Math.sqrt((2 * G * (b.big.mass + b.small.mass)) / r);
}

// ---------- El mar: arrastre ----------

/** Rapidez máxima con que se puede tocar el suelo en «El paracaídas», m/s. */
const SAFE_LANDING = 2.5;

/** Rapidez en el aire justo antes de tocar el suelo (se mide cuadro a cuadro). */
const landing = { lastAir: 0, impact: null as number | null, run: -1 };

function watchLanding(ctx: StoryContext): number | null {
  const { world, sim } = ctx;
  const p = world.particles[0];
  if (!p || !sim.hasRun) return null;
  if (landing.run !== sim.runId || sim.t < 0.05) {
    landing.run = sim.runId;
    landing.lastAir = 0;
    landing.impact = null;
  }
  if (landing.impact !== null) return landing.impact;
  if (!sim.contactNormal(p.id)) {
    landing.lastAir = len(p.vel);
    return null;
  }
  if (sim.t > 0.2) landing.impact = landing.lastAir;
  return landing.impact;
}

const paracaidas: Site = {
  id: 'paracaidas',
  zone: 'mar',
  title: 'El paracaídas',
  at: zoneAt('mar', 0, -4.5),
  note: 'Algo frágil que dejé caer se rompió. Necesitaba que llegara despacio, y no tenía paracaídas.',
  needs: ['force:drag'],
  seed: ({ world }) => {
    frameAt(world, { x: -5, y: -3 });
    world.g = { x: 0, y: -G_EARTH };
    world.medium = null;
    world.addSurface({ x: -5, y: -3 }, { x: 5, y: -3 }, 0.6, 0.4).locked = true;
    world.addParticle({ x: 0, y: 4 }, 1);
  },
  steps: [
    {
      text: `Esta partícula se rompe si toca el suelo a más de ${fmt(SAFE_LANDING, 1)} m/s. Haz que aterrice suave: puedes cambiar el Medio en la barra y su masa en el panel. Si llega muy rápido, vuelve a t = 0 y prueba otra cosa.`,
      tool: 'force:drag',
      on: 'tick',
      when: (ctx) => {
        const v = watchLanding(ctx);
        return v !== null && v < SAFE_LANDING;
      },
    },
    {
      text: ({ world }) =>
        `Llegó a ${fmt(landing.impact ?? 0)} m/s. ${world.medium === 'agua' ? 'En el agua' : 'Con menos masa'} la velocidad terminal es menor: el arrastre iguala al peso a una rapidez más baja. Un paracaídas hace lo mismo: no quita peso, agrega arrastre.`,
      on: 'next',
    },
  ],
  page: {
    law: 'Con más arrastre o menos peso, la velocidad terminal es menor: v = √(m g / c).',
    measured: ({ world }) => (landing.impact !== null ? `Aterrizó a ${fmt(landing.impact)} m/s, en ${world.medium ?? 'el vacío'}, con ${fmt(world.particles[0]?.mass ?? 0)} kg.` : null),
    engineering: 'Las cápsulas espaciales abren varios paracaídas de a uno: cada uno baja la velocidad terminal un poco más, sin un tirón que dañe la estructura.',
  },
  mastery: [
    {
      id: 'en-aire',
      label: 'Aterriza suave en el aire, sin usar el agua',
      on: 'tick',
      when: (ctx) => ctx.world.medium === 'aire' && landing.impact !== null && landing.impact < SAFE_LANDING,
    },
  ],
};

// ---------- La central: energía ----------

const ALTO = { x: 0, y: 2 };

const altura: Site = {
  id: 'altura',
  zone: 'central',
  title: 'Justo hasta arriba',
  at: zoneAt('central', 0, 0),
  note: 'Quise lanzar algo para que llegara justo hasta aquí y se detuviera. Siempre me pasé o me quedé corto.',
  needs: ['lens:energy', 'tool:velocity'],
  seed: ({ world }) => {
    frameAt(world, { x: -4, y: -3 });
    world.g = { x: 0, y: -G_EARTH };
    world.addParticle({ x: 0, y: -3 }, 1);
    // una baliza y no un blanco: pasar por ella a toda velocidad no cuenta
    world.beacons = [{ id: world.newId('b'), pos: { ...ALTO }, radius: 0.35 }];
  },
  steps: [
    {
      text: 'Lánzala hacia arriba con Velocidad para que se detenga justo dentro del blanco, 5 m más arriba. Mira las barras de energía: arriba, toda la K se volvió Ug.',
      tool: 'tool:velocity',
      on: 'tick',
      when: ({ world, sim }) => {
        const p = world.particles[0];
        return !!p && sim.hasRun && dist(p.pos, ALTO) < 0.35 && len(p.vel) < 0.5;
      },
    },
    {
      text: 'Se detuvo ahí. Para subir h hace falta que toda la energía cinética se vuelva potencial: ½ m v² = m g h, así que **v = √(2 g h)** ≈ 9,9 m/s, sea cual sea la masa.',
      on: 'next',
    },
  ],
  page: {
    law: 'Para subir una altura h hace falta salir con v = √(2 g h): ½ m v² se vuelve m g h.',
    measured: ({ world, sim }) => {
      const p = world.particles[0];
      const v0 = p ? (sim.initialState(p.id)?.vel ?? p.vel) : null;
      return v0 ? `Saliste con |v₀| = ${fmt(len(v0))} m/s (lo justo era ${fmt(Math.sqrt(2 * G_EARTH * 5))} m/s).` : null;
    },
    engineering: 'En una montaña rusa, la altura de la primera bajada fija la rapidez de todo el recorrido: el resto es energía que cambia de forma.',
  },
  mastery: [
    {
      id: 'primera',
      label: 'Lógralo en el primer intento',
      on: 'tick',
      when: ({ world, sim, runs }) => {
        const p = world.particles[0];
        return !!p && sim.hasRun && runs() <= 1 && dist(p.pos, ALTO) < 0.35 && len(p.vel) < 0.5;
      },
    },
  ],
};


// ---------- La central: ¿adónde se fue? (calor) ----------

/** Suelo de los rastros del calor: el roce de siempre (μₛ = 0,4; μc = 0,3). */
const HEAT_MU_S = 0.4;
const HEAT_MU_K = 0.3;
const PISO_Y = -2;

/** ¿La partícula se detuvo de verdad (el roce estático la sostiene) después de moverse? */
const stopped = ({ world, sim }: StoryContext) => {
  const p = world.particles[0];
  return !!p && sim.hasRun && sim.t > 0.3 && p.vel.x === 0 && p.vel.y === 0;
};

const adonde: Site = {
  id: 'adonde',
  zone: 'central',
  title: '¿Adónde se fue?',
  at: zoneAt('central', 11, 0),
  note: 'La caja se detuvo sola. Su energía tenía que estar en alguna parte: la busqué y no la encontré.',
  needs: ['lens:energy'],
  seed: ({ world }) => {
    // el origen donde parte la caja, sobre el suelo: Ug = 0 todo el rato y x es lo que recorrió
    frameAt(world, { x: -4.5, y: PISO_Y });
    world.g = { x: 0, y: -G_EARTH };
    world.addSurface({ x: -6, y: PISO_Y }, { x: 6, y: PISO_Y }, HEAT_MU_S, HEAT_MU_K).locked = true;
    world.addParticle({ x: -4.5, y: PISO_Y }, 1, { x: 4, y: 0 });
  },
  steps: [
    {
      text: 'Esta caja de 1 kg sale a 4 m/s por un suelo con roce, y se va a detener. Enciende el lente Energía. Cuando se detenga, ¿qué habrá pasado con el total?',
      on: 'end',
      tool: 'lens:energy',
      ask: 'calor',
      correct: 'igual',
      choices: [
        { id: 'baja', label: 'Bajó: el roce gastó la energía' },
        { id: 'igual', label: 'Sigue igual' },
        { id: 'sube', label: 'Subió' },
      ],
    },
    {
      text: 'Deja fluir el tiempo y mira las barras hasta que se detenga.',
      on: 'tick',
      when: stopped,
    },
    {
      text: reveal('calor', 'K bajó hasta cero, pero el contorno de Total no se movió: lo que perdió K apareció en **Q**, el calor. El roce no destruye energía: la convierte en energía térmica (el suelo y la caja quedan un poco más calientes). Aquí Q = ½ m v² = 8 J. Mueve la línea de tiempo: en cualquier instante, K + Q es lo mismo.', {
        baja: 'La energía mecánica sí bajó; el total, contando el calor, no.',
        igual: 'Lo predijiste bien.',
        sube: 'Nada la empujó: no hay de dónde sacar energía nueva.',
      }),
      on: 'next',
    },
  ],
  page: {
    law: 'Con roce, la energía mecánica baja, pero lo que pierde aparece como calor: K + U + Q se mantiene.',
    measured: ({ world, sim }) => {
      const p = world.particles[0];
      return p && sim.hasRun && sim.heat > 0 ? `Se detuvo a ${fmt(p.pos.x + 4.5)} m de donde partió; el roce se llevó Q = ${fmt(sim.heat)} J.` : null;
    },
    engineering: 'Un auto eléctrico frena con su motor y recupera parte de su energía cinética en la batería (freno regenerativo). Con frenos de disco, toda esa energía se va en calor: por eso las pastillas se calientan.',
  },
  mastery: [
    {
      id: 'masa',
      label: 'Con el doble de masa, comprueba que se detiene en el mismo lugar',
      on: 'tick',
      when: (ctx) => {
        const p = ctx.world.particles[0];
        const v0 = p ? ctx.sim.initialState(p.id)?.vel : undefined;
        return !!p && !!v0 && p.mass >= 2 && Math.abs(len(v0) - 4) < 1e-6 && stopped(ctx);
      },
    },
    {
      id: 'mitad',
      label: 'Con la línea de tiempo, encuentra el instante en que Q iguala a K',
      on: 'timeline-seek',
      when: ({ world, sim }) => {
        const p = world.particles[0];
        if (!p || !sim.hasRun) return false;
        const K = 0.5 * p.mass * (p.vel.x ** 2 + p.vel.y ** 2);
        const Q = sim.heat;
        return K > 0.2 && Math.abs(Q - K) <= 0.05 * (K + Q);
      },
    },
  ],
};

const golpe: Site = {
  id: 'golpe',
  zone: 'central',
  title: 'El golpe',
  at: zoneAt('central', -5.5, -5),
  note: 'Dejé caer una caja desde la altura de mi cabeza. Hizo ruido y se quedó quieta.',
  needs: ['lens:energy'],
  seed: ({ world }) => {
    // el origen en el suelo: y es la altura y, al final, Ug = 0
    frameAt(world, { x: -4, y: PISO_Y });
    world.g = { x: 0, y: -G_EARTH };
    world.addSurface({ x: -4, y: PISO_Y }, { x: 4, y: PISO_Y }, HEAT_MU_S, HEAT_MU_K).locked = true;
    world.addParticle({ x: 1, y: PISO_Y + 2 }, 1);
  },
  steps: [
    {
      text: 'La caja está 2 m sobre el suelo. Con el lente Energía encendido, suéltala y mira las barras justo cuando toca el suelo.',
      tool: 'lens:energy',
      on: 'tick',
      when: (ctx) => stopped(ctx) && ctx.sim.heat > 0,
    },
    {
      text: ({ sim }) =>
        `Al tocar el suelo, toda la K pasó a Q de golpe: ${fmt(sim.heat)} J, lo mismo que la Ug que tenía arriba (m g h). En el juego los choques no rebotan; una pelota real rebota porque devuelve parte de esa energía, y la que no devuelve también se va en calor y en sonido.`,
      on: 'next',
    },
  ],
  page: {
    law: 'En un choque sin rebote, toda la energía cinética se va en calor: Q = ½ m v² = m g h si cayó desde h.',
    measured: ({ sim }) => (sim.hasRun && sim.heat > 0 ? `El golpe se llevó Q = ${fmt(sim.heat)} J.` : null),
    engineering: 'La carrocería de un auto se arruga a propósito en un choque: deformarse convierte la energía cinética en calor de a poco, y así llega menos fuerza a las personas.',
  },
  mastery: [
    {
      id: 'mitad',
      label: 'Haz que el golpe se lleve 9,8 J (cambia la altura o la masa)',
      on: 'tick',
      when: (ctx) => stopped(ctx) && Math.abs(ctx.sim.heat - G_EARTH) < 0.3,
    },
  ],
};

/** La baliza de «Justo en la marca»: 3 m más allá de donde parte la caja. */
const MARCA_X0 = -5;
const MARCA = { x: MARCA_X0 + 3, y: PISO_Y };

const marca: Site = {
  id: 'marca',
  zone: 'central',
  title: 'Justo en la marca',
  at: zoneAt('central', 5.5, -5),
  note: 'Quise empujar una caja para que se detuviera en una marca. Con el doble de fuerza se iba lejísimos.',
  needs: ['lens:energy', 'tool:velocity'],
  seed: ({ world }) => {
    frameAt(world, { x: MARCA_X0, y: PISO_Y });
    world.g = { x: 0, y: -G_EARTH };
    world.addSurface({ x: -7, y: PISO_Y }, { x: 5, y: PISO_Y }, HEAT_MU_S, HEAT_MU_K).locked = true;
    world.addParticle({ x: MARCA_X0, y: PISO_Y }, 1);
    world.beacons = [{ id: world.newId('b'), pos: { ...MARCA }, radius: 0.35 }];
  },
  steps: [
    {
      text: `En este suelo, una caja que sale a 2 m/s se detiene a ${fmt(4 / (2 * HEAT_MU_K * G_EARTH))} m. Si sale al doble de rapidez, ¿dónde se detiene?`,
      on: 'end',
      ask: 'frenado',
      correct: 'cuatro',
      choices: [
        { id: 'doble', label: 'Al doble de distancia' },
        { id: 'cuatro', label: 'Cuatro veces más lejos' },
        { id: 'igual', label: 'En el mismo lugar' },
      ],
    },
    {
      text: 'Dale velocidad con Velocidad para que se detenga dentro de la baliza, 3 m más allá. Si te pasas o te quedas corto, vuelve a t = 0 y prueba de nuevo.',
      on: 'tick',
      when: (ctx) => stopped(ctx) && dist(ctx.world.particles[0].pos, MARCA) < 0.35,
      tool: 'tool:velocity',
    },
    {
      text: reveal('frenado', `Se detuvo ahí. Toda su K se va en el calor del roce: ½ m v² = μc m g d, así que **d = v² / (2 μc g)**. Con el doble de rapidez llega cuatro veces más lejos, y la masa no importa. Para 3 m hacía falta v = √(2 μc g d) ≈ ${fmt(Math.sqrt(2 * HEAT_MU_K * G_EARTH * 3))} m/s.`, {
        doble: 'La energía crece con el cuadrado de la rapidez: el doble de rapidez es cuatro veces la energía que el roce tiene que llevarse.',
        cuatro: 'Lo predijiste bien.',
        igual: 'Con más rapidez trae más energía, y el roce necesita más camino para llevársela.',
      }),
      on: 'next',
    },
  ],
  page: {
    law: 'Frenando por roce, d = v² / (2 μc g): el doble de rapidez es cuatro veces la distancia, sin importar la masa.',
    measured: ({ world, sim }) => {
      const p = world.particles[0];
      const v0 = p ? sim.initialState(p.id)?.vel : undefined;
      return v0 ? `Saliste con |v₀| = ${fmt(len(v0))} m/s (lo justo era ${fmt(Math.sqrt(2 * HEAT_MU_K * G_EARTH * 3))} m/s).` : null;
    },
    engineering: 'La distancia de frenado de un auto crece con el cuadrado de la rapidez: a 100 km/h necesita cuatro veces lo que a 50 km/h. De esa cuenta salen los límites de velocidad cerca de los colegios.',
  },
  mastery: [
    {
      id: 'primera',
      label: 'Lógralo en el primer intento',
      on: 'tick',
      when: (ctx) => ctx.runs() <= 1 && stopped(ctx) && dist(ctx.world.particles[0].pos, MARCA) < 0.35,
    },
  ],
};

// ---------- El puente: cuerpos rígidos ----------

const rigidWorld = (w: World) => ({ bodies: w.bodies, surfaces: w.surfaces, gAt: (p: Vec2) => w.gAt(p) });

/** ¿El balancín quedó derecho y quieto después de dejarlo un rato? */
const balanced = ({ world, sim }: StoryContext) => {
  const b = world.bodies[0];
  return !!b && sim.hasRun && sim.t > 2.5 && Math.abs(b.angle) < 0.02 && Math.abs(b.omega) < 0.02;
};

const balanza: Site = {
  id: 'balanza',
  zone: 'puente',
  title: 'La balanza',
  at: zoneAt('puente', -4.5, 0),
  note: 'Dejé una pesa de 2 kg en este balancín. Nunca logré que se quedara derecho.',
  needs: ['tool:particle', 'tool:gravity', 'time:flow'],
  seed: ({ world }) => {
    frameAt(world, { x: -5, y: -3 });
    world.g = { x: 0, y: -G_EARTH };
    const rod = world.addBody({ shape: 'rod', size: 4, mass: 0.5, pos: { x: 0, y: 0 }, angle: 0, pivot: { at: { x: 0, y: 0 }, local: { x: 0, y: 0 }, limit: 0.35 }, loadable: true, locked: true });
    world.addLoad(rod, -1, 2, true);
  },
  steps: [
    {
      text: 'Con Partícula, toca la barra para poner pesas de 1 kg; tocar la misma marca suma otro kilo, y con Mover las corres. Logra que el balancín se quede derecho cuando dejes fluir el tiempo. Toca la barra con Mover para ver cada pesa y su distancia al eje.',
      tool: 'tool:particle',
      on: 'tick',
      when: (ctx) => balanced(ctx) && ctx.world.bodies[0].loads.length >= 2,
    },
    {
      text: 'Se queda derecho cuando los dos lados hacen el mismo **torque**: τ = m g d, el peso por su distancia al eje. 2 kg a 1 m se equilibran con 1 kg a 2 m, o con 4 kg a 0,5 m.',
      on: 'next',
    },
  ],
  page: {
    law: 'Una barra con eje queda en equilibrio cuando los torques se compensan: Σ m d = 0 a cada lado del eje.',
    measured: ({ world }) => {
      const mine = world.bodies[0]?.loads.filter((l) => !l.locked) ?? [];
      return mine.length ? `Pusiste ${mine.map((l) => `${fmt(l.mass, 0)} kg a ${fmt(l.s)} m`).join(' y ')}.` : null;
    },
    engineering: 'Una grúa torre lleva un contrapeso en el brazo corto: así el torque de la carga no la vuelca.',
  },
  mastery: [
    {
      id: 'una',
      label: 'Equilíbrala con una sola pesa',
      on: 'tick',
      when: (ctx) => balanced(ctx) && ctx.world.bodies[0].loads.filter((l) => !l.locked).length === 1,
    },
  ],
};

const palanca: Site = {
  id: 'palanca',
  zone: 'puente',
  title: 'La palanca',
  at: zoneAt('puente', 0, 4.5),
  note: 'Con este palo y un apoyo quise levantar 5 kg con apenas 1 kg. Me faltó saber dónde poner el apoyo.',
  needs: ['tool:move', 'tool:gravity', 'time:flow'],
  seed: ({ world }) => {
    frameAt(world, { x: -5, y: -3 });
    world.g = { x: 0, y: -G_EARTH };
    const rod = world.addBody({ shape: 'rod', size: 6, mass: 0, pos: { x: 0, y: 0 }, angle: 0, pivot: { at: { x: 0, y: 0 }, local: { x: 0, y: 0 }, limit: 0.35, movable: true }, locked: true });
    world.addLoad(rod, -3, 1, true);
    world.addLoad(rod, 3, 5, true);
  },
  steps: [
    {
      text: 'Corre el apoyo (el triángulo) a lo largo de la barra con Mover. Busca dónde ponerlo para que 1 kg levante los 5 kg, y deja fluir el tiempo.',
      tool: 'tool:move',
      on: 'tick',
      when: ({ world, sim }) => {
        const b = world.bodies[0];
        return !!b?.pivot?.limit && sim.hasRun && sim.t > 0.3 && b.angle >= b.pivot.limit - 1e-9;
      },
    },
    {
      text: ({ world }) => {
        const b = world.bodies[0];
        const d = b?.pivot ? 3 - b.pivot.local.x : 0;
        return `Con el apoyo a ${fmt(d)} m de la carga, el brazo del lado liviano mide ${fmt(6 - d)} m. 1 kg tan lejos hace más torque que 5 kg tan cerca. Es la **palanca**: se gana fuerza a cambio de recorrido.`;
      },
      on: 'next',
    },
  ],
  page: {
    law: 'Con una palanca, una fuerza pequeña a mucha distancia del apoyo equilibra o vence a una grande cerca de él: m₁ d₁ = m₂ d₂.',
    measured: ({ world }) => {
      const b = world.bodies[0];
      return b?.pivot ? `El apoyo quedó a ${fmt(3 - b.pivot.local.x)} m de los 5 kg.` : null;
    },
    engineering: 'Un alicate, una carretilla y un balancín de plaza son palancas: el diseño decide dónde va el apoyo según cuánta fuerza hay que ganar.',
  },
  mastery: [
    {
      id: 'equilibrio',
      label: 'Encuentra el punto exacto en que queda en equilibrio',
      on: 'tick',
      when: (ctx) => balanced(ctx),
    },
  ],
};

/** Barra y péndulo simple de 2 m, colgados y soltados desde 25°. */
const PEND_L = 2;

const pendulo: Site = {
  id: 'pendulo',
  zone: 'puente',
  title: 'El péndulo que no es un punto',
  at: zoneAt('puente', 4.5, 0),
  note: 'Colgué una barra y, al lado, una pesa de un hilo del mismo largo. No se movían al mismo ritmo.',
  needs: ['tool:gravity', 'time:flow'],
  seed: ({ world }) => {
    frameAt(world, { x: -5, y: -3 });
    world.g = { x: 0, y: -G_EARTH };
    const th = -Math.PI / 2 + (25 * Math.PI) / 180;
    const rod = world.addBody({ shape: 'rod', size: PEND_L, mass: 1, pos: { x: 0, y: 0 }, angle: th, pivot: { at: { x: -2, y: 2.5 }, local: { x: -PEND_L / 2, y: 0 } }, locked: true });
    const bob = world.addBody({ shape: 'rod', size: PEND_L, mass: 0, pos: { x: 0, y: 0 }, angle: th, pivot: { at: { x: 2, y: 2.5 }, local: { x: -PEND_L / 2, y: 0 } }, locked: true, thread: true });
    world.addLoad(bob, PEND_L / 2, 1, true);
    for (const b of [rod, bob]) placeOnPivot(b);
  },
  steps: [
    {
      text: 'Las dos miden 2 m y parten desde el mismo ángulo. La de la izquierda es una barra; la de la derecha, una pesa colgada de un hilo sin masa. ¿Cuál oscila más rápido?',
      on: 'end',
      ask: 'fisico',
      correct: 'barra',
      choices: [
        { id: 'barra', label: 'La barra' },
        { id: 'pesa', label: 'La pesa' },
        { id: 'igual', label: 'Igual: miden lo mismo' },
      ],
    },
    {
      text: 'Deja fluir el tiempo y mira cuál se adelanta.',
      on: 'tick',
      when: ({ sim }) => sim.hasRun && sim.t >= 6,
    },
    {
      text: reveal('fisico', `La barra va más rápido. Su masa está repartida a lo largo, y la que está cerca del eje casi no cuesta moverla. Su período es T = 2π√(2L/3g) ≈ ${fmt(2 * Math.PI * Math.sqrt((2 * PEND_L) / (3 * G_EARTH)))} s; el de la pesa, 2π√(L/g) ≈ ${fmt(2 * Math.PI * Math.sqrt(PEND_L / G_EARTH))} s.`, {
        barra: 'Lo predijiste bien.',
        pesa: 'La pesa tiene toda su masa en la punta, lo más lejos del eje: es la más difícil de hacer girar.',
        igual: 'Medir lo mismo no basta: importa cómo se reparte la masa.',
      }),
      on: 'next',
    },
  ],
  page: {
    law: 'Un péndulo físico oscila con T = 2π√(I/(m g d)): una barra colgada de un extremo va más rápido que una pesa en la punta.',
    engineering: 'El péndulo de un reloj de pared se ajusta subiendo o bajando una pesa: cambia el momento de inercia y con él el período.',
  },
};

const RACE_DEG = 20;

const carrera: Site = {
  id: 'carrera',
  zone: 'puente',
  title: 'La carrera',
  at: zoneAt('puente', 0, -4.5),
  note: 'Solté un disco, un aro y una caja por la misma pendiente. Siempre llegaban en el mismo orden.',
  needs: ['tool:surface', 'time:flow'],
  seed: ({ world }) => {
    frameAt(world, { x: -7, y: -4 });
    world.g = { x: 0, y: -G_EARTH };
    const th = (RACE_DEG * Math.PI) / 180;
    const shapes: ('box' | 'disc' | 'ring')[] = ['box', 'disc', 'ring'];
    shapes.forEach((shape, i) => {
      const y0 = 3.2 - i * 1.7;
      const surf = world.addSurface({ x: -6, y: y0 }, { x: -6 + 9 * Math.cos(th), y: y0 - 9 * Math.sin(th) }, 0, 0);
      surf.locked = true;
      const b = world.addBody({ shape, size: shape === 'box' ? 0.6 : 0.4, size2: 0.6, mass: 1, pos: { x: 0, y: 0 }, angle: 0, roll: { surface: surf.id, s: 0, v: 0, arrived: null }, locked: true });
      placeOnSurface(b, rigidWorld(world));
    });
  },
  steps: [
    {
      text: 'Un disco, un aro y una caja sin roce bajan pendientes iguales, de 20°. Los tres tienen 1 kg. ¿En qué orden llegan abajo?',
      on: 'end',
      ask: 'carrera',
      correct: 'cda',
      choices: [
        { id: 'juntos', label: 'Llegan juntos' },
        { id: 'cda', label: 'Caja, disco, aro' },
        { id: 'acd', label: 'Aro, caja, disco' },
        { id: 'dac', label: 'Disco, aro, caja' },
      ],
    },
    {
      text: 'Deja fluir el tiempo.',
      on: 'tick',
      when: ({ world }) => world.bodies.length > 0 && world.bodies.every((b) => b.roll?.arrived !== null && b.roll?.arrived !== undefined),
    },
    {
      text: reveal('carrera', 'Primero la caja, después el disco y al final el aro. Al rodar, parte de la energía se va en girar: más en el aro, que tiene toda su masa en el borde, que en el disco. La caja, sin roce, no gira. Por eso **a = g sen α / (1 + I/(m R²))**, sin importar la masa ni el tamaño.', {
        juntos: 'Si no giraran, sí; pero girar también cuesta energía.',
        cda: 'Lo predijiste bien.',
        acd: 'El aro es el que más energía gasta en girar: llega último.',
        dac: 'La caja no gasta nada en girar: llega primero.',
      }),
      on: 'next',
    },
  ],
  page: {
    law: 'Rodando, a = g sen α / (1 + I/(m R²)): la caja sin roce primero, el disco después y el aro al final, sin importar masa ni tamaño.',
    measured: ({ world }) => {
      const t = (shape: string) => world.bodies.find((b) => b.shape === shape)?.roll?.arrived;
      const [c, d, a] = [t('box'), t('disc'), t('ring')];
      return c && d && a ? `Llegaron en ${fmt(c)} s (caja), ${fmt(d)} s (disco) y ${fmt(a)} s (aro).` : null;
    },
    engineering: 'Los volantes de inercia guardan energía girando: se diseñan con la masa en el borde, como un aro, para que guarden más con el mismo peso.',
  },
  mastery: [
    {
      id: 'masa',
      label: 'Cambia la masa del aro y comprueba que igual llega último',
      on: 'tick',
      when: ({ world }) => {
        const ring = world.bodies.find((b) => b.shape === 'ring');
        const all = world.bodies.every((b) => b.roll?.arrived !== null && b.roll?.arrived !== undefined);
        if (!ring || !all || Math.abs(ring.mass - 1) < 1e-9) return false;
        return world.bodies.every((b) => (b.roll?.arrived ?? 0) <= (ring.roll?.arrived ?? 0));
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
    mastery: [
      {
        id: 'sobre',
        label: 'Pon el origen justo sobre una partícula: su r se vuelve (0 ; 0)',
        on: 'origin-moved',
        when: ({ world }) => !!world.frame && world.particles.some((q) => dist(q.pos, world.frame!.origin) < 0.15),
      },
    ],
  }),
  dosSaltos,
  atajo,
  escalar,
  ejesAjenos,
  desdeSiempre,
  cuadro,
  boya,
  fromChapter('abajo', {
    zone: 'pozo',
    at: zoneAt('pozo', -4.5, 1.5),
    note: 'Aquí las cosas caen. Pero ¿hacia dónde, y por qué todas igual?',
    needs: ['time:flow'],
    law: 'Cerca de la superficie, todo cae con la misma aceleración g, sea cual sea su masa.',
    mastery: [
      {
        id: 'de-lado',
        label: 'Haz que caigan hacia un costado de la pantalla',
        on: 'fell',
        when: ({ world }) => !!world.g && Math.abs(world.g.x) > Math.abs(world.g.y),
      },
      {
        // solo con +0,1 s se cae justo en el instante: fluyendo, la pausa nunca queda exacta
        id: 'paso',
        label: 'Con +0,1 s, detente justo cuando su rapidez llega a 9,80 m/s',
        on: 'time-step',
        when: ({ world }) => world.particles.some((q) => Math.abs(len(q.vel) - G_EARTH) < 0.02),
      },
    ],
  }),
  rincon,
  luna,
  fromChapter('blanco', {
    zone: 'pozo',
    at: zoneAt('pozo', 0.5, 4.5),
    note: 'Nunca le acerté a este blanco. Siempre me quedé corto o me pasé.',
    // la cima se lee en vₓ(t): hacen falta los gráficos de «Cuadro a cuadro»
    needs: ['tool:gravity', 'tool:velocity', 'lens:graphs'],
    law: 'En un tiro, la parte de v perpendicular a g no cambia; en la cima solo se anula la parte a lo largo de g.',
    mastery: [
      {
        id: 'alto',
        label: 'Acierta con un tiro de más de 60° sobre la horizontal',
        on: 'target-hit',
        when: ({ world, sim }) =>
          world.particles.some((q) => {
            const v = sim.initialState(q.id)?.vel ?? q.vel;
            const g = world.g;
            if (!g || len(v) < 1) return false;
            const up = -(v.x * g.x + v.y * g.y) / len(g);
            return up / len(v) > Math.sin((60 * Math.PI) / 180);
          }),
      },
    ],
  }),
  fromChapter('superficies', {
    id: 'suelo',
    title: 'El suelo empuja',
    steps: [0, 4],
    zone: 'laderas',
    at: zoneAt('laderas', -4.5, 0),
    note: 'Puse un suelo para que dejaran de caer. Algo lo empuja de vuelta.',
    needs: ['tool:gravity'],
    law: 'Una superficie empuja perpendicular a sí misma con la fuerza justa para no ser atravesada: la **normal** N.',
    engineering: 'Un puente reparte el peso de los autos sobre sus apoyos: cada apoyo empuja hacia arriba con su propia normal.',
  }),
  quedarse,
  pendiente,
  fromChapter('resortes', {
    id: 'hooke',
    title: 'La ley del resorte',
    steps: [0, 4],
    zone: 'taller',
    at: zoneAt('taller', -4.5, 0),
    note: 'Un resorte tira más cuanto más lo estiro. Quise saber cuánto más.',
    needs: ['tool:gravity'],
    law: 'Un resorte tira en proporción a cuánto se deforma: |F| = k ΔL (ley de Hooke).',
    engineering: 'Una balanza de resorte mide el peso por cuánto se estira: es la ley de Hooke hecha instrumento.',
  }),
  fromChapter('resortes', {
    id: 'periodo',
    title: 'El ritmo',
    steps: [4, 12],
    zone: 'taller',
    at: zoneAt('taller', 4.5, 0),
    note: 'Esto oscila desde que lo colgué, siempre con el mismo ritmo.',
    needs: ['tool:spring'],
    law: 'El período no depende de la amplitud y crece con la masa: T = 2π√(m/k).',
  }),
  sintonia,
  fromChapter('gravitacion', {
    id: 'atraccion',
    title: 'Todo atrae a todo',
    steps: [0, 4],
    zone: 'astro',
    at: zoneAt('astro', -4.5, 0),
    note: 'Aquí no hay g, y aun así las cosas caen hacia algo.',
    needs: ['time:flow'],
    law: 'Toda masa atrae a toda masa: F = G m₁ m₂ / r², con fuerzas iguales y opuestas.',
    engineering: 'Las mareas: la Luna atrae más al océano del lado cercano que al del lado lejano, y el mar se estira.',
  }),
  fromChapter('gravitacion', {
    id: 'orbita',
    title: 'En órbita',
    steps: [4, 6],
    zone: 'astro',
    at: zoneAt('astro', 0, 4.5),
    note: 'Una vez la vi dar una vuelta completa sin caer. Nunca supe repetirlo.',
    needs: ['force:gravitation', 'tool:velocity'],
    law: 'Una órbita es una caída que nunca llega: la velocidad de lado hace que «falle» el suelo.',
    mastery: [{ id: 'circular', label: 'Una órbita casi circular: que la distancia al astro no varíe más de un 10 %', on: 'orbited', when: (ctx) => roundness(ctx) < 1.1 }],
  }),
  fromChapter('gravitacion', {
    id: 'escape',
    title: 'Escapar',
    steps: [6, 9],
    zone: 'astro',
    at: zoneAt('astro', 4.5, 0),
    note: 'Con un empujón fuerte, algo se fue y no volvió.',
    needs: ['force:gravitation', 'tool:velocity'],
    law: 'Con √2 veces la velocidad de una órbita circular, se escapa: es la velocidad de escape.',
    engineering: 'Las sondas que salen del sistema solar no llevan combustible para escapar: pasan cerca de un planeta y le roban un poco de velocidad.',
    mastery: [{ id: 'justo', label: 'Escápate con menos de un 10 % sobre la velocidad de escape', on: 'escaped', when: (ctx) => escapeRatio(ctx) < 1.1 }],
  }),
  fromChapter('arrastre', {
    id: 'aire',
    title: 'La pluma y la piedra',
    steps: [0, 4],
    zone: 'mar',
    at: zoneAt('mar', -4.5, 0),
    note: 'Una pluma y una piedra no caen igual. Algo falta en lo que aprendí en el pozo.',
    needs: ['tool:gravity'],
    law: 'El aire frena con una fuerza que crece con la rapidez; a la misma rapidez frena igual, así que la masa sí importa.',
    engineering: 'Los autos se prueban en túneles de viento: menos arrastre es menos combustible a la misma velocidad.',
  }),
  fromChapter('arrastre', {
    id: 'terminal',
    title: 'Velocidad terminal',
    steps: [4, 9],
    zone: 'mar',
    at: zoneAt('mar', 4.5, 0),
    note: 'En el agua, las piedras no caen como allá afuera.',
    needs: ['force:drag'],
    law: 'El arrastre crece hasta igualar el peso: desde ahí se cae a velocidad constante, la velocidad terminal. Con el lente Energía se ve adónde va lo que pierde Ug: toda se vuelve calor, Q.',
  }),
  paracaidas,
  fromChapter('energia', {
    id: 'conserva',
    title: 'Lo que no cambia',
    steps: [0, 4],
    zone: 'central',
    at: zoneAt('central', -5.5, 5),
    note: 'Algo se conserva cuando todo cambia. Me falta saber qué.',
    needs: ['tool:gravity'],
    law: 'Sin roce ni aire, lo que gana la energía cinética lo pierde la potencial: K + U se mantiene.',
  }),
  fromChapter('energia', {
    id: 'cero',
    title: '¿Dónde está el cero?',
    steps: [4, 8],
    zone: 'central',
    at: zoneAt('central', 5.5, 5),
    note: 'Medí la energía desde dos lugares distintos y me dio distinto. Las dos veces tenía razón.',
    needs: ['lens:energy', 'tool:velocity'],
    law: 'El cero de la energía potencial es una elección: lo que tiene sentido físico son las diferencias.',
    engineering: 'En un plano de ingeniería las alturas se miden desde un nivel de referencia acordado (el nivel del mar, el piso del primer nivel): lo importante es usar siempre el mismo.',
  }),
  fromChapter('energia', {
    id: 'intercambio',
    title: 'Resorte y energía',
    steps: [8, 10],
    zone: 'central',
    at: zoneAt('central', -11, 0),
    note: 'Colgué algo de un resorte y miré cómo se pasaban la energía.',
    needs: ['lens:energy', 'tool:spring'],
    law: 'K, Ug y Ue se pasan la energía de una a otra; la suma no cambia.',
  }),
  altura,
  adonde,
  golpe,
  marca,
  balanza,
  palanca,
  pendulo,
  carrera,
];

export const SITE_IDS = SITES.map((s) => s.id);

/** Pasos de un rastro en formato de texto plano (para los tests). */
export const stepTexts = (s: Site, ctx: StoryContext): string[] => s.steps.map((st: Step) => (typeof st.text === 'function' ? st.text(ctx) : st.text));

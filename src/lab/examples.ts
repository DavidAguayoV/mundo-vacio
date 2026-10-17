import type { Vec2 } from '../core/vec';
import { ReferenceFrame } from '../world/frame';
import { worldToJSON } from '../world/serialize';
import { G_GAME } from '../physics/forces/gravitation';
import { G_EARTH, World } from '../world/world';
import type { LensId } from '../story/types';
import { placeOnSurface } from '../physics/rigid';
import { makeExperiment, type Experiment } from './experiment';

export const G_MOON = 1.62;

/** Un deslizador del profesor: cambia una cantidad del experimento y se vuelve a t = 0. */
export interface LabControl {
  id: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  /** decimales que se muestran */
  decimals?: number;
  /** valor actual (null si lo que controla ya no existe, por ejemplo si se borró la partícula) */
  get(w: World): number | null;
  set(w: World, v: number): void;
}

/** Guía de un laboratorio: qué se busca, qué medir y qué preguntar. */
export interface LabGuide {
  goal: string;
  measure: string[];
  questions: string[];
  /** lentes que se encienden al abrirlo */
  lenses?: LensId[];
  controls?: LabControl[];
}

export interface Example {
  id: string;
  name: string;
  description: string;
  guide?: LabGuide;
  build(): Experiment;
}

// ---------- deslizadores reutilizables ----------

const deg = (rad: number) => (rad * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;

/** |g|, conservando su dirección. */
const gControl = (min = 0.5, max = 25): LabControl => ({
  id: 'g',
  label: '|g|',
  unit: 'm/s²',
  min,
  max,
  step: 0.01,
  decimals: 2,
  get: (w) => (w.g ? Math.hypot(w.g.x, w.g.y) : 0),
  set: (w, v) => {
    const L = w.g ? Math.hypot(w.g.x, w.g.y) : 0;
    w.g = L ? { x: (w.g!.x / L) * v, y: (w.g!.y / L) * v } : { x: 0, y: -v };
  },
});

const massControl = (i: number, label = `m${'₁₂₃₄'[i] ?? ''}`, min = 0.25, max = 16): LabControl => ({
  id: `m${i}`,
  label,
  unit: 'kg',
  min,
  max,
  step: 0.25,
  decimals: 2,
  get: (w) => w.particles[i]?.mass ?? null,
  set: (w, v) => {
    const p = w.particles[i];
    if (p) p.mass = v;
  },
});

/** Rapidez inicial de una partícula, conservando su dirección (o hacia +x si estaba quieta). */
const speedControl = (i: number, max = 20): LabControl => ({
  id: `v${i}`,
  label: '|v₀|',
  unit: 'm/s',
  min: 0,
  max,
  step: 0.1,
  decimals: 1,
  get: (w) => {
    const p = w.particles[i];
    return p ? Math.hypot(p.vel.x, p.vel.y) : null;
  },
  set: (w, v) => {
    const p = w.particles[i];
    if (!p) return;
    const L = Math.hypot(p.vel.x, p.vel.y);
    p.vel = L ? { x: (p.vel.x / L) * v, y: (p.vel.y / L) * v } : { x: v, y: 0 };
  },
});

/** Ángulo de salida respecto de la horizontal, conservando la rapidez. */
const angleControl = (i: number): LabControl => ({
  id: `a${i}`,
  label: 'θ₀',
  unit: '°',
  min: 0,
  max: 90,
  step: 1,
  decimals: 0,
  get: (w) => {
    const p = w.particles[i];
    return p ? deg(Math.atan2(p.vel.y, p.vel.x)) : null;
  },
  set: (w, a) => {
    const p = w.particles[i];
    if (!p) return;
    const L = Math.hypot(p.vel.x, p.vel.y) || 1;
    p.vel = { x: L * Math.cos(rad(a)), y: L * Math.sin(rad(a)) };
  },
});

/** μₛ de todas las superficies (μc queda en dos tercios de μₛ). */
const muControl: LabControl = {
  id: 'mu',
  label: 'μₛ',
  unit: '',
  min: 0,
  max: 1.2,
  step: 0.05,
  decimals: 2,
  get: (w) => w.surfaces[0]?.muS ?? null,
  set: (w, v) => {
    for (const f of w.surfaces) {
      f.muS = v;
      f.muK = Math.round(((2 * v) / 3) * 100) / 100;
    }
  },
};

const kControl: LabControl = {
  id: 'k',
  label: 'k',
  unit: 'N/m',
  min: 5,
  max: 100,
  step: 1,
  decimals: 0,
  get: (w) => w.springs[0]?.k ?? null,
  set: (w, v) => {
    if (w.springs[0]) w.springs[0].k = v;
  },
};

function base(g: number | null = G_EARTH): World {
  const w = new World();
  w.frame = new ReferenceFrame({ x: 0, y: 0 }, 0);
  w.g = g === null ? null : { x: 0, y: -g };
  return w;
}

/** Plano de largo L inclinado α grados desde a, con una partícula apoyada a una fracción `at` de su largo. */
function inclineWithParticle(w: World, a: Vec2, L: number, alphaDeg: number, at: number, mass = 1) {
  const th = (alphaDeg * Math.PI) / 180;
  const b = { x: a.x + L * Math.cos(th), y: a.y + L * Math.sin(th) };
  w.addSurface(a, b);
  w.addParticle({ x: a.x + at * (b.x - a.x), y: a.y + at * (b.y - a.y) }, mass);
}

const exp = (w: World, name: string, description: string) => makeExperiment(worldToJSON(w), name, description);

// ---------- cuerpos rígidos ----------

/** Masa o distancia de una pesa del balancín. */
const loadControl = (i: number, what: 'mass' | 's'): LabControl => ({
  id: `${what}${i}`,
  label: what === 'mass' ? `m${'₁₂'[i]}` : `d${'₁₂'[i]}`,
  unit: what === 'mass' ? 'kg' : 'm',
  min: what === 'mass' ? 0.25 : -2,
  max: what === 'mass' ? 8 : 2,
  step: 0.25,
  decimals: 2,
  get: (w) => w.bodies[0]?.loads[i]?.[what] ?? null,
  set: (w, v) => {
    const l = w.bodies[0]?.loads[i];
    if (l) l[what] = v;
  },
});

/** Largo de cada pista de la carrera (m). */
export const RACE_LANE = 7;

/** Las tres pistas de la carrera, inclinadas alpha grados; los cuerpos vuelven arriba. */
function raceLanes(w: World, alphaDeg: number): void {
  const th = (alphaDeg * Math.PI) / 180;
  w.surfaces.forEach((surf, i) => {
    const y0 = 2.6 - i * 1.4;
    surf.a = { x: -2, y: y0 };
    surf.b = { x: -2 + RACE_LANE * Math.cos(th), y: y0 - RACE_LANE * Math.sin(th) };
  });
  const rw = { bodies: w.bodies, surfaces: w.surfaces, gAt: (p: Vec2) => w.gAt(p) };
  for (const b of w.bodies) {
    if (!b.roll) continue;
    b.roll = { ...b.roll, s: 0, v: 0, arrived: null };
    placeOnSurface(b, rw);
  }
}

/** Experimentos listos para usar en clase. Todos con g = 9,80 m/s² salvo el de la Luna. */
export const EXAMPLES: Example[] = [
  {
    id: 'caida',
    name: 'Dos masas en caída libre',
    description: '0,5 kg y 8 kg sueltas desde la misma altura. ¿Cuál llega primero al suelo?',
    guide: {
      goal: 'Comprobar que dos masas muy distintas, soltadas desde la misma altura, caen juntas.',
      measure: ['El tiempo de caída de cada una (línea de tiempo).', 'La pendiente de v_y(t): es −g para las dos.'],
      questions: ['¿Cambia algo si una masa es 64 veces la otra?', 'Si duplicas |g|, ¿el tiempo de caída se reduce a la mitad?'],
      lenses: ['graphs'],
      controls: [gControl(), massControl(1, 'm₂')],
    },
    build() {
      const w = base();
      w.addParticle({ x: -2, y: 3 }, 0.5);
      w.addParticle({ x: 2, y: 3 }, 8);
      w.addSurface({ x: -6, y: -3 }, { x: 6, y: -3 });
      return exp(w, this.name, this.description);
    },
  },
  {
    id: 'tiro',
    name: 'Tiro parabólico al blanco',
    description: 'v₀ = (6 ; 8) m/s pasa por el blanco. Cambia v₀ con Velocidad y busca otra forma de acertar.',
    guide: {
      goal: 'Relacionar la velocidad de salida con la altura máxima y el alcance de un tiro.',
      measure: ['La altura máxima y el instante en que v_y = 0.', 'El alcance horizontal; vₓ(t) es plana.'],
      questions: ['¿Con qué ángulo llega más lejos, si la rapidez es la misma?', '¿Hay dos ángulos que acierten al mismo blanco?'],
      lenses: ['graphs'],
      controls: [speedControl(0), angleControl(0), gControl()],
    },
    build() {
      const w = base();
      w.addParticle({ x: -5, y: -2 }, 1, { x: 6, y: 8 });
      w.targets.push({ id: w.newId('t'), pos: { x: 3, y: 0 }, radius: 0.45 });
      w.addSurface({ x: -6.5, y: -3 }, { x: 6.5, y: -3 });
      return exp(w, this.name, this.description);
    },
  },
  {
    id: 'luna',
    name: 'El mismo tiro en la Luna',
    description: 'El mismo lanzamiento con g = 1,62 m/s². Compara la altura máxima y el alcance.',
    guide: {
      goal: 'Ver cómo cambian la altura y el alcance con g, a igual velocidad de salida.',
      measure: ['La altura máxima y el alcance con g de la Luna.', 'Los mismos con |g| = 9,80 m/s² (cambia el deslizador).'],
      questions: ['¿Por cuánto se multiplica el alcance al dividir g por seis?', '¿Cambia el ángulo que da el alcance máximo?'],
      lenses: ['graphs'],
      controls: [speedControl(0), angleControl(0), gControl(0.5, 12)],
    },
    build() {
      const w = base(G_MOON);
      w.addParticle({ x: -5, y: -2 }, 1, { x: 6, y: 8 });
      w.addSurface({ x: -6.5, y: -3 }, { x: 6.5, y: -3 });
      return exp(w, this.name, this.description);
    },
  },
  {
    id: 'planos',
    name: '¿Se queda o desliza?',
    description: 'Dos planos con μₛ = 0,60 y μc = 0,40, inclinados 20° y 40°. Predice antes de lanzar.',
    guide: {
      goal: 'Predecir con tan α y μₛ si una partícula se queda o desliza en una pendiente.',
      measure: ['|N| y |f| en el panel de cada partícula.', 'tan α de cada plano (panel del plano).'],
      questions: ['¿Con qué μₛ la de 40° también se queda?', '¿Por qué |f| no es μₛ|N| en la que se queda?'],
      controls: [muControl],
    },
    build() {
      const w = base();
      w.addSurface({ x: -6.5, y: -3 }, { x: 6.5, y: -3 });
      inclineWithParticle(w, { x: -6, y: -3 }, 5, 20, 0.6);
      inclineWithParticle(w, { x: 1, y: -3 }, 5, 40, 0.6);
      return exp(w, this.name, this.description);
    },
  },
  {
    id: 'mu',
    name: 'Medir μₛ con una pendiente',
    description: 'Inclina el plano de a poco arrastrando su extremo derecho con Mover y lanza en cada ángulo. Cuando empiece a deslizar, tan α ≈ μₛ.',
    guide: {
      goal: 'Medir μₛ con una sola pendiente: el ángulo en que empieza a deslizar.',
      measure: ['El ángulo α justo en que desliza (panel del plano).', 'tan α en ese momento.'],
      questions: ['¿Por qué en ese ángulo μₛ = tan α?', '¿Importa la masa de la partícula?'],
    },
    build() {
      const w = base();
      inclineWithParticle(w, { x: -5, y: -2 }, 8, 15, 0.55);
      return exp(w, this.name, this.description);
    },
  },
  {
    id: 'resorte',
    name: 'Masa colgada de un resorte',
    description: 'k = 20 N/m y 1 kg, estirado 0,5 m bajo el equilibrio. Mide T en el panel del resorte y compáralo con 2π√(m/k).',
    guide: {
      goal: 'Medir el período de una masa en un resorte y compararlo con 2π√(m/k).',
      measure: ['T en el panel del resorte.', 'y(t) y v_y(t): dónde v es máxima y dónde es cero.'],
      questions: ['Si cuadruplicas la masa, ¿cuánto cambia T?', '¿Depende T de cuánto lo estiraste?'],
      lenses: ['graphs'],
      controls: [kControl, massControl(0, 'm')],
    },
    build() {
      const w = base();
      const k = 20;
      const L0 = 1.5;
      const eq = L0 + G_EARTH / k; // largo de equilibrio con 1 kg
      const anchor = { x: 0, y: 4 };
      const p = w.addParticle({ x: 0, y: anchor.y - eq - 0.5 }, 1);
      w.addSpring({ anchor }, { particle: p.id }, k, L0);
      return exp(w, this.name, this.description);
    },
  },
  {
    id: 'orbita',
    name: 'Una órbita circular',
    description: 'Atracción encendida, sin g: 64 kg en el centro y 1 kg a 3 m con la velocidad justa para una órbita circular. Prueba más y menos velocidad.',
    guide: {
      goal: 'Encontrar la rapidez de una órbita circular y ver qué pasa con más o menos.',
      measure: ['La distancia al centro en x(t) e y(t).', 'Cuánto tarda una vuelta.'],
      questions: ['¿Qué forma tiene la órbita con un poco más de rapidez?', '¿Desde qué rapidez ya no vuelve?'],
      lenses: ['graphs'],
      controls: [speedControl(1, 8)],
    },
    build() {
      const w = base(null);
      w.gravitation = { G: G_GAME };
      const M = 64;
      const m = 1;
      const r = 3;
      const v = Math.sqrt((G_GAME * (M + m)) / r);
      // el centro de masa queda quieto: el cuerpo grande se mueve un poco al revés
      w.addParticle({ x: 0, y: -(m * r) / (M + m) }, M, { x: -(m * v) / (M + m), y: 0 });
      w.addParticle({ x: 0, y: (M * r) / (M + m) }, m, { x: (M * v) / (M + m), y: 0 });
      return exp(w, this.name, this.description);
    },
  },
  {
    id: 'aire',
    name: 'Caída con aire',
    description: 'Las mismas masas del primer ejemplo, ahora con aire: la de 8 kg llega antes. Mira cuándo deja de crecer v.',
    guide: {
      goal: 'Ver cómo el aire hace que la masa sí importe: cada una llega a su velocidad terminal.',
      measure: ['La velocidad terminal de cada una en v_y(t).', 'El instante en que v_y deja de cambiar.'],
      questions: ['¿Cómo cambia la velocidad terminal con la masa?', '¿Por qué en el vacío caían juntas?'],
      lenses: ['graphs'],
      controls: [massControl(0, 'm₁'), massControl(1, 'm₂')],
    },
    build() {
      const w = base();
      w.medium = 'aire';
      w.addParticle({ x: -2, y: 4 }, 0.5);
      w.addParticle({ x: 2, y: 4 }, 8);
      return exp(w, this.name, this.description);
    },
  },
  {
    id: 'balancin',
    name: 'Balancín',
    description: 'Una barra con eje al centro y dos pesas. ¿Cuándo queda derecha?',
    guide: {
      goal: 'Encontrar cuándo un balancín queda en equilibrio: cuando los torques de los dos lados se compensan.',
      measure: ['El torque τ en el panel de la barra.', 'm₁ d₁ y m₂ d₂ en cada intento.'],
      questions: ['¿Qué combinaciones de masa y distancia lo equilibran?', '¿Importa la masa de la barra si el eje está en su centro?'],
      controls: [loadControl(0, 'mass'), loadControl(0, 's'), loadControl(1, 'mass'), loadControl(1, 's')],
    },
    build() {
      const w = base();
      const rod = w.addBody({ shape: 'rod', size: 4, mass: 0.5, pos: { x: 0, y: 0 }, angle: 0, pivot: { at: { x: 0, y: 0 }, local: { x: 0, y: 0 }, limit: 0.35 }, loadable: true });
      w.addLoad(rod, -1, 2);
      w.addLoad(rod, 1.5, 1);
      return exp(w, this.name, this.description);
    },
  },
  {
    id: 'carrera',
    name: 'La carrera',
    description: 'Un disco, un aro y una caja sin roce bajan pendientes iguales.',
    guide: {
      goal: 'Ver cómo la forma decide quién llega primero al rodar: a = g sen α / (1 + I/(m R²)).',
      measure: ['El instante de llegada de cada uno (panel de cada cuerpo).', 'La aceleración a en el panel.'],
      questions: ['¿Cambia el orden si el aro tiene más masa?', '¿Qué pasa con los tiempos si inclinas más las pistas?'],
      lenses: ['energy'],
      controls: [
        {
          id: 'alpha',
          label: 'α',
          unit: '°',
          min: 5,
          max: 45,
          step: 1,
          decimals: 0,
          get: (w) => {
            const s = w.surfaces[0];
            return s ? Math.round((Math.atan2(s.a.y - s.b.y, s.b.x - s.a.x) * 180) / Math.PI) : null;
          },
          set: (w, v) => raceLanes(w, v),
        },
        {
          id: 'mring',
          label: 'm aro',
          unit: 'kg',
          min: 0.25,
          max: 8,
          step: 0.25,
          decimals: 2,
          get: (w) => w.bodies.find((b) => b.shape === 'ring')?.mass ?? null,
          set: (w, v) => {
            const r = w.bodies.find((b) => b.shape === 'ring');
            if (r) r.mass = v;
          },
        },
      ],
    },
    build() {
      const w = base();
      (['box', 'disc', 'ring'] as const).forEach((shape) => {
        const surf = w.addSurface({ x: 0, y: 0 }, { x: 1, y: 0 }, 0, 0);
        w.addBody({ shape, size: shape === 'box' ? 0.6 : 0.4, size2: 0.6, mass: 1, pos: { x: 0, y: 0 }, angle: 0, roll: { surface: surf.id, s: 0, v: 0, arrived: null } });
      });
      raceLanes(w, 20);
      return exp(w, this.name, this.description);
    },
  },
  {
    id: 'vectores',
    name: 'Suma en ejes girados',
    description: 'A + B con los ejes girados 30°. Gira los ejes desde el asa: cambian las componentes, no la flecha.',
    guide: {
      goal: 'Ver que la suma es una flecha que no depende de los ejes, aunque sus componentes sí.',
      measure: ['Las componentes de A, B y A + B en el panel.', 'La magnitud |A + B| antes y después de girar los ejes.'],
      questions: ['¿Qué componentes cambian al girar los ejes?', '¿Qué número no cambia nunca?'],
    },
    build() {
      const w = base(null);
      w.frame = new ReferenceFrame({ x: 0, y: -1 }, Math.PI / 6);
      const a = w.addVector({ x: -4, y: -2 }, { x: -1, y: 0.5 });
      const b = w.addVector({ x: 2, y: 1 }, { x: 4, y: -1 });
      w.addSum(a.id, b.id);
      return exp(w, this.name, this.description);
    },
  },
];

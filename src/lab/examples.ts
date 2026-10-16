import type { Vec2 } from '../core/vec';
import { ReferenceFrame } from '../world/frame';
import { worldToJSON } from '../world/serialize';
import { G_EARTH, World } from '../world/world';
import { makeExperiment, type Experiment } from './experiment';

export const G_MOON = 1.62;

export interface Example {
  id: string;
  name: string;
  description: string;
  build(): Experiment;
}

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

/** Experimentos listos para usar en clase. Todos con g = 9,80 m/s² salvo el de la Luna. */
export const EXAMPLES: Example[] = [
  {
    id: 'caida',
    name: 'Dos masas en caída libre',
    description: '0,5 kg y 8 kg sueltas desde la misma altura. ¿Cuál llega primero al suelo?',
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
    id: 'vectores',
    name: 'Suma en ejes girados',
    description: 'A + B con los ejes girados 30°. Gira los ejes desde el asa: cambian las componentes, no la flecha.',
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

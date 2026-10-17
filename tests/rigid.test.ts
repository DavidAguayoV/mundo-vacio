import { describe, expect, it } from 'vitest';
import { systemEnergy } from '../src/physics/energy';
import { placeOnPivot, placeOnSurface, rollAcceleration } from '../src/physics/rigid';
import { Simulation } from '../src/physics/simulation';
import { worldFromJSON, worldToJSON } from '../src/world/serialize';
import { G_EARTH, World } from '../src/world/world';

const run = (sim: Simulation, seconds: number, each?: () => void) => {
  for (let i = 0; i < Math.round(seconds * 240); i++) {
    sim.advance(1 / 240);
    each?.();
  }
};

/** Período medido con los cruces por el ángulo de equilibrio (de menos a más). */
function measurePeriod(sim: Simulation, angle: () => number, eq: number, seconds: number): number {
  const ups: number[] = [];
  let prev = angle() - eq;
  run(sim, seconds, () => {
    const d = angle() - eq;
    if (prev < 0 && d >= 0) ups.push(sim.t);
    prev = d;
  });
  return (ups[ups.length - 1] - ups[0]) / (ups.length - 1);
}

describe('cuerpos rígidos', () => {
  it('una barra colgada de un extremo es un péndulo físico: T = 2π√(2L/3g)', () => {
    const w = new World();
    w.g = { x: 0, y: -G_EARTH };
    const L = 2;
    const b = w.addBody({ shape: 'rod', size: L, mass: 1, pos: { x: 0, y: 0 }, angle: -Math.PI / 2 + 0.05, pivot: { at: { x: 0, y: 3 }, local: { x: -L / 2, y: 0 } } });
    placeOnPivot(b);
    const sim = new Simulation(w);
    sim.maxTime = 60;
    sim.start();
    const T = measurePeriod(sim, () => b.angle, -Math.PI / 2, 20);
    expect(T).toBeCloseTo(2 * Math.PI * Math.sqrt((2 * L) / (3 * G_EARTH)), 2);
  });

  it('una barra sin masa con una pesa en la punta es el péndulo simple: T = 2π√(L/g)', () => {
    const w = new World();
    w.g = { x: 0, y: -G_EARTH };
    const L = 2;
    const b = w.addBody({ shape: 'rod', size: L, mass: 0, pos: { x: 0, y: 0 }, angle: -Math.PI / 2 + 0.05, pivot: { at: { x: 0, y: 3 }, local: { x: -L / 2, y: 0 } } });
    w.addLoad(b, L / 2, 1);
    placeOnPivot(b);
    const sim = new Simulation(w);
    sim.maxTime = 60;
    sim.start();
    const T = measurePeriod(sim, () => b.angle, -Math.PI / 2, 20);
    expect(T).toBeCloseTo(2 * Math.PI * Math.sqrt(L / G_EARTH), 2);
  });

  it('el péndulo conserva la energía', () => {
    const w = new World();
    w.g = { x: 0, y: -G_EARTH };
    const b = w.addBody({ shape: 'rod', size: 2, mass: 1.5, pos: { x: 0, y: 0 }, angle: 0.3, pivot: { at: { x: 0, y: 0 }, local: { x: -1, y: 0 } } });
    placeOnPivot(b);
    const sim = new Simulation(w);
    sim.maxTime = 60;
    const e0 = systemEnergy(w).total;
    sim.start();
    run(sim, 10);
    expect(Math.abs(systemEnergy(w).total - e0)).toBeLessThan(1e-6 * Math.abs(e0) + 1e-6);
  });

  it('el balancín equilibrado se queda quieto; el desequilibrado cae hasta su tope', () => {
    const make = (m2: number) => {
      const w = new World();
      w.g = { x: 0, y: -G_EARTH };
      const b = w.addBody({ shape: 'rod', size: 4, mass: 0.5, pos: { x: 0, y: 0 }, angle: 0, pivot: { at: { x: 0, y: 0 }, local: { x: 0, y: 0 }, limit: 0.4 } });
      w.addLoad(b, -1, 2);
      w.addLoad(b, 0.5, m2);
      const sim = new Simulation(w);
      sim.maxTime = 60;
      sim.start();
      run(sim, 3);
      return b;
    };
    expect(Math.abs(make(4).angle)).toBeLessThan(1e-9);
    expect(make(3).angle).toBeCloseTo(0.4, 9);
  });

  it('rodando: el disco baja con g sen α / 1,5, el aro con g sen α / 2 y la caja sin roce con g sen α', () => {
    const w = new World();
    w.g = { x: 0, y: -G_EARTH };
    const a = (20 * Math.PI) / 180;
    const s = w.addSurface({ x: -5, y: 2 }, { x: -5 + 10 * Math.cos(a), y: 2 - 10 * Math.sin(a) }, 0, 0);
    const mk = (shape: 'disc' | 'ring' | 'box') => {
      const b = w.addBody({ shape, size: shape === 'box' ? 0.6 : 0.4, size2: 0.6, mass: shape === 'ring' ? 5 : 1, pos: { x: 0, y: 0 }, angle: 0, roll: { surface: s.id, s: 0, v: 0, arrived: null } });
      placeOnSurface(b, w);
      return b;
    };
    const [disc, ring, box] = [mk('disc'), mk('ring'), mk('box')];
    const g = G_EARTH * Math.sin(a);
    expect(rollAcceleration(disc, w)).toBeCloseTo(g / 1.5, 9);
    expect(rollAcceleration(ring, w)).toBeCloseTo(g / 2, 9);
    expect(rollAcceleration(box, w)).toBeCloseTo(g, 9);
    const sim = new Simulation(w);
    sim.maxTime = 60;
    sim.start();
    run(sim, 1);
    expect(disc.roll!.s).toBeCloseTo(0.5 * (g / 1.5), 6);
    run(sim, 5);
    // la caja llega primero, después el disco y al final el aro, aunque el aro tenga cinco veces más masa
    expect(box.roll!.arrived!).toBeLessThan(disc.roll!.arrived!);
    expect(disc.roll!.arrived!).toBeLessThan(ring.roll!.arrived!);
  });

  it('t = 0 y la línea de tiempo devuelven los cuerpos exactamente', () => {
    const w = new World();
    w.g = { x: 0, y: -G_EARTH };
    const b = w.addBody({ shape: 'rod', size: 2, mass: 1, pos: { x: 0, y: 0 }, angle: 0.4, pivot: { at: { x: 0, y: 0 }, local: { x: -1, y: 0 } } });
    placeOnPivot(b);
    const sim = new Simulation(w);
    sim.maxTime = 60;
    sim.start();
    run(sim, 1);
    const at1 = b.angle;
    run(sim, 1);
    sim.seek(1);
    expect(b.angle).toBeCloseTo(at1, 12);
    sim.reset();
    expect(b.angle).toBeCloseTo(0.4, 12);
  });

  it('los cuerpos y sus cargas se guardan con el mundo', () => {
    const w = new World();
    const b = w.addBody({ shape: 'rod', size: 4, mass: 0.5, pos: { x: 1, y: 2 }, angle: 0.1, pivot: { at: { x: 1, y: 2 }, local: { x: 0, y: 0 }, limit: 0.4, movable: true } });
    w.addLoad(b, -1, 2, true);
    const back = worldFromJSON(JSON.parse(JSON.stringify(worldToJSON(w))));
    expect(back.bodies).toHaveLength(1);
    expect(back.bodies[0].pivot).toEqual(b.pivot);
    expect(back.bodies[0].loads).toEqual(b.loads);
  });
});

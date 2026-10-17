import { describe, expect, it } from 'vitest';
import type { SurfaceLike } from '../src/physics/contact';
import { SurfaceConstraint } from '../src/physics/constraints';
import { FrictionForce, NormalForce, UniformGravity, WorldDrag, type MediumId } from '../src/physics/forces';
import { systemEnergy } from '../src/physics/energy';
import { Simulation } from '../src/physics/simulation';
import type { Body } from '../src/physics/state';

const G = 9.8;
const deg = (a: number) => (a * Math.PI) / 180;

/** Un mundo con gravedad, superficies con roce y (si se pide) un medio. */
function setup(surfaces: SurfaceLike[], bodies: Body[], medium: MediumId | null = null) {
  const world = { g: { x: 0, y: -G }, particles: bodies, springs: [], gravitation: null };
  const sim = new Simulation(world);
  const sc = new SurfaceConstraint(() => surfaces);
  sim.forces.push(new UniformGravity(), new WorldDrag(() => medium), new NormalForce(sc.contacts), new FrictionForce(sc.contacts));
  sim.constraints.push(sc);
  sim.maxTime = Infinity;
  const energy = () => systemEnergy(world, { x: 0, y: 0 }, sim.heat);
  /** corre y devuelve la mayor desviación relativa del total respecto del inicial */
  const run = (seconds: number) => {
    sim.start();
    const E0 = energy().total;
    let worst = 0;
    for (let k = 0; k < Math.round(seconds * 60); k++) {
      sim.advance(1 / 60);
      worst = Math.max(worst, Math.abs(energy().total - E0));
    }
    return { E0, worst };
  };
  return { sim, run, energy };
}

const floor = (muS: number, muK: number): SurfaceLike => ({ id: 'piso', a: { x: -20, y: 0 }, b: { x: 20, y: 0 }, muS, muK });

describe('calor: el total con Q se conserva', () => {
  it('una caja que frena por roce: K pasa a Q y se detiene a v²/(2 μ g)', () => {
    const p: Body = { id: 'p', pos: { x: 0, y: 0 }, vel: { x: 4, y: 0 }, mass: 1 };
    const { sim, run, energy } = setup([floor(0.4, 0.3)], [p]);
    const { E0, worst } = run(3);
    expect(worst / E0).toBeLessThan(1e-3);
    expect(p.vel.x).toBe(0);
    expect(sim.heat).toBeCloseTo(8, 2); // ½ · 1 · 4²
    expect(p.pos.x).toBeCloseTo(16 / (2 * 0.3 * G), 2);
    expect(energy().mech).toBeCloseTo(0, 6);
  });

  it('bajando una pendiente con roce: Ug se reparte entre K y Q', () => {
    const a = deg(35);
    const t = { x: Math.cos(a), y: -Math.sin(a) };
    const surf: SurfaceLike = { id: 's', a: { x: 0, y: 0 }, b: { x: 12 * t.x, y: 12 * t.y }, muS: 0.3, muK: 0.2 };
    const p: Body = { id: 'p', pos: { x: 0.5 * t.x, y: 0.5 * t.y }, vel: { x: 0, y: 0 }, mass: 2 };
    const { sim, run } = setup([surf], [p]);
    const { E0, worst } = run(1.5);
    expect(worst / Math.abs(E0 || 1)).toBeLessThan(1e-3);
    // Q = μc N d = μc m g cos α · (distancia recorrida)
    const d = Math.hypot(p.pos.x - 0.5 * t.x, p.pos.y - 0.5 * t.y);
    expect(sim.heat).toBeCloseTo(0.2 * 2 * G * Math.cos(a) * d, 2);
  });

  it('cayendo en aire: lo que el arrastre se lleva aparece en Q', () => {
    const p: Body = { id: 'p', pos: { x: 0, y: 30 }, vel: { x: 0, y: 0 }, mass: 1 };
    const { sim, run } = setup([], [p], 'aire');
    const { E0, worst } = run(2);
    expect(worst / E0).toBeLessThan(1e-3);
    expect(sim.heat).toBeGreaterThan(10);
  });

  it('el golpe contra el suelo (sin rebote): toda la K se va en Q', () => {
    const p: Body = { id: 'p', pos: { x: 0, y: 2 }, vel: { x: 0, y: 0 }, mass: 1 };
    const { sim, run } = setup([floor(0.5, 0.4)], [p]);
    const { E0, worst } = run(1.5);
    expect(worst / E0).toBeLessThan(1e-3);
    expect(p.pos.y).toBeCloseTo(0, 9);
    expect(sim.heat).toBeCloseTo(G * 2, 2);
  });

  it('ir a un instante de la línea de tiempo da el mismo calor', () => {
    const p: Body = { id: 'p', pos: { x: 0, y: 0 }, vel: { x: 5, y: 0 }, mass: 1 };
    const { sim, run } = setup([floor(0.4, 0.3)], [p]);
    run(0.5);
    const q = sim.heat;
    run(1);
    sim.seek(0.5);
    expect(sim.heat).toBe(q);
    sim.reset();
    expect(sim.heat).toBe(0);
  });
});

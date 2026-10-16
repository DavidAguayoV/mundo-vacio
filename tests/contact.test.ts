import { describe, expect, it } from 'vitest';
import type { SurfaceLike } from '../src/physics/contact';
import { SurfaceConstraint } from '../src/physics/constraints';
import { FrictionForce, NormalForce, UniformGravity } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import type { Body } from '../src/physics/state';

const G = 9.8;
const deg = (a: number) => (a * Math.PI) / 180;

function setup(surfaces: SurfaceLike[], bodies: Body[]) {
  const world = { g: { x: 0, y: -G }, particles: bodies };
  const sim = new Simulation(world);
  const sc = new SurfaceConstraint(() => surfaces);
  sim.forces.push(new UniformGravity(), new NormalForce(sc.contacts), new FrictionForce(sc.contacts));
  sim.constraints.push(sc);
  sim.maxTime = Infinity;
  const run = (seconds: number) => {
    sim.start();
    for (let k = 0; k < Math.round(seconds * 60); k++) sim.advance(1 / 60);
  };
  return { sim, sc, run };
}

/** Plano inclinado en α que pasa por el origen, y una partícula apoyada en él a 2 m del borde. */
function incline(alpha: number, muS: number, muK: number) {
  const t = { x: Math.cos(alpha), y: Math.sin(alpha) };
  const surf: SurfaceLike = { id: 's', a: { x: 0, y: 0 }, b: { x: 10 * t.x, y: 10 * t.y }, muS, muK };
  const p: Body = { id: 'p', pos: { x: 5 * t.x, y: 5 * t.y }, vel: { x: 0, y: 0 }, mass: 2 };
  return { surf, p, t };
}

describe('superficies: normal y roce', () => {
  it('en reposo sobre una pendiente con tan α < μₛ, no se mueve', () => {
    const { surf, p } = incline(deg(25), 0.6, 0.4); // tan 25° ≈ 0,47
    const start = { ...p.pos };
    const { sim, run } = setup([surf], [p]);
    run(5);
    expect(Math.hypot(p.pos.x - start.x, p.pos.y - start.y)).toBeLessThan(1e-9);
    // N = m g cos α y f = m g sen α (estático)
    const f = sim.forcesOn('p')!;
    const N = f.parts.find((q) => q.kind === 'normal')!;
    const fr = f.parts.find((q) => q.kind === 'friction')!;
    expect(Math.hypot(N.F.x, N.F.y)).toBeCloseTo(2 * G * Math.cos(deg(25)), 9);
    expect(Math.hypot(fr.F.x, fr.F.y)).toBeCloseTo(2 * G * Math.sin(deg(25)), 9);
    expect(fr.note).toBe('estático');
  });

  it('si tan α > μₛ desliza con a = g (sen α − μc cos α)', () => {
    const alpha = deg(40);
    const { surf, p, t } = incline(alpha, 0.6, 0.4); // tan 40° ≈ 0,84
    const start = { ...p.pos };
    const { sim, run } = setup([surf], [p]);
    run(1);
    const a = G * (Math.sin(alpha) - 0.4 * Math.cos(alpha));
    const s = -((p.pos.x - start.x) * t.x + (p.pos.y - start.y) * t.y); // baja: hacia −t
    expect(s).toBeCloseTo(0.5 * a * 1, 6);
    expect(sim.forcesOn('p')!.parts.find((q) => q.kind === 'friction')!.note).toBe('cinético');
  });

  it('una partícula que cae sobre el suelo se queda apoyada y N = m g', () => {
    const floor: SurfaceLike = { id: 'f', a: { x: -5, y: -1 }, b: { x: 5, y: -1 }, muS: 0.5, muK: 0.3 };
    const p: Body = { id: 'p', pos: { x: 0, y: 2 }, vel: { x: 0, y: 0 }, mass: 3 };
    const { sim, sc, run } = setup([floor], [p]);
    run(2);
    expect(p.pos.y).toBeCloseTo(-1, 12);
    expect(Math.hypot(p.vel.x, p.vel.y)).toBeLessThan(1e-12);
    expect(sc.contacts.get('p')).toBeDefined();
    const N = sim.forcesOn('p')!.parts.find((q) => q.kind === 'normal')!;
    expect(N.F.y).toBeCloseTo(3 * G, 9);
    expect(sim.forcesOn('p')!.accel.y).toBeCloseTo(0, 9);
  });

  it('deslizando sobre el suelo se detiene a v₀² / (2 μc g)', () => {
    const floor: SurfaceLike = { id: 'f', a: { x: -10, y: 0 }, b: { x: 10, y: 0 }, muS: 0.5, muK: 0.4 };
    const p: Body = { id: 'p', pos: { x: 0, y: 0 }, vel: { x: 3, y: 0 }, mass: 1 };
    const { run } = setup([floor], [p]);
    run(3);
    expect(p.pos.x).toBeCloseTo(9 / (2 * 0.4 * G), 3);
    expect(p.vel.x).toBe(0);
  });

  it('se cae por el borde de la superficie', () => {
    const shelf: SurfaceLike = { id: 'f', a: { x: -1, y: 0 }, b: { x: 1, y: 0 }, muS: 0, muK: 0 };
    const p: Body = { id: 'p', pos: { x: 0, y: 0 }, vel: { x: 2, y: 0 }, mass: 1 };
    const { sc, run } = setup([shelf], [p]);
    run(1);
    expect(sc.contacts.get('p')).toBeUndefined();
    expect(p.pos.y).toBeLessThan(-1);
  });

  it('no atraviesa la superficie aunque caiga rápido', () => {
    const floor: SurfaceLike = { id: 'f', a: { x: -5, y: 0 }, b: { x: 5, y: 0 }, muS: 0.5, muK: 0.3 };
    const p: Body = { id: 'p', pos: { x: 0, y: 0.5 }, vel: { x: 0, y: -60 }, mass: 1 };
    const { run } = setup([floor], [p]);
    run(1);
    expect(p.pos.y).toBeCloseTo(0, 12);
  });

  it('la masa no cambia el movimiento sobre la pendiente', () => {
    const alpha = deg(35);
    const a = incline(alpha, 0.3, 0.2);
    const b = incline(alpha, 0.3, 0.2);
    b.p.id = 'q';
    b.p.mass = 40;
    const { run } = setup([a.surf], [a.p, b.p]);
    run(1);
    expect(a.p.pos.x).toBeCloseTo(b.p.pos.x, 12);
    expect(a.p.pos.y).toBeCloseTo(b.p.pos.y, 12);
  });
});

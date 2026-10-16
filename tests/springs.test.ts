import { describe, expect, it } from 'vitest';
import { SpringForces, UniformGravity } from '../src/physics/forces';
import { OscillationMeter } from '../src/physics/oscillationMeter';
import { Simulation } from '../src/physics/simulation';
import { worldFromJSON, worldToJSON } from '../src/world/serialize';
import { World } from '../src/world/world';

/** Partícula colgada de un punto fijo, estirada `stretch` m bajo su equilibrio. */
function hanging(mass: number, k: number, stretch: number) {
  const world = new World();
  world.g = { x: 0, y: -9.8 };
  const anchor = { x: 0, y: 3 };
  const L0 = 1.5;
  const eq = L0 + (mass * 9.8) / k; // largo de equilibrio
  const p = world.addParticle({ x: 0, y: anchor.y - eq - stretch }, mass);
  const sp = world.addSpring({ anchor }, { particle: p.id }, k, L0);
  const sim = new Simulation(world);
  sim.forces.push(new UniformGravity(), new SpringForces(() => world.springs));
  const meter = new OscillationMeter(sim, () => world.springs.map((s) => ({ id: s.id, length: world.springLength(s) })));
  return { world, sim, p, sp, meter, eq, anchor };
}

const run = (sim: Simulation, seconds: number) => {
  sim.start();
  for (let k = 0; k < seconds * 60; k++) sim.advance(1 / 60);
};

describe('resortes', () => {
  it('ley de Hooke: el doble de estiramiento da el doble de fuerza', () => {
    const w = new World();
    const p = w.addParticle({ x: 2, y: 0 }, 1);
    w.addSpring({ anchor: { x: 0, y: 0 } }, { particle: p.id }, 30, 1);
    const sim = new Simulation(w);
    const f = new SpringForces(() => w.springs);
    sim.forces.push(f);
    const F1 = sim.forcesOn(p.id)!.parts[0].F.x; // estirado 1 m
    p.pos.x = 3; // estirado 2 m
    const F2 = sim.forcesOn(p.id)!.parts[0].F.x;
    expect(F1).toBeCloseTo(-30, 12);
    expect(F2).toBeCloseTo(2 * F1, 12);
  });

  it('el período medido coincide con 2π√(m/k) y no depende de la amplitud', () => {
    const T = 2 * Math.PI * Math.sqrt(2 / 20);
    const small = hanging(2, 20, 0.3);
    const large = hanging(2, 20, 0.9);
    run(small.sim, 5);
    run(large.sim, 5);
    const Ts = small.meter.period(small.sp.id)!;
    const Tl = large.meter.period(large.sp.id)!;
    // el cronómetro tiene la resolución de un paso (1/240 s)
    expect(Math.abs(Ts - T)).toBeLessThan(1 / 240 + 1e-9);
    expect(Math.abs(Tl - T)).toBeLessThan(1 / 240 + 1e-9);
  });

  it('con cuatro veces la masa, el período se duplica', () => {
    const a = hanging(1, 20, 0.5);
    const b = hanging(4, 20, 0.5);
    run(a.sim, 6);
    run(b.sim, 6);
    expect(b.meter.period(b.sp.id)! / a.meter.period(a.sp.id)!).toBeCloseTo(2, 1);
  });

  it('si parte del reposo, mide el período al completar una sola oscilación', () => {
    const h = hanging(4, 20, 0.8);
    const T = 2 * Math.PI * Math.sqrt(4 / 20);
    h.sim.start();
    for (let k = 0; k < Math.ceil(T * 1.05 * 60); k++) h.sim.advance(1 / 60);
    expect(h.meter.period(h.sp.id)).not.toBeNull();
    expect(Math.abs(h.meter.period(h.sp.id)! - T)).toBeLessThan(2 / 240);
  });

  it('avisa la primera oscilación completa una sola vez por lanzamiento', () => {
    const h = hanging(1, 20, 0.5);
    const calls: number[] = [];
    h.meter.onFirstPeriod = (_id, T) => calls.push(T);
    run(h.sim, 4);
    expect(calls).toHaveLength(1);
    h.sim.reset();
    run(h.sim, 4);
    expect(calls).toHaveLength(2);
  });

  it('en reposo en el equilibrio no mide nada', () => {
    const h = hanging(1, 20, 0);
    run(h.sim, 3);
    expect(h.meter.period(h.sp.id)).toBeNull();
  });

  it('se guardan en el experimento y se borran con su partícula', () => {
    const h = hanging(1, 20, 0.5);
    const back = worldFromJSON(JSON.parse(JSON.stringify(worldToJSON(h.world))));
    expect(back.springs).toEqual(h.world.springs);
    back.removeParticle(h.p.id);
    expect(back.springs).toHaveLength(0);
    // un experimento de antes de los resortes sigue cargando
    const old = worldToJSON(new World());
    delete old.springs;
    expect(worldFromJSON(old).springs).toEqual([]);
  });
});

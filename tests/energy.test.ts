import { describe, expect, it } from 'vitest';
import { EXAMPLES } from '../src/lab/examples';
import { systemEnergy } from '../src/physics/energy';
import { G_GAME, SpringForces, UniformGravity, WorldGravitation } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { worldFromJSON } from '../src/world/serialize';
import { World } from '../src/world/world';

/** Corre el mundo y devuelve la mayor deriva relativa del total respecto al inicial. */
function drift(world: World, seconds: number): { rel: number; E0: number } {
  const sim = new Simulation(world);
  sim.forces.push(new UniformGravity(), new SpringForces(() => world.springs), new WorldGravitation(() => world.gravitation));
  sim.maxTime = 60;
  const E0 = systemEnergy(world).total;
  // escala: la mayor energía en juego, para que la deriva relativa tenga sentido aunque el total sea cercano a 0
  let scale = 0;
  let worst = 0;
  sim.onStep.push(() => {
    const e = systemEnergy(world);
    scale = Math.max(scale, Math.abs(e.K), Math.abs(e.Ug), Math.abs(e.Ue), Math.abs(e.UG));
    worst = Math.max(worst, Math.abs(e.total - E0));
  });
  sim.start();
  for (let k = 0; k < seconds * 60; k++) sim.advance(1 / 60);
  return { rel: worst / scale, E0 };
}

describe('energía', () => {
  it('K = ½mv² y Ug = mgh medida desde el origen', () => {
    const w = new World();
    w.g = { x: 0, y: -9.8 };
    w.addParticle({ x: 1, y: 2 }, 3, { x: 4, y: 0 });
    const e = systemEnergy(w, { x: 0, y: -1 });
    expect(e.K).toBeCloseTo(0.5 * 3 * 16, 12);
    expect(e.Ug).toBeCloseTo(3 * 9.8 * 3, 12);
    expect(e.total).toBeCloseTo(e.K + e.Ug, 12);
  });

  it('mover el origen cambia Ug en una constante: las diferencias no cambian', () => {
    const w = new World();
    w.g = { x: 0, y: -9.8 };
    const p = w.addParticle({ x: 0, y: 4 }, 2);
    const a0 = systemEnergy(w, { x: 0, y: 0 }).Ug;
    const b0 = systemEnergy(w, { x: 0, y: -1.5 }).Ug;
    p.pos.y = 1;
    const a1 = systemEnergy(w, { x: 0, y: 0 }).Ug;
    const b1 = systemEnergy(w, { x: 0, y: -1.5 }).Ug;
    expect(b0 - a0).toBeCloseTo(2 * 9.8 * 1.5, 12);
    expect(b1 - a1).toBeCloseTo(b0 - a0, 12);
    expect(b1 - b0).toBeCloseTo(a1 - a0, 12);
  });

  it('con g inclinada, h se mide a lo largo de −g', () => {
    const w = new World();
    w.g = { x: 9.8, y: 0 }; // «abajo» es +x
    w.addParticle({ x: -2, y: 7 }, 1);
    expect(systemEnergy(w).Ug).toBeCloseTo(9.8 * 2, 12);
  });

  it('se conserva en una caída y en un tiro (deriva < 0,1 %)', () => {
    const w = new World();
    w.g = { x: 0, y: -9.8 };
    w.addParticle({ x: 0, y: 4 }, 1);
    w.addParticle({ x: -3, y: 0 }, 4, { x: 3, y: 9 });
    expect(drift(w, 3).rel).toBeLessThan(1e-3);
  });

  it('se conserva en un resorte con gravedad: K, Ug y Ue se pasan la energía', () => {
    const w = worldFromJSON(EXAMPLES.find((e) => e.id === 'resorte')!.build().world);
    expect(drift(w, 6).rel).toBeLessThan(1e-3);
  });

  it('se conserva en una órbita con la energía potencial suavizada', () => {
    const w = worldFromJSON(EXAMPLES.find((e) => e.id === 'orbita')!.build().world);
    expect(w.gravitation).toEqual({ G: G_GAME });
    expect(drift(w, 12).rel).toBeLessThan(1e-3);
  });
});

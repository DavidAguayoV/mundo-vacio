import { describe, expect, it } from 'vitest';
import type { GameEventType } from '../src/core/events';
import { EXAMPLES } from '../src/lab/examples';
import { G_GAME, WorldGravitation } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { RunMonitor } from '../src/story/runMonitor';
import { worldFromJSON, worldToJSON } from '../src/world/serialize';
import { World } from '../src/world/world';

function setup(world: World) {
  const sim = new Simulation(world);
  sim.forces.push(new WorldGravitation(() => world.gravitation));
  sim.maxTime = 60;
  const events: GameEventType[] = [];
  const monitor = new RunMonitor(world, sim, (ev) => events.push(ev.type));
  const run = (seconds: number, each?: () => void) => {
    sim.start();
    for (let k = 0; k < seconds * 60; k++) {
      sim.advance(1 / 60);
      monitor.update();
      each?.();
    }
  };
  return { sim, events, run };
}

/** 64 kg y 1 kg a 3 m; el pequeño parte con `factor` veces la velocidad circular, de lado. */
function twoBodies(factor: number) {
  const w = new World();
  w.gravitation = { G: G_GAME };
  const big = w.addParticle({ x: 0, y: 0 }, 64);
  const vc = Math.sqrt((G_GAME * 65) / 3);
  const small = w.addParticle({ x: 0, y: 3 }, 1, { x: factor * vc, y: 0 });
  return { w, big, small, vc };
}

describe('gravitación entre masas', () => {
  it('las fuerzas son iguales y opuestas, y siguen 1/r²', () => {
    const { w, big, small } = twoBodies(0);
    const sim = new Simulation(w);
    sim.forces.push(new WorldGravitation(() => w.gravitation));
    const Fb = sim.forcesOn(big.id)!.parts[0].F;
    const Fs = sim.forcesOn(small.id)!.parts[0].F;
    expect(Fb.x + Fs.x).toBeCloseTo(0, 12);
    expect(Fb.y + Fs.y).toBeCloseTo(0, 12);
    // a 3 m el suavizado (0,25 m) cambia la fuerza en menos de 1 %
    expect(Math.abs(Fb.y - (G_GAME * 64) / 9) / ((G_GAME * 64) / 9)).toBeLessThan(0.011);
    w.gravitation = null;
    expect(sim.forcesOn(small.id)!.parts).toHaveLength(0);
  });

  it('el ejemplo de órbita circular mantiene el radio, conserva la energía y cumple Kepler', () => {
    const w = worldFromJSON(EXAMPLES.find((e) => e.id === 'orbita')!.build().world);
    const { sim, events, run } = setup(w);
    const [big, small] = w.particles;
    const dist = () => Math.hypot(small.pos.x - big.pos.x, small.pos.y - big.pos.y);
    const energy = () => {
      const r = dist();
      const ke = w.particles.reduce((e, p) => e + 0.5 * p.mass * (p.vel.x ** 2 + p.vel.y ** 2), 0);
      return ke - (G_GAME * big.mass * small.mass) / Math.sqrt(r * r + 0.25 ** 2);
    };
    const E0 = energy();
    let rMin = Infinity;
    let rMax = 0;
    let orbitT: number | null = null;
    run(12, () => {
      rMin = Math.min(rMin, dist());
      rMax = Math.max(rMax, dist());
      if (orbitT === null && events.includes('orbited')) orbitT = sim.t;
    });
    // el suavizado hace la órbita apenas elíptica: el radio varía menos de 3 %
    expect((rMax - rMin) / 3).toBeLessThan(0.03);
    expect(Math.abs(energy() - E0) / Math.abs(E0)).toBeLessThan(1e-6);
    // período de Kepler: 2π r^{3/2} / √(G(M+m))
    const T = (2 * Math.PI * 3 ** 1.5) / Math.sqrt(G_GAME * 65);
    expect(orbitT).not.toBeNull();
    expect(Math.abs(orbitT! - T) / T).toBeLessThan(0.03);
    expect(events).not.toContain('escaped');
  });

  it('con el doble de la velocidad circular se escapa', () => {
    const { w } = twoBodies(2);
    const { events, run } = setup(w);
    run(10);
    expect(events).toContain('escaped');
    expect(events).not.toContain('orbited');
  });

  it('una caída directa no cuenta como vuelta', () => {
    const { w } = twoBodies(0);
    const { events, run } = setup(w);
    run(15);
    expect(events).toContain('fell');
    expect(events).not.toContain('orbited');
  });

  it('se guarda en el experimento', () => {
    const { w } = twoBodies(1);
    const back = worldFromJSON(JSON.parse(JSON.stringify(worldToJSON(w))));
    expect(back.gravitation).toEqual({ G: G_GAME });
  });
});

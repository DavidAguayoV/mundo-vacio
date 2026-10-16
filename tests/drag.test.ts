import { describe, expect, it } from 'vitest';
import type { GameEventType } from '../src/core/events';
import { MEDIA, UniformGravity, WorldDrag } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { RunMonitor } from '../src/story/runMonitor';
import { worldFromJSON, worldToJSON } from '../src/world/serialize';
import { World, type Particle } from '../src/world/world';

const G = 9.8;

function fall(masses: number[], medium: 'aire' | 'agua' | null, seconds: number) {
  const w = new World();
  w.g = { x: 0, y: -G };
  w.medium = medium;
  const ps: Particle[] = masses.map((m, i) => w.addParticle({ x: 2 * i, y: 0 }, m));
  const sim = new Simulation(w);
  sim.forces.push(new UniformGravity(), new WorldDrag(() => w.medium));
  sim.maxTime = 60;
  const events: GameEventType[] = [];
  const monitor = new RunMonitor(w, sim, (ev) => events.push(ev.type));
  sim.start();
  for (let k = 0; k < seconds * 60; k++) {
    sim.advance(1 / 60);
    monitor.update();
  }
  return { w, ps, events };
}

const vt = (m: number, medium: 'aire' | 'agua') => Math.sqrt((m * G) / MEDIA[medium].quadratic);

describe('arrastre', () => {
  it('llega a la velocidad terminal √(mg/c)', () => {
    const { ps, events } = fall([1], 'aire', 4);
    expect(Math.abs(-ps[0].vel.y - vt(1, 'aire')) / vt(1, 'aire')).toBeLessThan(1e-4);
    expect(events).toContain('terminal');
  });

  it('con cuatro veces la masa, la velocidad terminal se duplica', () => {
    const { ps } = fall([1, 4], 'aire', 8);
    expect(ps[1].vel.y / ps[0].vel.y).toBeCloseTo(2, 3);
  });

  it('en aire la más masiva llega antes; en el vacío llegan juntas', () => {
    const air = fall([1, 4], 'aire', 1.5);
    expect(air.ps[1].pos.y).toBeLessThan(air.ps[0].pos.y - 0.5);
    const vacuum = fall([1, 4], null, 1.5);
    expect(vacuum.ps[1].pos.y).toBeCloseTo(vacuum.ps[0].pos.y, 12);
    expect(vacuum.events).not.toContain('terminal');
  });

  it('en agua la velocidad terminal es menor', () => {
    const { ps } = fall([1], 'agua', 3);
    expect(Math.abs(-ps[0].vel.y - vt(1, 'agua')) / vt(1, 'agua')).toBeLessThan(1e-4);
    expect(vt(1, 'agua')).toBeLessThan(vt(1, 'aire'));
  });

  it('el medio se guarda en el experimento', () => {
    const w = new World();
    w.medium = 'agua';
    expect(worldFromJSON(JSON.parse(JSON.stringify(worldToJSON(w)))).medium).toBe('agua');
    const bad = { ...worldToJSON(w), medium: 'miel' };
    expect(() => worldFromJSON(bad)).toThrow(/medio/);
  });
});

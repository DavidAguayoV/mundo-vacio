import { describe, expect, it } from 'vitest';
import { ReferenceFrame } from '../src/world/frame';
import { worldFromJSON, worldToJSON } from '../src/world/serialize';
import { World } from '../src/world/world';

describe('serialización del mundo', () => {
  it('ida y vuelta por JSON conserva el experimento', () => {
    const w = new World();
    w.frame = new ReferenceFrame({ x: 1, y: -2 }, 0.4);
    w.g = { x: 0, y: -9.8 };
    w.addParticle({ x: -3, y: 1.5 }, 1, { x: 2, y: 3 });
    w.addParticle({ x: -1.5, y: 3 }, 4);
    const a = w.addVector({ x: 0, y: 0 }, { x: 2, y: 1 });
    const b = w.addVector({ x: 1, y: 1 }, { x: 1, y: 3 });
    w.addSum(a.id, b.id);
    w.targets.push({ id: w.newId('t'), pos: { x: 4, y: 0 }, radius: 0.45 });

    const text = JSON.stringify(worldToJSON(w));
    const back = worldFromJSON(JSON.parse(text));
    expect(worldToJSON(back)).toEqual(worldToJSON(w));

    // los ids nuevos no chocan con los cargados
    const p = back.addParticle({ x: 0, y: 0 });
    expect(back.particles.filter((q) => q.id === p.id)).toHaveLength(1);
    expect(p.label).toBe('3');
  });

  it('rechaza datos inválidos con un mensaje legible', () => {
    expect(() => worldFromJSON({ version: 2 })).toThrow(/Mundo Vacío/);
    expect(() => worldFromJSON({ version: 1, particles: [{ id: 'p1', pos: { x: 0 }, vel: { x: 0, y: 0 }, mass: 1 }] })).toThrow(/partículas/);
  });

  it('borrar un vector borra las sumas que lo usan', () => {
    const w = new World();
    const a = w.addVector({ x: 0, y: 0 }, { x: 1, y: 0 });
    const b = w.addVector({ x: 0, y: 0 }, { x: 0, y: 1 });
    w.addSum(a.id, b.id);
    w.removeVector(b.id);
    expect(w.sums).toHaveLength(0);
  });
});

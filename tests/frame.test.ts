import { describe, expect, it } from 'vitest';
import { ReferenceFrame } from '../src/world/frame';

describe('sistema de referencia', () => {
  const cases: [number, number, number][] = [
    [0, 0, 0],
    [1.3, -2.1, 0.7],
    [-4, 3.5, -2.4],
    [10, 10, Math.PI],
    [0.1, -0.2, (3 * Math.PI) / 2],
  ];

  it('toUser y toGlobal son inversas (vectores libres)', () => {
    for (const [ox, oy, th] of cases) {
      const f = new ReferenceFrame({ x: ox, y: oy }, th);
      for (const v of [{ x: 1.2, y: -0.5 }, { x: -7, y: 3 }, { x: 0, y: 9.8 }]) {
        const back = f.toGlobal(f.toUser(v));
        expect(back.x).toBeCloseTo(v.x, 12);
        expect(back.y).toBeCloseTo(v.y, 12);
        const there = f.toUser(f.toGlobal(v));
        expect(there.x).toBeCloseTo(v.x, 12);
        expect(there.y).toBeCloseTo(v.y, 12);
      }
    }
  });

  it('pointToUser y pointToGlobal son inversas (puntos)', () => {
    for (const [ox, oy, th] of cases) {
      const f = new ReferenceFrame({ x: ox, y: oy }, th);
      for (const p of [{ x: 0, y: 0 }, { x: 2.5, y: -1 }, { x: -3, y: 4 }]) {
        const back = f.pointToGlobal(f.pointToUser(p));
        expect(back.x).toBeCloseTo(p.x, 12);
        expect(back.y).toBeCloseTo(p.y, 12);
      }
    }
  });

  it('girar los ejes cambia las componentes pero no la magnitud', () => {
    const v = { x: 3, y: 4 };
    const f = new ReferenceFrame({ x: 0, y: 0 }, Math.PI / 2);
    const u = f.toUser(v);
    // x del usuario apunta hacia +y global: la componente x es 4 y la y es −3
    expect(u.x).toBeCloseTo(4, 12);
    expect(u.y).toBeCloseTo(-3, 12);
    expect(Math.hypot(u.x, u.y)).toBeCloseTo(5, 12);
  });

  it('mover el origen cambia r pero no los vectores libres', () => {
    const p = { x: 2, y: 1 };
    const a = new ReferenceFrame({ x: 0, y: 0 }, 0.3);
    const b = new ReferenceFrame({ x: -1, y: 2 }, 0.3);
    expect(a.pointToUser(p)).not.toEqual(b.pointToUser(p));
    expect(a.toUser(p)).toEqual(b.toUser(p));
  });
});

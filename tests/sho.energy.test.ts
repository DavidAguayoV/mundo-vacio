import { describe, expect, it } from 'vitest';
import { Spring, makeAccel } from '../src/physics/forces';
import { RK4Integrator } from '../src/physics/integrator';
import { stateFromBodies } from '../src/physics/state';

describe('oscilador armónico con RK4', () => {
  it('conserva la energía durante 60 s (deriva < 0,1 %)', () => {
    const m = 0.8; // kg
    const k = 20; // N/m  → ω = 5 rad/s, T ≈ 1,26 s
    const anchor = { x: 1, y: -0.5 };
    const body = { id: 'p', pos: { x: 1.6, y: 0.3 }, vel: { x: -0.4, y: 1.1 }, mass: m };
    const spring = new Spring({ particle: 'p' }, { anchor }, k, 0);
    const s = stateFromBodies([body]);
    const accel = makeAccel([spring], { g: null });
    const energy = () => {
      const dx = body.pos.x - anchor.x;
      const dy = body.pos.y - anchor.y;
      return 0.5 * m * (body.vel.x ** 2 + body.vel.y ** 2) + 0.5 * k * (dx * dx + dy * dy);
    };
    const E0 = energy();
    const rk4 = new RK4Integrator();
    let maxDrift = 0;
    for (let n = 0; n < 60 * 240; n++) {
      rk4.step(s, 1 / 240, accel);
      maxDrift = Math.max(maxDrift, Math.abs(energy() - E0) / E0);
    }
    expect(s.t).toBeCloseTo(60, 9);
    expect(maxDrift).toBeLessThan(1e-3);
  });

  it('el resorte entre dos partículas cumple la tercera ley', () => {
    const a = { id: 'a', pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, mass: 1 };
    const b = { id: 'b', pos: { x: 2, y: 1 }, vel: { x: 0, y: 0 }, mass: 3 };
    const spring = new Spring({ particle: 'a' }, { particle: 'b' }, 10, 1);
    const s = stateFromBodies([a, b]);
    const Fa = spring.force(0, s);
    const Fb = spring.force(1, s);
    expect(Fa.x + Fb.x).toBeCloseTo(0, 12);
    expect(Fa.y + Fb.y).toBeCloseTo(0, 12);
    // estirado: a es atraída hacia b
    expect(Fa.x).toBeGreaterThan(0);
  });
});

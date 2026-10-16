import type { Vec2 } from '../core/vec';
import type { SystemState } from './state';

/** Escribe en out[i] la aceleración de la partícula i para el estado s. */
export type AccelFn = (s: SystemState, out: Vec2[]) => void;

const grow = (arr: Vec2[], n: number) => {
  while (arr.length < n) arr.push({ x: 0, y: 0 });
};

/**
 * Runge-Kutta de orden 4 sobre el sistema completo (todas las partículas avanzan juntas).
 * Reutiliza sus arreglos internos: no crea objetos por paso salvo los que creen las fuerzas.
 */
export class RK4Integrator {
  private tmp: SystemState = { ids: [], pos: [], vel: [], mass: [], t: 0, index: new Map() };
  private kx: Vec2[][] = [[], [], [], []]; // derivada de la posición (= velocidad) en cada etapa
  private kv: Vec2[][] = [[], [], [], []]; // derivada de la velocidad (= aceleración) en cada etapa

  private ensure(n: number) {
    grow(this.tmp.pos, n);
    grow(this.tmp.vel, n);
    for (let k = 0; k < 4; k++) {
      grow(this.kx[k], n);
      grow(this.kv[k], n);
    }
    this.tmp.pos.length = n;
    this.tmp.vel.length = n;
  }

  /** Avanza s en dt, modificando s.pos[i] y s.vel[i] en el lugar. */
  step(s: SystemState, dt: number, accel: AccelFn): void {
    const n = s.pos.length;
    if (n === 0) {
      s.t += dt;
      return;
    }
    this.ensure(n);
    const { tmp, kx, kv } = this;
    tmp.ids = s.ids;
    tmp.mass = s.mass;
    tmp.index = s.index;

    // k1
    for (let i = 0; i < n; i++) {
      kx[0][i].x = s.vel[i].x;
      kx[0][i].y = s.vel[i].y;
    }
    accel(s, kv[0]);

    // k2, k3, k4
    const h = [dt / 2, dt / 2, dt];
    for (let k = 1; k < 4; k++) {
      const hk = h[k - 1];
      for (let i = 0; i < n; i++) {
        tmp.pos[i].x = s.pos[i].x + hk * kx[k - 1][i].x;
        tmp.pos[i].y = s.pos[i].y + hk * kx[k - 1][i].y;
        tmp.vel[i].x = s.vel[i].x + hk * kv[k - 1][i].x;
        tmp.vel[i].y = s.vel[i].y + hk * kv[k - 1][i].y;
      }
      tmp.t = s.t + hk;
      for (let i = 0; i < n; i++) {
        kx[k][i].x = tmp.vel[i].x;
        kx[k][i].y = tmp.vel[i].y;
      }
      accel(tmp, kv[k]);
    }

    const c = dt / 6;
    for (let i = 0; i < n; i++) {
      s.pos[i].x += c * (kx[0][i].x + 2 * kx[1][i].x + 2 * kx[2][i].x + kx[3][i].x);
      s.pos[i].y += c * (kx[0][i].y + 2 * kx[1][i].y + 2 * kx[2][i].y + kx[3][i].y);
      s.vel[i].x += c * (kv[0][i].x + 2 * kv[1][i].x + 2 * kv[2][i].x + kv[3][i].x);
      s.vel[i].y += c * (kv[0][i].y + 2 * kv[1][i].y + 2 * kv[2][i].y + kv[3][i].y);
    }
    s.t += dt;
  }
}

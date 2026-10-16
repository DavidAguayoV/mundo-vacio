import type { Vec2 } from '../../core/vec';
import type { SystemState } from '../state';
import type { Force, ForceJSON } from './force';

/**
 * Arrastre de un fluido: F = −b v − c |v| v.
 * Preparado para el nivel V del árbol; todavía no se registra en el juego.
 */
export class Drag implements Force {
  readonly kind = 'drag' as const;

  constructor(
    public linear: number, // b, kg/s
    public quadratic: number, // c, kg/m
  ) {}

  force(i: number, s: SystemState): Vec2 {
    const v = s.vel[i];
    const speed = Math.hypot(v.x, v.y);
    const k = this.linear + this.quadratic * speed;
    return { x: -k * v.x, y: -k * v.y };
  }

  toJSON(): ForceJSON {
    return { kind: 'drag', linear: this.linear, quadratic: this.quadratic };
  }
}

import { angleDiff, dist, type Vec2 } from '../core/vec';
import { handlePos } from './hit';
import type { ToolContext } from './tool';

const MIN_ROTATION = (10 * Math.PI) / 180; // giro mínimo para contar como "girar los ejes"
const MIN_MOVE = 0.5; // m que debe moverse el origen para contar como "mover el origen"

/** Arrastre del sistema de referencia: girar desde el asa o trasladar el origen. Lo comparten Origen y Mover. */
export class FrameDrag {
  private constructor(
    private kind: 'rotate' | 'move',
    private startAngle: number,
    private startOrigin: Vec2 | null,
    private grab: Vec2 = { x: 0, y: 0 },
  ) {}

  /** Empieza un arrastre si el puntero está sobre el asa o el origen. */
  static tryStart(p: Vec2, tol: number, ctx: ToolContext, allowOrigin = true): FrameDrag | null {
    const f = ctx.world.frame;
    if (!f) return null;
    const h = handlePos(ctx.world);
    if (h && dist(h, p) <= tol * 1.2) return new FrameDrag('rotate', f.angle, { ...f.origin });
    if (allowOrigin && dist(f.origin, p) <= tol) {
      return new FrameDrag('move', f.angle, { ...f.origin }, { x: f.origin.x - p.x, y: f.origin.y - p.y });
    }
    return null;
  }

  /** Traslada el origen a p (al colocarlo o al tocar en otro lugar con Origen). */
  static moveTo(previous: Vec2 | null, angle: number): FrameDrag {
    return new FrameDrag('move', angle, previous);
  }

  move(p: Vec2, ctx: ToolContext): void {
    const f = ctx.world.frame;
    if (!f) return;
    if (this.kind === 'rotate') {
      f.angle = Math.atan2(p.y - f.origin.y, p.x - f.origin.x);
    } else {
      f.origin = { x: p.x + this.grab.x, y: p.y + this.grab.y };
    }
  }

  end(ctx: ToolContext): void {
    const f = ctx.world.frame;
    if (!f) return;
    if (this.kind === 'rotate') {
      if (angleDiff(f.angle, this.startAngle) >= MIN_ROTATION) ctx.emit({ type: 'frame-rotated' });
    } else if (this.startOrigin && dist(f.origin, this.startOrigin) > MIN_MOVE && ctx.world.particles.length) {
      ctx.emit({ type: 'origin-moved' });
    }
  }
}

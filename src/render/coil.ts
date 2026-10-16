import type { Vec2 } from '../core/vec';
import type { Painter } from './painter';

/**
 * Dibuja un resorte como un zigzag entre a y b. Las vueltas son siempre las mismas,
 * así que al estirarlo se separan y al comprimirlo se juntan, como uno real.
 */
export function drawCoil(p: Painter, a: Vec2, b: Vec2, color: string, width = 1.6, coils = 9): void {
  const { ctx, view } = p;
  const x1 = view.sx(a.x);
  const y1 = view.sy(a.y);
  const x2 = view.sx(b.x);
  const y2 = view.sy(b.y);
  const L = Math.hypot(x2 - x1, y2 - y1);
  if (L < 2) return;
  const ux = (x2 - x1) / L;
  const uy = (y2 - y1) / L;
  const nx = -uy;
  const ny = ux;
  const lead = Math.min(10, L * 0.12);
  const amp = 6;
  const n = coils * 2;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 + ux * lead, y1 + uy * lead);
  const body = L - 2 * lead;
  for (let k = 1; k < n; k++) {
    const t = lead + (body * k) / n;
    const side = k % 2 ? 1 : -1;
    ctx.lineTo(x1 + ux * t + nx * amp * side, y1 + uy * t + ny * amp * side);
  }
  ctx.lineTo(x2 - ux * lead, y2 - uy * lead);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.lineJoin = 'miter';
}

/** Punto fijo de un resorte: un pequeño soporte rayado. */
export function drawAnchor(p: Painter, at: Vec2, color: string): void {
  const { ctx, view } = p;
  const x = view.sx(at.x);
  const y = view.sy(at.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 9, y);
  ctx.lineTo(x + 9, y);
  for (let k = -9; k <= 6; k += 5) {
    ctx.moveTo(x + k, y);
    ctx.lineTo(x + k + 4, y - 5);
  }
  ctx.stroke();
  p.disc(at, 2.5, color);
}

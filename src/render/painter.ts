import type { Vec2 } from '../core/vec';
import type { Palette } from './theme';
import type { View } from './view';

/** Primitivas de dibujo en metros: flechas, líneas, rótulos. */
export class Painter {
  constructor(
    public ctx: CanvasRenderingContext2D,
    public view: View,
    public pal: Palette,
  ) {}

  line(a: Vec2, b: Vec2, color: string, width = 1, dash?: number[]): void {
    const { ctx, view } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    ctx.moveTo(view.sx(a.x), view.sy(a.y));
    ctx.lineTo(view.sx(b.x), view.sy(b.y));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  arrow(a: Vec2, b: Vec2, color: string, width = 2, dash?: number[]): void {
    const { ctx, view } = this;
    const x1 = view.sx(a.x);
    const y1 = view.sy(a.y);
    const x2 = view.sx(b.x);
    const y2 = view.sy(b.y);
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 2) return;
    const ux = (x2 - x1) / L;
    const uy = (y2 - y1) / L;
    const hl = Math.min(11, L * 0.4) + width;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - ux * hl * 0.8, y2 - uy * hl * 0.8);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * hl - uy * hl * 0.45, y2 - uy * hl + ux * hl * 0.45);
    ctx.lineTo(x2 - ux * hl + uy * hl * 0.45, y2 - uy * hl - ux * hl * 0.45);
    ctx.closePath();
    ctx.fill();
  }

  label(text: string, p: Vec2, color: string, size = 12, align: CanvasTextAlign = 'left'): void {
    const { ctx, view } = this;
    ctx.fillStyle = color;
    ctx.font = `500 ${size}px ${this.pal.mono}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, view.sx(p.x), view.sy(p.y));
  }

  /** Rótulo al costado del punto medio de un segmento (a la izquierda del sentido a → b). */
  midLabel(text: string, a: Vec2, b: Vec2, color: string, size = 13): void {
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const off = this.view.m(14);
    const nx = (-(b.y - a.y) / L) * off;
    const ny = ((b.x - a.x) / L) * off;
    this.label(text, { x: (a.x + b.x) / 2 + nx, y: (a.y + b.y) / 2 + ny }, color, size, 'center');
  }

  /** Rótulo junto a la punta de una flecha, a un costado (side = 1 izquierda, −1 derecha del sentido a → b). */
  tipLabel(text: string, a: Vec2, b: Vec2, color: string, side: 1 | -1, size = 12): void {
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / L;
    const uy = (b.y - a.y) / L;
    const off = this.view.m(10);
    this.label(text, { x: b.x - ux * off * 0.6 - uy * off * side, y: b.y - uy * off * 0.6 + ux * off * side }, color, size, 'center');
  }

  disc(p: Vec2, rPx: number, color: string): void {
    const { ctx, view } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(view.sx(p.x), view.sy(p.y), rPx, 0, Math.PI * 2);
    ctx.fill();
  }

  ring(p: Vec2, rPx: number, color: string, width = 1.5, dash?: number[]): void {
    const { ctx, view } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    ctx.arc(view.sx(p.x), view.sy(p.y), rPx, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  alpha<T>(a: number, fn: () => T): T {
    const prev = this.ctx.globalAlpha;
    this.ctx.globalAlpha = prev * a;
    try {
      return fn();
    } finally {
      this.ctx.globalAlpha = prev;
    }
  }
}

import type { Vec2 } from '../core/vec';
import { withAlpha, type Palette } from './theme';
import type { View } from './view';

/** Rectángulo en píxeles CSS del lienzo. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Pt {
  x: number;
  y: number;
}

/** Un rótulo que espera su lugar: se prueba cada candidato (centro en px) hasta dar con uno libre. */
interface LabelRequest {
  text: string;
  color: string;
  size: number;
  /** símbolo físico en la serif cursiva (v, g, r₁, mg) o texto de interfaz en la sans (0,50 kg) */
  kind: 'symbol' | 'text';
  candidates: Pt[];
  /** los de menor prioridad se ubican primero */
  priority: number;
}

const SUB: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  'ₐ': 'a', 'ₑ': 'e', 'ₒ': 'o', 'ₓ': 'x', 'ₕ': 'h', 'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₚ': 'p', 'ₛ': 's', 'ₜ': 't', 'ᵧ': 'y', 'ᵥ': 'v', 'ᵢ': 'i',
};

/** «r₁» → [{r, normal}, {1, subíndice}]: Instrument Serif no trae subíndices, así que se dibujan a mano. */
function segments(text: string): { s: string; sub: boolean }[] {
  const out: { s: string; sub: boolean }[] = [];
  for (const ch of text) {
    const sub = ch in SUB;
    const c = sub ? SUB[ch] : ch;
    const last = out.at(-1);
    if (last && last.sub === sub) last.s += c;
    else out.push({ s: c, sub });
  }
  return out;
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Primitivas de dibujo en metros: flechas, líneas, rótulos. */
export class Painter {
  /** zonas que los rótulos evitan: la tarjeta del relato, los paneles, las partículas, las puntas de flecha */
  private obstacles: Rect[] = [];
  private queue: LabelRequest[] = [];

  constructor(
    public ctx: CanvasRenderingContext2D,
    public view: View,
    public pal: Palette,
  ) {}

  /** Al empezar cada cuadro: limpia los rótulos pendientes y registra las zonas ocupadas por la interfaz. */
  beginFrame(avoid: readonly Rect[]): void {
    this.obstacles = avoid.map((r) => ({ ...r }));
    this.queue = [];
  }

  /** Marca una zona del lienzo como ocupada (px). */
  occupy(r: Rect): void {
    this.obstacles.push(r);
  }

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

  arrow(a: Vec2, b: Vec2, color: string, width = 2.4, dash?: number[]): void {
    const { view } = this;
    this.arrowPx(view.sx(a.x), view.sy(a.y), view.sx(b.x), view.sy(b.y), color, width, dash);
  }

  /** Flecha en píxeles: extremos redondeados y punta con la base levemente cóncava, proporcional al trazo. */
  arrowPx(x1: number, y1: number, x2: number, y2: number, color: string, width = 2.4, dash?: number[], occupy = true): void {
    const { ctx } = this;
    const L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 2) return;
    const ux = (x2 - x1) / L;
    const uy = (y2 - y1) / L;
    const hl = Math.min(L * 0.5, 6 + 2.6 * width);
    const hw = hl * 0.4;
    const notch = hl * 0.22;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(dash ?? []);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2 - ux * (hl - notch), y2 - uy * (hl - notch));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - ux * hl - uy * hw, y2 - uy * hl + ux * hw);
    ctx.lineTo(x2 - ux * (hl - notch), y2 - uy * (hl - notch));
    ctx.lineTo(x2 - ux * hl + uy * hw, y2 - uy * hl - ux * hw);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
    if (occupy) {
      const cx = x2 - ux * hl * 0.5;
      const cy = y2 - uy * hl * 0.5;
      const s = Math.max(hl, hw * 2) * 0.6;
      this.occupy({ x: cx - s, y: cy - s, w: 2 * s, h: 2 * s });
    }
  }

  /** Texto de interfaz en un punto (sans). */
  label(text: string, p: Vec2, color: string, size = 12.5, _align: CanvasTextAlign = 'center'): void {
    this.queue.push({ text, color, size, kind: 'text', candidates: [{ x: this.view.sx(p.x), y: this.view.sy(p.y) }], priority: 1 });
  }

  /** Rótulo de texto que prueba varias posiciones (en px). */
  labelAt(text: string, candidates: Pt[], color: string, size = 12.5, kind: 'symbol' | 'text' = 'text', priority = 1): void {
    this.queue.push({ text, color, size, kind, candidates, priority });
  }

  /** Símbolo al costado del punto medio de un segmento (de preferencia a la izquierda del sentido a → b). */
  midLabel(text: string, a: Vec2, b: Vec2, color: string, size = 19): void {
    const { view } = this;
    const ax = view.sx(a.x), ay = view.sy(a.y), bx = view.sx(b.x), by = view.sy(b.y);
    const L = Math.hypot(bx - ax, by - ay) || 1;
    // normal izquierda en pantalla (y hacia abajo)
    const nx = (by - ay) / L;
    const ny = -(bx - ax) / L;
    const off = 15;
    const at = (t: number, s: number) => ({ x: ax + (bx - ax) * t + nx * off * s, y: ay + (by - ay) * t + ny * off * s });
    this.labelAt(text, [at(0.5, 1), at(0.5, -1), at(0.3, 1), at(0.7, 1), at(0.3, -1), at(0.7, -1)], color, size, 'symbol', 0);
  }

  /** Símbolo junto a la punta de una flecha (side = 1 izquierda, −1 derecha del sentido a → b). */
  tipLabel(text: string, a: Vec2, b: Vec2, color: string, side: 1 | -1, size = 19): void {
    const { view } = this;
    const ax = view.sx(a.x), ay = view.sy(a.y), bx = view.sx(b.x), by = view.sy(b.y);
    const L = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / L;
    const uy = (by - ay) / L;
    const nx = uy;
    const ny = -ux;
    const off = 13;
    const at = (back: number, s: number) => ({ x: bx - ux * back + nx * off * s, y: by - uy * back + ny * off * s });
    const beyond = { x: bx + ux * 14, y: by + uy * 14 };
    this.labelAt(text, [at(8, side), at(8, -side), beyond, at(L * 0.45, side), at(L * 0.45, -side)], color, size, 'symbol', 0);
  }

  /** Ubica y dibuja todos los rótulos del cuadro, encima de todo y sin pisarse. */
  flushLabels(): void {
    const { ctx, view } = this;
    const queue = this.queue.sort((a, b) => a.priority - b.priority);
    this.queue = [];
    for (const r of queue) {
      const w = this.measure(r);
      const h = r.size * 0.95;
      let chosen: Rect | null = null;
      for (const c of r.candidates) {
        const rect = { x: c.x - w / 2 - 4, y: c.y - h / 2 - 1, w: w + 8, h: h + 2 };
        const inside = rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= view.W && rect.y + rect.h <= view.H;
        if (inside && !this.obstacles.some((o) => overlaps(o, rect))) {
          chosen = rect;
          break;
        }
      }
      // sin lugar libre: el primer candidato, salvo que quede tapado por la interfaz
      if (!chosen) {
        const c = r.candidates[0];
        chosen = { x: c.x - w / 2 - 4, y: c.y - h / 2 - 1, w: w + 8, h: h + 2 };
      }
      this.obstacles.push(chosen);
      this.drawLabel(r, chosen.x + 4, chosen.y + 1 + h / 2, w);
    }
    ctx.textAlign = 'left';
  }

  private font(kind: 'symbol' | 'text', size: number, sub = false): string {
    if (kind === 'text') return `500 ${size}px ${this.pal.sans}`;
    return sub ? `400 ${size * 0.66}px ${this.pal.serif}` : `italic 400 ${size}px ${this.pal.serif}`;
  }

  private measure(r: LabelRequest): number {
    const { ctx } = this;
    if (r.kind === 'text') {
      ctx.font = this.font('text', r.size);
      return ctx.measureText(r.text).width;
    }
    let w = 0;
    for (const seg of segments(r.text)) {
      ctx.font = this.font('symbol', r.size, seg.sub);
      w += ctx.measureText(seg.s).width + (seg.sub ? 0.5 : 0);
    }
    return w;
  }

  /** Dibuja un rótulo con un contorno del color del vacío, para que se lea aunque cruce una línea. */
  private drawLabel(r: LabelRequest, x: number, y: number, _w: number): void {
    const { ctx, pal } = this;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = withAlpha(pal.bg, 0.85);
    ctx.lineWidth = 4;
    ctx.fillStyle = r.color;
    const parts = r.kind === 'text' ? [{ s: r.text, sub: false }] : segments(r.text);
    // la serif se asienta algo baja: se sube un poco para centrarla en la caja
    const baseY = r.kind === 'symbol' ? y - r.size * 0.04 : y;
    for (const seg of parts) {
      ctx.font = this.font(r.kind, r.size, seg.sub);
      const yy = seg.sub ? baseY + r.size * 0.28 : baseY;
      const xx = seg.sub ? x + 0.5 : x;
      ctx.strokeText(seg.s, xx, yy);
      ctx.fillText(seg.s, xx, yy);
      x = xx + ctx.measureText(seg.s).width;
    }
    ctx.lineJoin = 'miter';
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

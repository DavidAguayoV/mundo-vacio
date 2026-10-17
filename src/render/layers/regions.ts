import { fmt } from '../../core/format';
import type { Scene } from '../scene';
import { withAlpha } from '../theme';

/**
 * Regiones con su propia gravedad: un recuadro apenas teñido, su nombre y su |g| en la esquina,
 * y dos flechas grandes y translúcidas que dicen hacia dónde es «abajo» ahí dentro.
 */
export function regionsLayer(scene: Scene): void {
  const { world, view } = scene;
  if (!world.regions.length) return;
  const p = scene.painter;
  const { ctx, pal } = p;
  for (const r of world.regions) {
    const x0 = view.sx(r.min.x);
    const x1 = view.sx(r.max.x);
    const y0 = view.sy(r.max.y);
    const y1 = view.sy(r.min.y);
    const w = x1 - x0;
    const h = y1 - y0;
    ctx.fillStyle = withAlpha(pal.acc, r.g ? 0.035 : 0.015);
    ctx.fillRect(x0, y0, w, h);
    ctx.strokeStyle = withAlpha(pal.muted, 0.35);
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);

    const g = r.g;
    const L = g ? Math.hypot(g.x, g.y) : 0;
    if (g && L > 0) {
      const dx = g.x / L;
      const dy = -g.y / L;
      const len = Math.min(90, Math.min(w, h) * 0.3);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y0, w, h);
      ctx.clip();
      p.alpha(0.08, () => {
        for (const k of [0.3, 0.7]) {
          // dos flechas a lo ancho de la región, perpendiculares a g
          const cx = x0 + w * (Math.abs(dx) > Math.abs(dy) ? 0.5 : k);
          const cy = y0 + h * (Math.abs(dx) > Math.abs(dy) ? k : 0.5);
          p.arrowPx(cx - (dx * len) / 2, cy - (dy * len) / 2, cx + (dx * len) / 2, cy + (dy * len) / 2, pal.acc, 6, undefined, false);
        }
      });
      ctx.restore();
    }
    const label = `${r.name ? `${r.name}, ` : ''}${g ? `g = ${fmt(L)} m/s²` : 'sin gravedad'}`;
    // en la esquina que esté libre (la tarjeta del relato suele tapar alguna)
    const half = p.textWidth(label, 12) / 2;
    const corners = [
      { x: x0 + 12 + half, y: y0 + 16 },
      { x: x1 - 12 - half, y: y0 + 16 },
      { x: x0 + 12 + half, y: y1 - 14 },
      { x: x1 - 12 - half, y: y1 - 14 },
    ];
    p.labelAt(label, corners, pal.muted, 12, 'text', -1, true);
  }
}

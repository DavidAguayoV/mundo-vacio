import { fmt } from '../../core/format';
import type { Vec2 } from '../../core/vec';
import type { ReferenceFrame } from '../../world/frame';
import { HANDLE_DIST } from '../scales';
import type { Scene } from '../scene';
import { withAlpha } from '../theme';

/** Rango de coordenadas del usuario que cubre la pantalla (con margen de 1 m). */
function visibleRange(frame: ReferenceFrame, scene: Scene) {
  const b = scene.view.bounds();
  const corners: Vec2[] = [
    { x: b.minX, y: b.minY },
    { x: b.maxX, y: b.minY },
    { x: b.minX, y: b.maxY },
    { x: b.maxX, y: b.maxY },
  ].map((c) => frame.pointToUser(c));
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  return {
    i0: Math.floor(Math.min(...xs)) - 1,
    i1: Math.ceil(Math.max(...xs)) + 1,
    j0: Math.floor(Math.min(...ys)) - 1,
    j1: Math.ceil(Math.max(...ys)) + 1,
  };
}

/**
 * Alcance de la luz del origen, en px: la malla, las marcas y los números se apagan al alejarse de O.
 * El sistema de referencia ilumina un trozo del vacío; más allá, el vacío sigue intacto.
 */
const reach = (scene: Scene) => 0.4 * Math.hypot(scene.view.W, scene.view.H);

/** Intensidad (0 a 1) a d px del origen. */
const falloff = (d: number, R: number) => {
  const t = Math.max(0, 1 - d / R);
  return t * t;
};

/** Luz tenue alrededor del origen y malla de 1 m (un punto por nodo) que se desvanece con la distancia. */
export function gridLayer(scene: Scene): void {
  const frame = scene.world.frame;
  if (!frame) return;
  const { ctx, pal } = scene.painter;
  const { view } = scene;
  const O = frame.origin;
  const ox = view.sx(O.x);
  const oy = view.sy(O.y);
  const R = reach(scene);

  const glow = ctx.createRadialGradient(ox, oy, 0, ox, oy, R * 1.15);
  glow.addColorStop(0, withAlpha(pal.glow, pal.glowAlpha));
  glow.addColorStop(0.45, withAlpha(pal.glow, pal.glowAlpha * 0.4));
  glow.addColorStop(1, withAlpha(pal.glow, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, view.W, view.H);

  const { i0, i1, j0, j1 } = visibleRange(frame, scene);
  const ex = frame.ex;
  const ey = frame.ey;
  // los puntos se agrupan por intensidad: pocas pasadas de relleno en vez de una por punto
  const LEVELS = 6;
  const buckets: number[][] = Array.from({ length: LEVELS }, () => []);
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      if (i === 0 || j === 0) continue; // sobre los ejes ya hay marcas
      const px = view.sx(O.x + i * ex.x + j * ey.x);
      const py = view.sy(O.y + i * ex.y + j * ey.y);
      if (px < -4 || px > view.W + 4 || py < -4 || py > view.H + 4) continue;
      const f = falloff(Math.hypot(px - ox, py - oy), R);
      if (f <= 0.02) continue;
      buckets[Math.min(LEVELS - 1, Math.floor(f * LEVELS))].push(px, py);
    }
  }
  ctx.fillStyle = pal.grid;
  buckets.forEach((pts, k) => {
    if (!pts.length) return;
    ctx.globalAlpha = 0.85 * ((k + 0.5) / LEVELS);
    ctx.beginPath();
    for (let n = 0; n < pts.length; n += 2) ctx.rect(pts[n] - 0.9, pts[n + 1] - 0.9, 1.8, 1.8);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

/** Ejes del usuario: líneas que se apagan hacia los bordes, números cada 2 m, flechas x e y, el origen O y el asa para girar. */
export function axesLayer(scene: Scene): void {
  const frame = scene.world.frame;
  if (!frame) return;
  const p = scene.painter;
  const { ctx, pal } = p;
  const { view } = scene;
  const O = frame.origin;
  const ex = frame.ex;
  const ey = frame.ey;
  const at = (u: number, v: number): Vec2 => ({ x: O.x + u * ex.x + v * ey.x, y: O.y + u * ex.y + v * ey.y });
  const ox = view.sx(O.x);
  const oy = view.sy(O.y);
  const R = reach(scene);
  const { i0, i1, j0, j1 } = visibleRange(frame, scene);

  // cuatro semiejes, cada uno con un degradado desde O
  const half = (u: number, v: number) => {
    const end = at(u, v);
    const x2 = view.sx(end.x);
    const y2 = view.sy(end.y);
    const L = Math.hypot(x2 - ox, y2 - oy);
    if (L < 1) return;
    const k = Math.min(1, R / L);
    const g = ctx.createLinearGradient(ox, oy, ox + (x2 - ox) * k, oy + (y2 - oy) * k);
    g.addColorStop(0, withAlpha(pal.muted, 0.6));
    g.addColorStop(1, withAlpha(pal.muted, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + (x2 - ox) * k, oy + (y2 - oy) * k);
    ctx.stroke();
  };
  half(i1, 0);
  half(i0, 0);
  half(0, j1);
  half(0, j0);

  // marcas cada 1 m y números cada 2 m, con la misma caída de luz
  const tick = view.m(4);
  const num = view.m(14);
  ctx.font = `400 10.5px ${pal.sans}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = pal.muted;
  const mark = (u: number, v: number, k: number, onX: boolean) => {
    const q = at(u, v);
    const f = falloff(Math.hypot(view.sx(q.x) - ox, view.sy(q.y) - oy), R);
    if (f <= 0.02) return;
    p.alpha(0.6 * f, () => p.line(q, onX ? at(u, tick) : at(tick, v), pal.muted, 1));
    if (k % 2 !== 0) return;
    const t = onX ? at(u, -num) : at(-num, v);
    const text = fmt(k, 0);
    const tx = view.sx(t.x);
    const ty = view.sy(t.y);
    ctx.globalAlpha = 0.9 * f;
    ctx.fillText(text, tx, ty);
    ctx.globalAlpha = 1;
    // los números visibles también son obstáculos para los rótulos
    if (f > 0.15) {
      const w = ctx.measureText(text).width;
      p.occupy({ x: tx - w / 2 - 2, y: ty - 7, w: w + 4, h: 14 });
    }
  };
  for (let k = i0; k <= i1; k++) if (k !== 0) mark(k, 0, k, true);
  for (let k = j0; k <= j1; k++) if (k !== 0) mark(0, k, k, false);

  p.arrow(O, at(HANDLE_DIST, 0), pal.ink, 1.5);
  p.arrow(O, at(0, 2.2), pal.ink, 1.5);

  // asa para girar los ejes
  p.alpha(0.8, () => p.ring(at(HANDLE_DIST, 0), 9, pal.vec, 1.25));

  p.disc(O, 3.2, pal.ink);
  const px = (q: Vec2) => ({ x: view.sx(q.x), y: view.sy(q.y) });
  p.labelAt('x', [px(at(HANDLE_DIST + view.m(22), view.m(10)))], pal.ink, 20, 'symbol', -1);
  p.labelAt('y', [px(at(view.m(14), 2.2 + view.m(2)))], pal.ink, 20, 'symbol', -1);
  p.labelAt('O', [px(at(-view.m(13), -view.m(13)))], pal.ink, 18, 'symbol', -1);
}

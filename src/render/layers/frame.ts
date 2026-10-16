import { fmt } from '../../core/format';
import type { Vec2 } from '../../core/vec';
import type { ReferenceFrame } from '../../world/frame';
import { HANDLE_DIST } from '../scales';
import type { Scene } from '../scene';

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

/** Malla de 1 m alineada con los ejes del usuario: un punto en cada nodo. */
export function gridLayer(scene: Scene): void {
  const frame = scene.world.frame;
  if (!frame) return;
  const { ctx, pal } = scene.painter;
  const { view } = scene;
  const { i0, i1, j0, j1 } = visibleRange(frame, scene);
  const ex = frame.ex;
  const ey = frame.ey;
  const O = frame.origin;
  ctx.fillStyle = pal.grid;
  ctx.beginPath();
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const px = view.sx(O.x + i * ex.x + j * ey.x);
      const py = view.sy(O.y + i * ex.y + j * ey.y);
      if (px < -4 || px > view.W + 4 || py < -4 || py > view.H + 4) continue;
      ctx.rect(px - 1, py - 1, 2, 2);
    }
  }
  ctx.fill();
}

/** Ejes del usuario con marcas cada 1 m, flechas x e y, el origen O y el asa para girar. */
export function axesLayer(scene: Scene): void {
  const frame = scene.world.frame;
  if (!frame) return;
  const p = scene.painter;
  const { pal } = p;
  const { view } = scene;
  const O = frame.origin;
  const ex = frame.ex;
  const ey = frame.ey;
  const at = (u: number, v: number): Vec2 => ({ x: O.x + u * ex.x + v * ey.x, y: O.y + u * ex.y + v * ey.y });
  const { i0, i1, j0, j1 } = visibleRange(frame, scene);

  p.alpha(0.45, () => {
    p.line(at(i0, 0), at(i1, 0), pal.muted, 1);
    p.line(at(0, j0), at(0, j1), pal.muted, 1);
  });

  // marcas y números
  const tick = view.m(5);
  const num = view.m(13);
  const every = view.S >= 34 ? 1 : 2;
  p.alpha(0.55, () => {
    for (let k = i0; k <= i1; k++) {
      if (k === 0) continue;
      p.line(at(k, 0), at(k, tick), pal.muted, 1);
      if (k % every === 0 && k !== 3) p.label(fmt(k, 0), at(k, -num), pal.muted, 10, 'center');
    }
    for (let k = j0; k <= j1; k++) {
      if (k === 0) continue;
      p.line(at(0, k), at(tick, k), pal.muted, 1);
      if (k % every === 0) p.label(fmt(k, 0), at(-num, k), pal.muted, 10, 'center');
    }
  });

  p.arrow(O, at(HANDLE_DIST, 0), pal.ink, 1.6);
  p.arrow(O, at(0, 2.2), pal.ink, 1.6);
  p.label('x', at(HANDLE_DIST + view.m(16), view.m(10)), pal.ink, 14, 'center');
  p.label('y', at(-view.m(10), 2.2 + view.m(14)), pal.ink, 14, 'center');

  // asa para girar los ejes
  p.ring(at(HANDLE_DIST, 0), 9, pal.vec, 1.5);

  p.disc(O, 3.5, pal.ink);
  p.label('O', at(-view.m(12), -view.m(12)), pal.muted, 12, 'center');
}

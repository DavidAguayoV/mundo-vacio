import type { Vec2 } from '../../core/vec';
import type { Scene } from '../scene';

/** Descomposición de a → b en los ejes del usuario: dos segmentos punteados. */
function components(scene: Scene, a: Vec2, b: Vec2, color: string): void {
  const frame = scene.world.frame;
  if (!frame) return;
  const p = scene.painter;
  const u = frame.toUser({ x: b.x - a.x, y: b.y - a.y });
  const ex = frame.ex;
  const corner = { x: a.x + u.x * ex.x, y: a.y + u.x * ex.y };
  p.alpha(0.6, () => p.line(a, corner, color, 1.2, [3, 3]));
  p.line(corner, b, color, 1.2, [3, 3]);
}

/** Vectores libres en ámbar y sus sumas (cola con punta). */
export function vectorsLayer(scene: Scene): void {
  const p = scene.painter;
  const { pal } = p;
  const sel = scene.selection;

  for (const v of scene.world.vectors) {
    const isSel = sel?.kind === 'vector' && sel.id === v.id;
    const strong = isSel || scene.highlighted.has(v.id);
    p.arrow(v.tail, v.tip, pal.vec, strong ? 3.4 : 2.6);
    p.midLabel(v.label, v.tail, v.tip, pal.vec);
    if (isSel) components(scene, v.tail, v.tip, pal.vec);
  }

  for (const s of scene.world.sums) {
    const geo = scene.world.sumGeometry(s);
    if (!geo) continue;
    const isSel = sel?.kind === 'sum' && sel.id === s.id;
    // B trasladado a la punta de A
    p.alpha(0.55, () => p.arrow(geo.bTail, geo.tip, pal.vec, 1.6, [4, 5]));
    p.arrow(geo.tail, geo.tip, pal.ink, isSel ? 3.6 : 2.8);
    p.midLabel(`${geo.A.label}+${geo.B.label}`, geo.tail, geo.tip, pal.ink);
    if (isSel) components(scene, geo.tail, geo.tip, pal.ink);
  }
}

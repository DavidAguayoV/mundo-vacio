import { drawAnchor, drawCoil } from '../coil';
import type { Scene } from '../scene';

/** Resortes: zigzag entre sus extremos y un soporte en cada punto fijo. */
export function springsLayer(scene: Scene): void {
  const p = scene.painter;
  const { pal } = p;
  const { world } = scene;
  const sel = scene.selection;
  for (const sp of world.springs) {
    const a = world.endPos(sp.a);
    const b = world.endPos(sp.b);
    if (!a || !b) continue;
    const isSel = sel?.kind === 'spring' && sel.id === sp.id;
    const color = pal.ink;
    p.alpha(isSel ? 1 : 0.6, () => drawCoil(p, a, b, color, isSel ? 2.2 : 1.6));
    if ('anchor' in sp.a) drawAnchor(p, sp.a.anchor, color);
    if ('anchor' in sp.b) drawAnchor(p, sp.b.anchor, color);
  }
}

import type { Scene } from '../scene';

/** Superficies: segmento grueso; la seleccionada muestra sus extremos, que se arrastran para inclinarla. */
export function surfacesLayer(scene: Scene): void {
  const p = scene.painter;
  const { ctx, pal } = p;
  const sel = scene.selection;
  for (const s of scene.world.surfaces) {
    const isSel = sel?.kind === 'surface' && sel.id === s.id;
    ctx.lineCap = 'round';
    p.alpha(isSel ? 1 : 0.8, () => p.line(s.a, s.b, pal.ink, isSel ? 4 : 3));
    ctx.lineCap = 'butt';
    if (isSel) {
      p.ring(s.a, 7, pal.vel, 1.5);
      p.ring(s.b, 7, pal.vel, 1.5);
    }
  }
}

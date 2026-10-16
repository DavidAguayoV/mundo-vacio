import type { Scene } from '../scene';

const SPACING = 2.5; // m entre flechas del campo

/** Campo g uniforme: flechas tenues repartidas por todo el espacio. */
export function fieldLayer(scene: Scene): void {
  const g = scene.world.g;
  if (!g) return;
  const L = Math.hypot(g.x, g.y);
  if (L === 0) return;
  const p = scene.painter;
  const ux = (g.x / L) * 0.35;
  const uy = (g.y / L) * 0.35;
  const b = scene.view.bounds(40);
  p.alpha(0.22, () => {
    for (let x = Math.floor(b.minX / SPACING) * SPACING; x <= b.maxX; x += SPACING) {
      for (let y = Math.floor(b.minY / SPACING) * SPACING; y <= b.maxY; y += SPACING) {
        p.arrow({ x: x - ux, y: y - uy }, { x: x + ux, y: y + uy }, p.pal.acc, 1.2);
      }
    }
  });
}

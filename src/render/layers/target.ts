import type { Scene } from '../scene';

/** Blancos: círculo punteado con una cruz; destello al acertar. */
export function targetLayer(scene: Scene): void {
  const p = scene.painter;
  const { ctx, pal } = p;
  const { view } = scene;
  for (const t of scene.world.targets) {
    const rPx = t.radius * view.S;
    p.ring(t.pos, rPx, pal.vec, 1.5, [4, 4]);
    const x = view.sx(t.pos.x);
    const y = view.sy(t.pos.y);
    ctx.strokeStyle = pal.vec;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 6, y);
    ctx.lineTo(x + 6, y);
    ctx.moveTo(x, y - 6);
    ctx.lineTo(x, y + 6);
    ctx.stroke();
    if (scene.hitFlash > 0) {
      p.alpha(Math.min(1, scene.hitFlash) * 0.35, () => p.disc(t.pos, rPx * (1.6 - scene.hitFlash * 0.5), pal.vec));
    }
  }
}

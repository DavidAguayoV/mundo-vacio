import type { Scene } from '../scene';
import { withAlpha } from '../theme';

/**
 * Campo g uniforme: un velo apenas teñido que se espesa hacia «abajo» y tres flechas grandes casi
 * transparentes. Dice hacia dónde cae todo sin llenar el vacío; |g| y sus componentes van en el HUD.
 */
export function fieldLayer(scene: Scene): void {
  const g = scene.world.g;
  if (!g) return;
  const L = Math.hypot(g.x, g.y);
  if (L === 0) return;
  const p = scene.painter;
  const { ctx, pal } = p;
  const { W, H } = scene.view;
  // dirección de g en pantalla (y hacia abajo) y su perpendicular
  const dx = g.x / L;
  const dy = -g.y / L;
  const nx = -dy;
  const ny = dx;
  const cx = W / 2;
  const cy = H / 2;
  // media extensión de la pantalla a lo largo de g y a lo ancho
  const along = (Math.abs(dx) * W + Math.abs(dy) * H) / 2;
  const across = (Math.abs(nx) * W + Math.abs(ny) * H) / 2;

  const veil = ctx.createLinearGradient(cx - dx * along, cy - dy * along, cx + dx * along, cy + dy * along);
  veil.addColorStop(0, withAlpha(pal.acc, 0));
  veil.addColorStop(0.5, withAlpha(pal.acc, 0));
  veil.addColorStop(1, withAlpha(pal.acc, 0.05));
  ctx.fillStyle = veil;
  ctx.fillRect(0, 0, W, H);

  const len = Math.min(110, along * 0.32);
  p.alpha(0.065, () => {
    for (const k of [-1, 0, 1]) {
      const bx = cx + nx * across * 0.62 * k + dx * along * 0.42;
      const by = cy + ny * across * 0.62 * k + dy * along * 0.42;
      p.arrowPx(bx - dx * len * 0.5, by - dy * len * 0.5, bx + dx * len * 0.5, by + dy * len * 0.5, pal.acc, 7, undefined, false);
    }
  });
}

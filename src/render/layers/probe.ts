import { lineIntersection, segmentsIntersect } from '../../core/vec';
import type { Scene } from '../scene';
import { withAlpha } from '../theme';

/** Balizas: un anillo doble con una luz suave (las ocultas no se dibujan hasta encontrarlas). */
export function beaconsLayer(scene: Scene): void {
  const p = scene.painter;
  const { ctx, pal } = p;
  const { view } = scene;
  for (const b of scene.world.beacons) {
    if (b.hidden) continue;
    const x = view.sx(b.pos.x);
    const y = view.sy(b.pos.y);
    const r = Math.max(8, b.radius * view.S);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    g.addColorStop(0, withAlpha(pal.halo, 0.16));
    g.addColorStop(1, withAlpha(pal.halo, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
    p.alpha(0.85, () => p.ring(b.pos, r, pal.ink, 1.25));
    p.alpha(0.5, () => p.ring(b.pos, r * 0.45, pal.ink, 1));
    p.occupy({ x: x - r, y: y - r, w: 2 * r, h: 2 * r });
  }
}

/**
 * La sonda: un rombo en tinta. Las uniones de la cadena (cola sobre punta) se marcan con un punto;
 * cuando llega a la baliza, una flecha directa muestra la suma.
 */
export function probeLayer(scene: Scene): void {
  const { world, view } = scene;
  if (!world.probe) return;
  const p = scene.painter;
  const { ctx, pal } = p;
  const chain = world.probeChain();

  // uniones de la cadena
  for (const q of chain.points.slice(1, -1)) p.alpha(0.8, () => p.disc(q, 2.6, pal.ink));

  // dónde la cadena choca con un muro: una cruz
  if (chain.blocked) {
    for (const v of chain.vectors) {
      for (const s of world.surfaces) {
        if (!segmentsIntersect(v.tail, v.tip, s.a, s.b)) continue;
        const at = lineIntersection(v.tail, v.tip, s.a, s.b) ?? v.tail;
        const x = view.sx(at.x);
        const y = view.sy(at.y);
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x - 6, y - 6);
        ctx.lineTo(x + 6, y + 6);
        ctx.moveTo(x + 6, y - 6);
        ctx.lineTo(x - 6, y + 6);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }
  }

  // la suma, cuando la cadena llega a una baliza y no cruza un muro
  const end = chain.points[chain.points.length - 1];
  const arrived = chain.vectors.length > 1 && !chain.blocked && world.beacons.some((b) => !b.hidden && Math.hypot(b.pos.x - end.x, b.pos.y - end.y) <= b.radius);
  if (arrived) {
    p.alpha(0.55, () => p.arrow(world.probe!, end, pal.ink, 1.6, [6, 5]));
    const label = chain.vectors.map((v) => v.label).join('+').replace(/\+−/g, '−');
    p.midLabel(label, world.probe, end, pal.ink, 18);
  }

  // punto de partida (queda marcado mientras la sonda salta)
  const at = scene.probe ?? world.probe;
  if (at !== world.probe) p.alpha(0.45, () => p.ring(world.probe!, 5, pal.ink, 1));

  const x = view.sx(at.x);
  const y = view.sy(at.y);
  const halo = ctx.createRadialGradient(x, y, 2, x, y, 22);
  halo.addColorStop(0, withAlpha(pal.halo, 0.3));
  halo.addColorStop(1, withAlpha(pal.halo, 0));
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pal.ink;
  ctx.beginPath();
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x + 6.5, y);
  ctx.lineTo(x, y + 8);
  ctx.lineTo(x - 6.5, y);
  ctx.closePath();
  ctx.fill();
  p.occupy({ x: x - 9, y: y - 10, w: 18, h: 20 });
}

import { fmt } from '../../core/format';
import { centerOfMass, toWorld } from '../../physics/rigid';
import { particleRadiusPx } from '../scales';
import type { Scene } from '../scene';
import { withAlpha } from '../theme';

/**
 * Cuerpos rígidos. Barra: un trazo grueso con marcas cada 0,5 m medidas desde el eje (para leer
 * distancias); eje: un fulcro triangular si el cuerpo apoya (balancín) o un gancho si cuelga;
 * pesas con su halo. Disco, aro y caja llevan un rayo que deja ver cuánto giraron. ω, en cian.
 */
export function bodiesLayer(scene: Scene): void {
  const { world, view } = scene;
  if (!world.bodies.length) return;
  const p = scene.painter;
  const { ctx, pal } = p;
  const sel = scene.selection;

  for (const b of world.bodies) {
    const isSel = sel?.kind === 'body' && sel.id === b.id;
    const sx = (q: { x: number; y: number }) => view.sx(toWorld(b, q).x);
    const sy = (q: { x: number; y: number }) => view.sy(toWorld(b, q).y);

    if (b.shape === 'rod') {
      const a = { x: -b.size / 2, y: 0 };
      const c = { x: b.size / 2, y: 0 };
      ctx.lineCap = 'round';
      ctx.strokeStyle = pal.ink;
      ctx.globalAlpha = isSel ? 1 : 0.85;
      // un hilo sin masa es una línea fina; una barra, un trazo grueso
      ctx.lineWidth = b.thread ? (isSel ? 2 : 1.3) : isSel ? 7 : 6;
      ctx.beginPath();
      ctx.moveTo(sx(a), sy(a));
      ctx.lineTo(sx(c), sy(c));
      ctx.stroke();
      ctx.globalAlpha = 1;
      // marcas cada 0,5 m desde el eje (o desde el centro): así se lee el brazo de palanca
      const o = b.pivot?.local.x ?? 0;
      if (b.thread) ctx.globalAlpha = 0;
      const nx = -Math.sin(b.angle);
      const ny = Math.cos(b.angle);
      ctx.strokeStyle = pal.bg;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let k = -40; k <= 40; k++) {
        const x = o + k * 0.5;
        if (k === 0 || x < -b.size / 2 + 0.05 || x > b.size / 2 - 0.05) continue;
        const L = k % 2 === 0 ? 3 : 1.5;
        const X = sx({ x, y: 0 });
        const Y = sy({ x, y: 0 });
        ctx.moveTo(X - nx * L, Y + ny * L);
        ctx.lineTo(X + nx * L, Y - ny * L);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineCap = 'butt';
      const [x1, y1, x2, y2] = [sx(a), sy(a), sx(c), sy(c)];
      p.occupy({ x: Math.min(x1, x2) - 4, y: Math.min(y1, y2) - 4, w: Math.abs(x2 - x1) + 8, h: Math.abs(y2 - y1) + 8 });
    } else if (b.shape === 'box') {
      const w = b.size;
      const h = b.size2 ?? b.size;
      const corners = [
        { x: -w / 2, y: -h / 2 },
        { x: w / 2, y: -h / 2 },
        { x: w / 2, y: h / 2 },
        { x: -w / 2, y: h / 2 },
      ];
      ctx.beginPath();
      corners.forEach((q, i) => (i ? ctx.lineTo(sx(q), sy(q)) : ctx.moveTo(sx(q), sy(q))));
      ctx.closePath();
      ctx.fillStyle = withAlpha(pal.ink, 0.12);
      ctx.fill();
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = isSel ? 2.5 : 2;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.lineJoin = 'miter';
    } else {
      const X = view.sx(b.pos.x);
      const Y = view.sy(b.pos.y);
      const R = b.size * view.S;
      const g = ctx.createRadialGradient(X, Y, R * 0.6, X, Y, R * 1.8);
      g.addColorStop(0, withAlpha(pal.halo, 0.14));
      g.addColorStop(1, withAlpha(pal.halo, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(X, Y, R * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(X, Y, R, 0, Math.PI * 2);
      if (b.shape === 'disc') {
        ctx.fillStyle = withAlpha(pal.ink, 0.16);
        ctx.fill();
      }
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = b.shape === 'ring' ? (isSel ? 5 : 4) : isSel ? 2.5 : 2;
      ctx.stroke();
      // un rayo: deja ver cuánto giró
      const rim = { x: b.size * (b.shape === 'ring' ? 1 : 0.92), y: 0 };
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(X, Y);
      ctx.lineTo(sx(rim), sy(rim));
      ctx.stroke();
      p.disc(b.pos, 2.5, pal.ink);
      p.occupy({ x: X - R, y: Y - R, w: 2 * R, h: 2 * R });
    }

    // el eje: fulcro si apoya (tiene tope), gancho si cuelga
    if (b.pivot) {
      const X = view.sx(b.pivot.at.x);
      const Y = view.sy(b.pivot.at.y);
      if (b.pivot.limit !== undefined) {
        ctx.beginPath();
        ctx.moveTo(X, Y + 3);
        ctx.lineTo(X - 11, Y + 22);
        ctx.lineTo(X + 11, Y + 22);
        ctx.closePath();
        ctx.fillStyle = withAlpha(pal.ink, b.pivot.movable ? 0.18 : 0.5);
        ctx.fill();
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 1.5;
        if (b.pivot.movable) ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = pal.ink;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(X - 10, Y - 6);
        ctx.lineTo(X + 10, Y - 6);
        for (let k = -10; k <= 6; k += 5) {
          ctx.moveTo(X + k, Y - 6);
          ctx.lineTo(X + k + 4, Y - 11);
        }
        ctx.stroke();
      }
      p.disc(b.pivot.at, 3.5, pal.bg);
      p.ring(b.pivot.at, 3.5, pal.ink, 1.5);
      p.occupy({ x: X - 12, y: Y - 12, w: 24, h: 36 });
    }

    // pesas
    for (const l of b.loads) {
      const q = toWorld(b, { x: l.s, y: 0 });
      const r = particleRadiusPx(l.mass);
      const X = view.sx(q.x);
      const Y = view.sy(q.y);
      const g = ctx.createRadialGradient(X, Y, r * 0.6, X, Y, r * 2.6);
      g.addColorStop(0, withAlpha(pal.halo, 0.24));
      g.addColorStop(1, withAlpha(pal.halo, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(X, Y, r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      p.disc(q, r, pal.ink);
      if (l.locked) p.alpha(0.5, () => p.ring(q, r + 3, pal.ink, 1));
      p.occupy({ x: X - r - 2, y: Y - r - 2, w: 2 * r + 4, h: 2 * r + 4 });
      const text = `${fmt(l.mass, l.mass < 1 ? 2 : 1)} kg`;
      p.labelAt(text, [{ x: X, y: Y - r - 12 }, { x: X, y: Y + r + 12 }], pal.muted, 12, 'text', 1);
    }

    // ω: un arco cian alrededor del centro de masa, en el sentido del giro
    if (Math.abs(b.omega) > 0.05) {
      const c = centerOfMass(b);
      const X = view.sx(c.x);
      const Y = view.sy(c.y);
      // fuera del borde del disco o del aro, para que no se confunda con él
      const R = Math.max(22, (b.shape === 'rod' ? 0 : b.size * view.S) + 9);
      const sweep = Math.min(Math.PI * 1.4, 0.35 + Math.abs(b.omega) * 0.5);
      const start = -Math.PI / 2;
      // en la pantalla y crece hacia abajo: un giro antihorario se dibuja con ángulos negativos
      const dir = b.omega > 0 ? -1 : 1;
      const end = start + dir * sweep;
      ctx.strokeStyle = pal.vel;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(X, Y, R, start, end, dir < 0);
      ctx.stroke();
      ctx.lineCap = 'butt';
      const ex = X + R * Math.cos(end);
      const ey = Y + R * Math.sin(end);
      const tx = -Math.sin(end) * dir;
      const ty = Math.cos(end) * dir;
      ctx.fillStyle = pal.vel;
      ctx.beginPath();
      ctx.moveTo(ex + tx * 7, ey + ty * 7);
      ctx.lineTo(ex - ty * 4.5, ey + tx * 4.5);
      ctx.lineTo(ex + ty * 4.5, ey - tx * 4.5);
      ctx.closePath();
      ctx.fill();
      p.labelAt('ω', [{ x: X + R + 12, y: Y - R }, { x: X - R - 12, y: Y - R }], pal.vel, 18, 'symbol', 0);
    }
    // nombre del cuerpo bajo él (disco, aro, caja), para la carrera
    if (b.shape !== 'rod') {
      const name = b.shape === 'disc' ? 'disco' : b.shape === 'ring' ? 'aro' : 'caja';
      const R = (b.shape === 'box' ? (b.size2 ?? b.size) / 2 : b.size) * view.S;
      p.labelAt(name, [{ x: view.sx(b.pos.x), y: view.sy(b.pos.y) - R - 14 }, { x: view.sx(b.pos.x), y: view.sy(b.pos.y) + R + 14 }], pal.muted, 12, 'text', 1);
    }
  }
}

import type { Vec2 } from '../../core/vec';
import { fmt, subscript } from '../../core/format';
import { ACC_SCALE, VEL_SCALE, particleRadiusPx } from '../scales';
import type { Scene } from '../scene';
import { withAlpha } from '../theme';

/** Trayectorias estroboscópicas: un punto fino cada 0,1 s, más tenue cuanto más antiguo. */
export function trailsLayer(scene: Scene): void {
  if (!scene.display.trails) return;
  const { ctx, pal } = scene.painter;
  const { view } = scene;
  const LEVELS = 5;
  ctx.fillStyle = pal.ink;
  for (const tr of scene.sim.trails.values()) {
    const n = tr.length;
    if (!n) continue;
    for (let k = 0; k < LEVELS; k++) {
      const a = Math.floor((k * n) / LEVELS);
      const b = Math.floor(((k + 1) * n) / LEVELS);
      if (b <= a) continue;
      ctx.globalAlpha = 0.12 + 0.5 * ((k + 1) / LEVELS);
      ctx.beginPath();
      for (let i = a; i < b; i++) {
        const x = view.sx(tr[i].x);
        const y = view.sy(tr[i].y);
        ctx.moveTo(x + 1.3, y);
        ctx.arc(x, y, 1.3, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

const FORCE_LABEL: Record<string, string> = { gravity: 'mg', normal: 'N', friction: 'f', spring: 'Fₑ', gravitation: 'Fg', drag: 'Fₐ' };
const FORCE_SIDE: Record<string, 1 | -1> = { gravity: -1, normal: 1, friction: 1, spring: 1, gravitation: 1, drag: 1 };

/**
 * Fuerzas sobre una partícula apoyada. Se dibujan como F/m con la escala de las aceleraciones:
 * así mg mide lo mismo que g para cualquier masa y las flechas se pueden comparar con a.
 */
function forceDiagram(scene: Scene, id: string, pos: Vec2, mass: number): void {
  const p = scene.painter;
  const { pal } = p;
  const bd = scene.sim.forcesOn(id);
  if (!bd) return;
  const k = ACC_SCALE / mass;
  for (const part of bd.parts) {
    if (Math.hypot(part.F.x, part.F.y) * k < 0.05) continue;
    const tip = { x: pos.x + part.F.x * k, y: pos.y + part.F.y * k };
    p.arrow(pos, tip, pal.vec, 2.4);
    p.tipLabel(FORCE_LABEL[part.kind] ?? 'F', pos, tip, pal.vec, FORCE_SIDE[part.kind] ?? 1);
  }
  const a = bd.accel;
  if (Math.hypot(a.x, a.y) * ACC_SCALE >= 0.05) {
    const tip = { x: pos.x + a.x * ACC_SCALE, y: pos.y + a.y * ACC_SCALE };
    p.arrow(pos, tip, pal.acc, 2.2);
    p.tipLabel('a', pos, tip, pal.acc, -1);
  }
}

/** Halo radial: crece con la masa y le da presencia a la partícula sin agrandar su núcleo. */
function halo(scene: Scene, pos: Vec2, r: number, mass: number): void {
  const { ctx, pal } = scene.painter;
  const { view } = scene;
  const x = view.sx(pos.x);
  const y = view.sy(pos.y);
  const R = r * (2.4 + 0.5 * Math.cbrt(mass));
  const g = ctx.createRadialGradient(x, y, r * 0.6, x, y, R);
  g.addColorStop(0, withAlpha(pal.halo, 0.26));
  g.addColorStop(0.35, withAlpha(pal.halo, 0.08));
  g.addColorStop(1, withAlpha(pal.halo, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R, 0, Math.PI * 2);
  ctx.fill();
}

/** Partículas con su vector posición r (neutro), velocidad v (cian) y, en vuelo, g (rosa). */
export function particlesLayer(scene: Scene): void {
  const p = scene.painter;
  const { pal } = p;
  const { world, sim, view } = scene;
  const O = world.frame?.origin;
  const showR = scene.display.positions;
  const showG = !!world.g && (sim.running || sim.hasRun);

  // primero los núcleos ocupan su lugar, para que ningún rótulo caiga encima de una partícula
  for (const q of world.particles) {
    const r = particleRadiusPx(q.mass) + 3;
    p.occupy({ x: view.sx(q.pos.x) - r, y: view.sy(q.pos.y) - r, w: 2 * r, h: 2 * r });
  }

  for (const q of world.particles) {
    if (O && showR) {
      p.alpha(0.55, () => {
        p.ctx.lineCap = 'round';
        p.line(O, q.pos, pal.pos, 1.2, [0.5, 5]);
        p.ctx.lineCap = 'butt';
      });
      if (Math.hypot(q.pos.x - O.x, q.pos.y - O.y) > 0.8) p.midLabel(`r${subscript(q.label)}`, O, q.pos, pal.pos);
    }
    // Apoyada en una superficie o colgada de un resorte: diagrama de fuerzas (ámbar) y la aceleración resultante a (rosa).
    // Libre: g primero y v encima (al caer desde el reposo son paralelas y v crece más allá de g);
    // los rótulos buscan su lugar al final del cuadro.
    const contact = sim.contactNormal(q.id) || world.springsOf(q.id).length > 0 || (!!world.gravitation && world.particles.length > 1) || !!world.medium;
    if (contact) {
      forceDiagram(scene, q.id, q.pos, q.mass);
    } else if (showG && world.g) {
      const tip = { x: q.pos.x + world.g.x * ACC_SCALE, y: q.pos.y + world.g.y * ACC_SCALE };
      p.arrow(q.pos, tip, pal.acc, 2.2);
      p.tipLabel('g', q.pos, tip, pal.acc, -1);
    }
    if (q.vel.x || q.vel.y) {
      const tip = { x: q.pos.x + q.vel.x * VEL_SCALE, y: q.pos.y + q.vel.y * VEL_SCALE };
      p.arrow(q.pos, tip, pal.vel, 2.6);
      p.tipLabel('v', q.pos, tip, pal.vel, 1);
    }
    const r = particleRadiusPx(q.mass);
    halo(scene, q.pos, r, q.mass);
    p.disc(q.pos, r, pal.ink);
    if (scene.selection?.kind === 'particle' && scene.selection.id === q.id) {
      p.ring(q.pos, r + 6, pal.ink, 1.25);
      p.alpha(0.35, () => p.ring(q.pos, r + 10, pal.ink, 1));
    }

    // la masa prefiere el lado opuesto al origen (lejos de la línea de r) y, si choca, gira hasta dar con un lugar libre
    let ang = -Math.PI / 4;
    if (O) {
      const dx = view.sx(q.pos.x) - view.sx(O.x);
      const dy = view.sy(q.pos.y) - view.sy(O.y);
      if (Math.hypot(dx, dy) > 1e-6) ang = Math.atan2(dy, dx);
    }
    const text = `${fmt(q.mass, q.mass < 1 ? 2 : 1)} kg`;
    p.ctx.font = `500 12.5px ${pal.sans}`;
    const halfW = p.ctx.measureText(text).width / 2;
    const gap = r + 12; // deja libre el anillo de selección
    const x0 = view.sx(q.pos.x);
    const y0 = view.sy(q.pos.y);
    const candidates = [0, 1, -1, 2, -2, 3, -3, 4].map((k) => {
      const a = ang + (k * Math.PI) / 4;
      const ux = Math.cos(a);
      const uy = Math.sin(a);
      return { x: x0 + ux * (gap + halfW * Math.abs(ux)), y: y0 + uy * (gap + 4) };
    });
    p.labelAt(text, candidates, pal.muted, 12.5, 'text', 1);
  }
}

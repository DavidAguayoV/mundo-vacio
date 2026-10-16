import type { Vec2 } from '../../core/vec';
import { fmt, subscript } from '../../core/format';
import { ACC_SCALE, VEL_SCALE, particleRadiusPx } from '../scales';
import type { Scene } from '../scene';

/** Trayectorias estroboscópicas: un punto cada 0,1 s. */
export function trailsLayer(scene: Scene): void {
  const p = scene.painter;
  const { ctx, pal } = p;
  const { view } = scene;
  p.alpha(0.55, () => {
    ctx.fillStyle = pal.ink;
    ctx.beginPath();
    for (const tr of scene.sim.trails.values()) {
      for (const q of tr) {
        const x = view.sx(q.x);
        const y = view.sy(q.y);
        ctx.moveTo(x + 1.8, y);
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  });
}

const FORCE_LABEL: Record<string, string> = { gravity: 'mg', normal: 'N', friction: 'f' };
const FORCE_SIDE: Record<string, 1 | -1> = { gravity: -1, normal: 1, friction: 1 };

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
    p.arrow(pos, tip, pal.vec, 2);
    p.tipLabel(FORCE_LABEL[part.kind] ?? 'F', pos, tip, pal.vec, FORCE_SIDE[part.kind] ?? 1);
  }
  const a = bd.accel;
  if (Math.hypot(a.x, a.y) * ACC_SCALE >= 0.05) {
    const tip = { x: pos.x + a.x * ACC_SCALE, y: pos.y + a.y * ACC_SCALE };
    p.arrow(pos, tip, pal.acc, 1.8);
    p.tipLabel('a', pos, tip, pal.acc, -1);
  }
}

/** Partículas con su vector posición r (neutro), velocidad v (cian) y, en vuelo, g (rosa). */
export function particlesLayer(scene: Scene): void {
  const p = scene.painter;
  const { pal } = p;
  const { world, sim, view } = scene;
  const O = world.frame?.origin;
  const showG = !!world.g && (sim.running || sim.hasRun);

  for (const q of world.particles) {
    if (O) {
      p.alpha(0.7, () => p.line(O, q.pos, pal.pos, 1.2, [4, 4]));
      if (Math.hypot(q.pos.x - O.x, q.pos.y - O.y) > 0.8) p.midLabel(`r${subscript(q.label)}`, O, q.pos, pal.pos);
    }
    // Apoyada en una superficie: diagrama de fuerzas (ámbar) y la aceleración resultante a (rosa).
    // Libre: g primero y v encima (al caer desde el reposo son paralelas y v crece más allá de g),
    // con rótulos en costados opuestos para que no choquen.
    const contact = sim.contactNormal(q.id);
    if (contact) {
      forceDiagram(scene, q.id, q.pos, q.mass);
    } else if (showG && world.g) {
      const tip = { x: q.pos.x + world.g.x * ACC_SCALE, y: q.pos.y + world.g.y * ACC_SCALE };
      p.arrow(q.pos, tip, pal.acc, 1.8);
      p.tipLabel('g', q.pos, tip, pal.acc, -1);
    }
    if (q.vel.x || q.vel.y) {
      const tip = { x: q.pos.x + q.vel.x * VEL_SCALE, y: q.pos.y + q.vel.y * VEL_SCALE };
      p.arrow(q.pos, tip, pal.vel, 2.2);
      p.tipLabel('v', q.pos, tip, pal.vel, 1, 13);
    }
    const r = particleRadiusPx(q.mass);
    p.disc(q.pos, r, pal.ink);
    if (scene.selection?.kind === 'particle' && scene.selection.id === q.id) p.ring(q.pos, r + 5, pal.vel, 1.5);
    // la masa va del lado opuesto al origen, para no cruzarse con la línea de r
    let ux = 0.6;
    let uy = 0.8;
    if (O) {
      const L = Math.hypot(q.pos.x - O.x, q.pos.y - O.y);
      if (L > 1e-6) {
        ux = (q.pos.x - O.x) / L;
        uy = (q.pos.y - O.y) / L;
      }
    }
    const text = `${fmt(q.mass, q.mass < 1 ? 2 : 1)} kg`;
    p.ctx.font = `500 11px ${pal.mono}`;
    const halfW = p.ctx.measureText(text).width / 2;
    const gap = r + 9; // deja libre el anillo de selección
    p.label(text, { x: q.pos.x + view.m(ux * (gap + halfW)), y: q.pos.y + view.m(uy * (gap + 7)) }, pal.muted, 11, 'center');
  }
}

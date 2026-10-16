import { fmt } from '../core/format';
import type { Painter } from '../render/painter';
import { MAX_SPEED, VEL_SCALE } from '../render/scales';
import type { Particle } from '../world/world';
import { hitParticle, hitVelocityTip } from './hit';
import { ICONS } from './icons';
import type { Tool, ToolContext, WorldPointer } from './tool';

/** Arrastrando desde una partícula (o desde la punta de su flecha) se fija la velocidad inicial v₀. */
export class VelocityTool implements Tool {
  readonly id = 'velocity' as const;
  readonly name = 'Velocidad';
  readonly icon = ICONS.velocity;
  private q: Particle | null = null;

  onPointerDown({ p, tol }: WorldPointer, ctx: ToolContext): void {
    const { world, view, sim } = ctx;
    const q = hitVelocityTip(world, p, tol) ?? hitParticle(world, view, p, tol);
    if (!q) return;
    // la velocidad que se da es la inicial: se vuelve al comienzo del lanzamiento
    if (sim.hasRun) sim.reset();
    this.q = q;
    ctx.select({ kind: 'particle', id: q.id });
  }

  onPointerMove({ p }: WorldPointer): void {
    const q = this.q;
    if (!q) return;
    let vx = (p.x - q.pos.x) / VEL_SCALE;
    let vy = (p.y - q.pos.y) / VEL_SCALE;
    const s = Math.hypot(vx, vy);
    if (s > MAX_SPEED) {
      vx *= MAX_SPEED / s;
      vy *= MAX_SPEED / s;
    }
    q.vel = { x: vx, y: vy };
  }

  onPointerUp(_e: WorldPointer, ctx: ToolContext): void {
    const q = this.q;
    this.q = null;
    if (q && Math.hypot(q.vel.x, q.vel.y) > 0.3) ctx.emit({ type: 'v-set' });
  }

  renderDraft(p: Painter, ctx: ToolContext): void {
    const q = this.q;
    if (!q) return;
    const s = Math.hypot(q.vel.x, q.vel.y);
    if (s < 0.05) return;
    const tip = { x: q.pos.x + q.vel.x * VEL_SCALE, y: q.pos.y + q.vel.y * VEL_SCALE };
    p.label(`${fmt(s)} m/s`, { x: tip.x + ctx.view.m(12), y: tip.y - ctx.view.m(12) }, p.pal.vel, 12);
  }
}

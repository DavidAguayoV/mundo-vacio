import { dist, type Vec2 } from '../core/vec';
import type { Painter } from '../render/painter';
import { G_EARTH } from '../world/world';
import { ICONS } from './icons';
import type { Tool, ToolContext, WorldPointer } from './tool';

/** El jugador arrastra en la dirección en que cree que caen las cosas; |g| = 9,80 m/s². */
export class GravityTool implements Tool {
  readonly id = 'gravity' as const;
  readonly name = 'Gravedad';
  readonly icon = ICONS.gravity;
  private a: Vec2 | null = null;
  private b: Vec2 | null = null;

  onPointerDown({ p }: WorldPointer, ctx: ToolContext): void {
    ctx.sim.pause();
    this.a = { ...p };
    this.b = { ...p };
  }

  onPointerMove({ p }: WorldPointer): void {
    if (this.a) this.b = { ...p };
  }

  onPointerUp(_e: WorldPointer, ctx: ToolContext): void {
    const { a, b } = this;
    this.a = this.b = null;
    if (!a || !b) return;
    const L = dist(a, b);
    if (L < 0.3) return;
    if (ctx.sim.hasRun) ctx.sim.reset();
    ctx.world.g = { x: ((b.x - a.x) / L) * G_EARTH, y: ((b.y - a.y) / L) * G_EARTH };
    ctx.emit({ type: 'g-set' });
  }

  renderDraft(p: Painter): void {
    const { a, b } = this;
    if (!a || !b || dist(a, b) < 0.1) return;
    p.arrow(a, b, p.pal.acc, 3);
    p.midLabel('g', a, b, p.pal.acc);
  }
}

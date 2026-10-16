import { dist, type Vec2 } from '../core/vec';
import type { Painter } from '../render/painter';
import { ICONS } from './icons';
import type { Tool, ToolContext, WorldPointer } from './tool';

const MIN_LENGTH = 0.5; // m

/** Dibuja una superficie rígida arrastrando de un extremo al otro. */
export class SurfaceTool implements Tool {
  readonly id = 'surface' as const;
  readonly name = 'Superficie';
  readonly icon = ICONS.surface;
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
    if (!a || !b || dist(a, b) < MIN_LENGTH) return;
    // editar el mundo vuelve al estado de preparación del experimento
    if (ctx.sim.hasRun) ctx.sim.reset();
    const s = ctx.world.addSurface(a, b);
    ctx.select({ kind: 'surface', id: s.id });
    ctx.emit({ type: 'surface-drawn' });
  }

  renderDraft(p: Painter): void {
    const { a, b } = this;
    if (!a || !b || dist(a, b) < 0.05) return;
    p.alpha(0.7, () => p.line(a, b, p.pal.ink, 3));
  }
}

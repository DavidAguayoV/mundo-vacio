import { hitVectorBody, hitVectorTip } from './hit';
import { ICONS } from './icons';
import type { Tool, ToolContext, WorldPointer } from './tool';

/** Suma cola con punta: toca un vector y después otro. */
export class SumTool implements Tool {
  readonly id = 'sum' as const;
  readonly name = 'Sumar';
  readonly icon = ICONS.sum;
  private first: string | null = null;

  onActivate(ctx: ToolContext): void {
    this.reset(ctx);
  }

  onDeactivate(ctx: ToolContext): void {
    this.reset(ctx);
  }

  private reset(ctx: ToolContext): void {
    if (this.first) ctx.highlighted.delete(this.first);
    this.first = null;
  }

  onPointerDown({ p, tol }: WorldPointer, ctx: ToolContext): void {
    const { world } = ctx;
    const v = hitVectorTip(world, p, tol) ?? hitVectorBody(world, p, tol);
    if (!v) {
      this.reset(ctx);
      return;
    }
    const A = this.first ? world.vector(this.first) : undefined;
    if (!A) {
      this.first = v.id;
      ctx.highlighted.add(v.id);
      ctx.toast(`Elegiste ${v.label}. Ahora toca otro vector.`);
      return;
    }
    if (A.id === v.id) {
      this.reset(ctx);
      return;
    }
    const existing = world.sums.find((s) => s.a === A.id && s.b === v.id);
    const s = existing ?? world.addSum(A.id, v.id);
    this.reset(ctx);
    ctx.select({ kind: 'sum', id: s.id });
    ctx.toast(`${A.label} + ${v.label}`);
    ctx.emit({ type: 'sum-done' });
  }

  onPointerMove(): void {}
  onPointerUp(): void {}
}

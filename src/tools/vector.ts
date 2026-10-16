import { dist } from '../core/vec';
import type { FreeVector } from '../world/world';
import { ICONS } from './icons';
import type { Tool, ToolContext, WorldPointer } from './tool';

const MIN_LENGTH = 0.3; // m; más corto se considera un toque accidental

/** Dibuja un vector libre arrastrando de la cola a la punta. */
export class VectorTool implements Tool {
  readonly id = 'vector' as const;
  readonly name = 'Vector';
  readonly icon = ICONS.vector;
  private v: FreeVector | null = null;

  onPointerDown({ p }: WorldPointer, ctx: ToolContext): void {
    this.v = ctx.world.addVector(p, p);
  }

  onPointerMove({ p }: WorldPointer): void {
    if (this.v) this.v.tip = { ...p };
  }

  onPointerUp(_e: WorldPointer, ctx: ToolContext): void {
    const v = this.v;
    this.v = null;
    if (!v) return;
    if (dist(v.tail, v.tip) < MIN_LENGTH) {
      ctx.world.removeVector(v.id);
      return;
    }
    ctx.select({ kind: 'vector', id: v.id });
    ctx.emit({ type: 'vector-drawn' });
  }
}

import { ReferenceFrame } from '../world/frame';
import { FrameDrag } from './frameDrag';
import { ICONS } from './icons';
import type { Tool, ToolContext, WorldPointer } from './tool';

/** Fija el origen (primer toque), lo traslada y gira los ejes desde el asa. */
export class OriginTool implements Tool {
  readonly id = 'origin' as const;
  readonly name = 'Origen';
  readonly icon = ICONS.origin;
  private drag: FrameDrag | null = null;

  onPointerDown({ p, tol }: WorldPointer, ctx: ToolContext): void {
    const { world } = ctx;
    this.drag = FrameDrag.tryStart(p, tol, ctx, true);
    if (this.drag) return;
    if (!world.frame) {
      world.frame = new ReferenceFrame({ ...p }, 0);
      this.drag = FrameDrag.moveTo(null, 0);
      ctx.emit({ type: 'origin-placed' });
    } else {
      const previous = { ...world.frame.origin };
      world.frame.origin = { ...p };
      this.drag = FrameDrag.moveTo(previous, world.frame.angle);
    }
  }

  onPointerMove({ p }: WorldPointer, ctx: ToolContext): void {
    this.drag?.move(p, ctx);
  }

  onPointerUp(_e: WorldPointer, ctx: ToolContext): void {
    this.drag?.end(ctx);
    this.drag = null;
  }
}

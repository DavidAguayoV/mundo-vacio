import { dist, type Vec2 } from '../core/vec';
import type { FreeVector, Particle } from '../world/world';
import { FrameDrag } from './frameDrag';
import { hitParticle, hitSum, hitVectorBody, hitVectorTip } from './hit';
import { ICONS } from './icons';
import type { Tool, ToolContext, WorldPointer } from './tool';

/**
 * Arrastre de una partícula. Tocar sin arrastrar solo la selecciona (se puede mirar su v en pleno vuelo);
 * al moverla de verdad, el lanzamiento se olvida y su posición actual pasa a ser la inicial.
 */
export class ParticleDrag {
  private moved = false;
  private grab: Vec2;
  private start: Vec2;

  constructor(
    private q: Particle,
    p: Vec2,
    private threshold: number,
  ) {
    this.grab = { x: q.pos.x - p.x, y: q.pos.y - p.y };
    this.start = { ...p };
  }

  move(p: Vec2, ctx: ToolContext): void {
    if (!this.moved && dist(p, this.start) < this.threshold) return;
    if (!this.moved) {
      this.moved = true;
      ctx.sim.clearRun();
    }
    this.q.pos.x = p.x + this.grab.x;
    this.q.pos.y = p.y + this.grab.y;
  }
}

type Drag =
  | { kind: 'frame'; d: FrameDrag }
  | { kind: 'particle'; d: ParticleDrag }
  | { kind: 'tip'; v: FreeVector }
  | { kind: 'body'; v: FreeVector; last: Vec2 };

export class MoveTool implements Tool {
  readonly id = 'move' as const;
  readonly name = 'Mover';
  readonly icon = ICONS.move;
  private drag: Drag | null = null;

  onPointerDown({ p, tol }: WorldPointer, ctx: ToolContext): void {
    const { world, view } = ctx;
    const fd = FrameDrag.tryStart(p, tol, ctx, false);
    if (fd) {
      this.drag = { kind: 'frame', d: fd };
      return;
    }
    const q = hitParticle(world, view, p, tol);
    if (q) {
      ctx.select({ kind: 'particle', id: q.id });
      this.drag = { kind: 'particle', d: new ParticleDrag(q, p, view.m(4)) };
      return;
    }
    const tip = hitVectorTip(world, p, tol);
    if (tip) {
      ctx.select({ kind: 'vector', id: tip.id });
      this.drag = { kind: 'tip', v: tip };
      return;
    }
    const fo = FrameDrag.tryStart(p, tol, ctx, true);
    if (fo) {
      this.drag = { kind: 'frame', d: fo };
      return;
    }
    const body = hitVectorBody(world, p, tol);
    if (body) {
      ctx.select({ kind: 'vector', id: body.id });
      this.drag = { kind: 'body', v: body, last: p };
      return;
    }
    const s = hitSum(world, p, tol);
    ctx.select(s ? { kind: 'sum', id: s.id } : null);
  }

  onPointerMove({ p }: WorldPointer, ctx: ToolContext): void {
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'frame') d.d.move(p, ctx);
    else if (d.kind === 'particle') d.d.move(p, ctx);
    else if (d.kind === 'tip') d.v.tip = { ...p };
    else {
      const dx = p.x - d.last.x;
      const dy = p.y - d.last.y;
      d.v.tail = { x: d.v.tail.x + dx, y: d.v.tail.y + dy };
      d.v.tip = { x: d.v.tip.x + dx, y: d.v.tip.y + dy };
      d.last = p;
    }
  }

  onPointerUp(_e: WorldPointer, ctx: ToolContext): void {
    if (this.drag?.kind === 'frame') this.drag.d.end(ctx);
    this.drag = null;
  }
}

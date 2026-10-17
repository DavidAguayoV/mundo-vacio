import { hitParticle, snapToSurface } from './hit';
import { hitBody, rodS } from './rigidHit';
import { ICONS } from './icons';
import { ParticleDrag } from './move';
import type { Tool, ToolContext, WorldPointer } from './tool';

/** Coloca partículas de 1 kg; si tocas una que ya existe, la selecciona y la arrastra. */
export class ParticleTool implements Tool {
  readonly id = 'particle' as const;
  readonly name = 'Partícula';
  readonly icon = ICONS.particle;
  private drag: ParticleDrag | null = null;

  onPointerDown({ p, tol }: WorldPointer, ctx: ToolContext): void {
    const { world, view, sim } = ctx;
    const q = hitParticle(world, view, p, tol);
    if (q) {
      ctx.select({ kind: 'particle', id: q.id });
      this.drag = new ParticleDrag(q, p, view.m(4));
      return;
    }
    // editar el mundo vuelve al estado de preparación del experimento
    if (sim.hasRun) sim.reset();
    // sobre una barra que acepta cargas: una pesa de 1 kg, ajustada cada 0,25 m
    const rod = hitBody(world, p, tol);
    if (rod?.shape === 'rod' && rod.loadable) {
      const s = rodS(rod, p);
      const same = rod.loads.find((l) => Math.abs(l.s - s) < 1e-9);
      if (same) same.mass = Math.min(64, same.mass + 1);
      else world.addLoad(rod, s, 1);
      ctx.select({ kind: 'body', id: rod.id });
      ctx.emit({ type: 'load-placed' });
      return;
    }
    const n = world.addParticle(snapToSurface(world, p, view.m(12)), 1);
    ctx.select({ kind: 'particle', id: n.id });
    this.drag = new ParticleDrag(n, p, view.m(4));
    ctx.emit({ type: 'particle-placed' });
  }

  onPointerMove({ p }: WorldPointer, ctx: ToolContext): void {
    this.drag?.move(p, ctx);
  }

  onPointerUp(_e: WorldPointer, ctx: ToolContext): void {
    this.drag?.finish(ctx);
    this.drag = null;
  }
}

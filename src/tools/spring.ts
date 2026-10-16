import { dist, type Vec2 } from '../core/vec';
import type { Endpoint } from '../physics/forces/force';
import { drawAnchor, drawCoil } from '../render/coil';
import type { Painter } from '../render/painter';
import { hitParticle } from './hit';
import { ICONS } from './icons';
import type { Tool, ToolContext, WorldPointer } from './tool';

const MIN_LENGTH = 0.3; // m

/**
 * Engancha un resorte: se arrastra desde una partícula o un punto vacío (que queda fijo)
 * hasta otra partícula u otro punto. Al menos un extremo tiene que ser una partícula.
 * Nace sin estirar: su largo natural es el largo con que se dibujó.
 */
export class SpringTool implements Tool {
  readonly id = 'spring' as const;
  readonly name = 'Resorte';
  readonly icon = ICONS.spring;
  private start: Endpoint | null = null;
  private from: Vec2 | null = null;
  private to: Vec2 | null = null;

  onPointerDown({ p, tol }: WorldPointer, ctx: ToolContext): void {
    ctx.sim.pause();
    const q = hitParticle(ctx.world, ctx.view, p, tol);
    this.start = q ? { particle: q.id } : { anchor: { ...p } };
    this.from = q ? q.pos : { ...p };
    this.to = { ...p };
  }

  onPointerMove({ p }: WorldPointer): void {
    if (this.start) this.to = { ...p };
  }

  onPointerUp({ p, tol }: WorldPointer, ctx: ToolContext): void {
    const start = this.start;
    const from = this.from;
    this.start = this.from = this.to = null;
    if (!start || !from) return;
    const q = hitParticle(ctx.world, ctx.view, p, tol);
    const end: Endpoint = q && !('particle' in start && start.particle === q.id) ? { particle: q.id } : { anchor: { ...p } };
    if ('anchor' in start && 'anchor' in end) {
      if (dist(from, p) >= MIN_LENGTH) ctx.toast('Un resorte necesita al menos una partícula en un extremo.');
      return;
    }
    const endPos = 'anchor' in end ? end.anchor : q!.pos;
    if (dist(from, endPos) < MIN_LENGTH) return;
    // editar el mundo vuelve al estado de preparación del experimento
    if (ctx.sim.hasRun) ctx.sim.reset();
    const sp = ctx.world.addSpring(start, end);
    ctx.select({ kind: 'spring', id: sp.id });
    ctx.emit({ type: 'spring-made' });
  }

  renderDraft(p: Painter): void {
    const { from, to, start } = this;
    if (!from || !to || dist(from, to) < 0.1) return;
    p.alpha(0.75, () => drawCoil(p, from, to, p.pal.ink));
    if (start && 'anchor' in start) drawAnchor(p, from, p.pal.ink);
  }
}

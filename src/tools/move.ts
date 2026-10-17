import { dist, type Vec2 } from '../core/vec';
import { surfaceCoords, surfaceFrame } from '../physics/contact';
import type { FreeVector, Particle, SpringLink, Surface } from '../world/world';
import { FrameDrag } from './frameDrag';
import { hitParticle, hitSpring, hitSpringAnchor, hitSum, hitSurfaceBody, hitSurfaceEnd, hitVectorBody, hitVectorTip, snapToSurface } from './hit';
import { ICONS } from './icons';
import type { Tool, ToolContext, WorldPointer } from './tool';

/** Distancia en píxeles a la que una partícula soltada se apoya sola en una superficie. */
const SNAP_PX = 12;

/**
 * Arrastre de una partícula. Tocar sin arrastrar solo la selecciona (se puede mirar su v en pleno vuelo);
 * al moverla de verdad, el lanzamiento se olvida y su posición actual pasa a ser la inicial.
 * Cerca de una superficie, la partícula queda apoyada exactamente sobre ella.
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
    const target = snapToSurface(ctx.world, { x: p.x + this.grab.x, y: p.y + this.grab.y }, ctx.view.m(SNAP_PX));
    this.q.pos.x = target.x;
    this.q.pos.y = target.y;
  }

  /** Al soltar: si quedó estirando o comprimiendo un resorte, el relato se entera. */
  finish(ctx: ToolContext): void {
    if (!this.moved) return;
    const stretched = ctx.world.springsOf(this.q.id).some((sp) => Math.abs(ctx.world.springLength(sp) - sp.restLength) > 0.3);
    if (stretched) ctx.emit({ type: 'spring-stretched' });
  }
}

/** Arrastre del punto fijo de un resorte. */
class AnchorDrag {
  private moved = false;

  constructor(
    private sp: SpringLink,
    private end: 'a' | 'b',
  ) {}

  move(p: Vec2, ctx: ToolContext): void {
    if (!this.moved) {
      this.moved = true;
      if (ctx.sim.hasRun) ctx.sim.reset();
    }
    this.sp[this.end] = { anchor: { ...p } };
  }
}

/**
 * Arrastre de una superficie entera o de uno de sus extremos (para inclinarla).
 * Las partículas apoyadas en ella se mueven con ella: así se puede ir inclinando de a poco
 * una superficie con una partícula encima y buscar el ángulo en que empieza a deslizar.
 */
class SurfaceDrag {
  private moved = false;
  private last: Vec2;
  /** partículas apoyadas y su posición relativa a lo largo del segmento (0 en a, 1 en b) */
  private riders: { q: Particle; frac: number }[] = [];

  constructor(
    private s: Surface,
    private end: 'a' | 'b' | null,
    p: Vec2,
  ) {
    this.last = { ...p };
  }

  move(p: Vec2, ctx: ToolContext): void {
    if (!this.moved) {
      this.moved = true;
      // la geometría cambia: se vuelve al comienzo del lanzamiento (las partículas a su posición inicial)
      if (ctx.sim.hasRun) ctx.sim.reset();
      const f = surfaceFrame(this.s);
      for (const q of ctx.world.particles) {
        const { d, u } = surfaceCoords(this.s, f, q.pos);
        if (Math.abs(d) < 1e-6 && u >= 0 && u <= f.length) this.riders.push({ q, frac: u / f.length });
      }
    }
    if (this.end) {
      this.s[this.end] = { ...p };
    } else {
      const dx = p.x - this.last.x;
      const dy = p.y - this.last.y;
      this.s.a = { x: this.s.a.x + dx, y: this.s.a.y + dy };
      this.s.b = { x: this.s.b.x + dx, y: this.s.b.y + dy };
    }
    this.last = { ...p };
    const { a, b } = this.s;
    for (const { q, frac } of this.riders) {
      q.pos.x = a.x + frac * (b.x - a.x);
      q.pos.y = a.y + frac * (b.y - a.y);
    }
  }
}

type Drag =
  | { kind: 'frame'; d: FrameDrag }
  | { kind: 'particle'; d: ParticleDrag }
  | { kind: 'surface'; d: SurfaceDrag }
  | { kind: 'anchor'; d: AnchorDrag }
  | { kind: 'tip'; v: FreeVector }
  | { kind: 'body'; v: FreeVector; last: Vec2 }
  /** arrastrar el espacio vacío recorre el mundo */
  | { kind: 'pan'; grab: Vec2 };

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
      // la que se mueve sola no se puede arrastrar: solo mirar
      if (!q.locked) this.drag = { kind: 'particle', d: new ParticleDrag(q, p, view.m(4)) };
      return;
    }
    const tip = hitVectorTip(world, p, tol);
    if (tip?.fixed) {
      // una tarjeta de la sonda no se estira: tomarla por la punta la traslada entera
      ctx.select({ kind: 'vector', id: tip.id });
      this.drag = { kind: 'body', v: tip, last: p };
      return;
    }
    if (tip) {
      ctx.select({ kind: 'vector', id: tip.id });
      this.drag = { kind: 'tip', v: tip };
      return;
    }
    const anchor = hitSpringAnchor(world, p, tol);
    if (anchor) {
      ctx.select({ kind: 'spring', id: anchor.sp.id });
      this.drag = { kind: 'anchor', d: new AnchorDrag(anchor.sp, anchor.end) };
      return;
    }
    const end = hitSurfaceEnd(world, p, tol);
    if (end && !end.s.locked) {
      ctx.select({ kind: 'surface', id: end.s.id });
      this.drag = { kind: 'surface', d: new SurfaceDrag(end.s, end.end, p) };
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
    const spring = hitSpring(world, p, tol);
    if (spring) {
      ctx.select({ kind: 'spring', id: spring.id });
      return;
    }
    const s = hitSum(world, p, tol);
    if (s) {
      ctx.select({ kind: 'sum', id: s.id });
      return;
    }
    const surf = hitSurfaceBody(world, p, tol);
    if (surf) {
      ctx.select({ kind: 'surface', id: surf.id });
      if (!surf.locked) this.drag = { kind: 'surface', d: new SurfaceDrag(surf, null, p) };
      return;
    }
    ctx.select(null);
    this.drag = { kind: 'pan', grab: { ...p } };
  }

  onPointerMove({ p }: WorldPointer, ctx: ToolContext): void {
    const d = this.drag;
    if (!d) return;
    if (d.kind === 'frame' || d.kind === 'particle' || d.kind === 'surface' || d.kind === 'anchor') d.d.move(p, ctx);
    else if (d.kind === 'pan') {
      // el punto tomado queda bajo el puntero
      ctx.view.center = { x: ctx.view.center.x + d.grab.x - p.x, y: ctx.view.center.y + d.grab.y - p.y };
    } else if (d.kind === 'tip') d.v.tip = { ...p };
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
    if (this.drag?.kind === 'particle') this.drag.d.finish(ctx);
    // una tarjeta soltada cerca de la sonda o de la punta de otra queda pegada: cola con punta
    if (this.drag?.kind === 'body' && this.drag.v.fixed && ctx.world.snapVector(this.drag.v)) ctx.emit({ type: 'vector-snapped' });
    this.drag = null;
  }
}

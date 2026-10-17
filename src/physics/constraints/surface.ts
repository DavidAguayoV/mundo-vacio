import type { Vec2 } from '../../core/vec';
import { ContactSet, STICK_SPEED, contactTangent, surfaceCoords, surfaceFrame, type Contact, type SurfaceLike } from '../contact';
import type { ForceWorld, SystemState } from '../state';
import type { Constraint } from './index';

/** Distancia (m) bajo la cual una partícula se considera apoyada al empezar un lanzamiento. */
const ON_SURFACE = 1e-6;
/** Rapidez normal (m/s) con que una partícula apoyada puede separarse de la superficie. */
const LIFT_SPEED = 1e-3;

/**
 * Superficies rígidas de dos caras (segmentos). Cada partícula queda del lado en que empezó:
 * - si en un paso cruza la recta dentro del segmento, choca: vuelve a la superficie, pierde
 *   la velocidad normal (choque plástico, sin rebote) y queda apoyada;
 * - mientras está apoyada, se corrige la deriva numérica (posición sobre la recta, sin velocidad hacia adentro);
 * - se separa si sale por un extremo o si se mueve alejándose;
 * - si el deslizamiento cambia de sentido en un paso, se detiene: desde ahí rige el roce estático.
 */
export class SurfaceConstraint implements Constraint {
  readonly kind = 'surface' as const;
  readonly contacts = new ContactSet();
  /** lado (+1 / −1) de cada par partícula|superficie */
  private side = new Map<string, number>();

  constructor(private surfaces: () => readonly SurfaceLike[]) {}

  reset(): void {
    this.contacts.clear();
    this.side.clear();
  }

  /** Al empezar un lanzamiento: anota de qué lado está cada partícula y cuáles ya están apoyadas. */
  begin(s: SystemState, world: ForceWorld): void {
    this.reset();
    for (let i = 0; i < s.ids.length; i++) {
      for (const surf of this.surfaces()) {
        const f = surfaceFrame(surf);
        const { d, u } = surfaceCoords(surf, f, s.pos[i]);
        let sign = Math.sign(d);
        if (Math.abs(d) < ON_SURFACE && u >= 0 && u <= f.length && !this.contacts.get(s.ids[i])) {
          // apoyada desde el inicio: queda del lado contrario a g (encima, si hay gravedad)
          const g = world.gAt ? world.gAt(s.pos[i]) : world.g;
          sign = g && g.x * f.n.x + g.y * f.n.y > 0 ? -1 : 1;
          const c: Contact = { surface: surf, n: { x: sign * f.n.x, y: sign * f.n.y }, slide: 0 };
          this.contacts.set(s.ids[i], c);
          this.project(s, i, surf);
          this.removeInward(s.vel[i], c.n);
          c.slide = this.slideOf(s.vel[i], c.n);
        }
        this.side.set(`${s.ids[i]}|${surf.id}`, sign || 1);
      }
    }
  }

  apply(s: SystemState): void {
    const surfaces = this.surfaces();
    for (let i = 0; i < s.ids.length; i++) {
      const id = s.ids[i];
      const c = this.contacts.get(id);
      if (c) {
        if (this.maintain(s, i, c)) continue;
        this.contacts.delete(id);
      }
      for (const surf of surfaces) {
        const key = `${id}|${surf.id}`;
        const f = surfaceFrame(surf);
        const { d, u } = surfaceCoords(surf, f, s.pos[i]);
        const side = this.side.get(key);
        if (side === undefined) {
          this.side.set(key, Math.sign(d) || 1);
          continue;
        }
        if (side * d >= 0 || u < 0 || u > f.length) continue;
        // cruzó la superficie dentro del segmento: choque plástico
        const n = { x: side * f.n.x, y: side * f.n.y };
        this.project(s, i, surf);
        this.removeInward(s.vel[i], n);
        this.contacts.set(id, { surface: surf, n, slide: this.slideOf(s.vel[i], n) });
        break;
      }
    }
  }

  /** Mantiene una partícula apoyada y fija el sentido de deslizamiento del paso siguiente. Devuelve false si se separó. */
  private maintain(s: SystemState, i: number, c: Contact): boolean {
    const surf = c.surface;
    if (!this.surfaces().includes(surf)) return false;
    const f = surfaceFrame(surf);
    const { u } = surfaceCoords(surf, f, s.pos[i]);
    if (u < 0 || u > f.length) return false;
    const v = s.vel[i];
    const vn = v.x * c.n.x + v.y * c.n.y;
    if (vn > LIFT_SPEED) return false;
    this.project(s, i, surf);
    v.x -= vn * c.n.x;
    v.y -= vn * c.n.y;
    const t = contactTangent(c.n);
    const vt = v.x * t.x + v.y * t.y;
    // el deslizamiento se invirtió en este paso (o es despreciable): la partícula se detuvo
    if ((c.slide !== 0 && vt * c.slide <= 0) || Math.abs(vt) < STICK_SPEED) {
      v.x = 0;
      v.y = 0;
      c.slide = 0;
    } else {
      c.slide = Math.sign(vt);
    }
    return true;
  }

  private slideOf(v: Vec2, n: Vec2): number {
    const t = contactTangent(n);
    const vt = v.x * t.x + v.y * t.y;
    return Math.abs(vt) < STICK_SPEED ? 0 : Math.sign(vt);
  }

  private removeInward(v: Vec2, n: Vec2): void {
    const vn = v.x * n.x + v.y * n.y;
    if (vn < 0) {
      v.x -= vn * n.x;
      v.y -= vn * n.y;
    }
  }

  /** Lleva la partícula i exactamente a la recta de la superficie. */
  private project(s: SystemState, i: number, surf: SurfaceLike): void {
    const f = surfaceFrame(surf);
    const { d } = surfaceCoords(surf, f, s.pos[i]);
    s.pos[i].x -= d * f.n.x;
    s.pos[i].y -= d * f.n.y;
  }

  /** Normal de contacto de una partícula apoyada (hacia su lado), o null. */
  contactNormal(id: string): Vec2 | null {
    return this.contacts.get(id)?.n ?? null;
  }
}

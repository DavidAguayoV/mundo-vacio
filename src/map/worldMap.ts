import type { Vec2 } from '../core/vec';
import { withAlpha, type Palette } from '../render/theme';
import { View } from '../render/view';
import type { SiteEngine } from '../story/siteEngine';
import type { Site } from '../story/types';
import { $, h } from '../ui/dom';

/** Cuántas unidades del mapa caben en el lado menor de la pantalla con zoom 1. */
const MAP_UNITS = 62;
/** En el celular el mapa parte más cerca (se recorre arrastrando): así los rastros no se amontonan. */
const MAP_UNITS_NARROW = 38;
/** Zoom con que se «entra» a un rastro antes de cambiar al lienzo del rastro. */
const ENTER_ZOOM = 4;

interface Flight {
  from: { center: Vec2; zoom: number };
  to: { center: Vec2; zoom: number };
  t0: number;
  dur: number;
  done?: () => void;
}

export interface MapActions {
  /** el jugador tocó un rastro (o el vacío, con null) */
  select(id: string | null): void;
  /** doble toque o Enter sobre un rastro */
  enter(id: string): void;
}

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Estrellas de fondo, siempre las mismas (un generador con semilla fija). */
function makeStars(n: number): { x: number; y: number; r: number; a: number }[] {
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: n }, () => ({ x: (rnd() - 0.5) * 110, y: (rnd() - 0.5) * 110, r: 0.5 + rnd() * 0.8, a: 0.15 + rnd() * 0.3 }));
}

/**
 * El mapa del mundo: las zonas como luces tenues, los caminos desde el claro y cada rastro como
 * un botón sobre el lienzo (así se puede recorrer con el teclado y lo leen los lectores de pantalla).
 */
export class WorldMap {
  readonly view = new View(MAP_UNITS);
  private layer = $('siteLayer');
  private markers = new Map<string, HTMLButtonElement>();
  private stars = makeStars(160);
  private flight: Flight | null = null;
  selected: string | null = null;

  constructor(
    private story: SiteEngine,
    private actions: MapActions,
  ) {
    for (const s of story.sites) {
      const b = h('button', { class: 'site-marker', type: 'button', 'data-site': s.id });
      b.append(h('span', { class: 'dot', 'aria-hidden': 'true' }), h('span', { class: 'name' }, s.title), h('span', { class: 'stars', 'aria-hidden': 'true' }));
      b.addEventListener('click', () => this.actions.select(s.id));
      b.addEventListener('dblclick', () => this.actions.enter(s.id));
      this.markers.set(s.id, b);
    }
    this.layer.replaceChildren(...this.markers.values());
  }

  /** Vista de inicio del mapa: en pantallas anchas, algo corrida a la derecha para no quedar bajo la tarjeta. */
  private get home(): Vec2 {
    return this.view.W < 700 ? { x: 0, y: 0 } : { x: -5, y: 0 };
  }

  resize(W: number, H: number, dpr: number): void {
    // el mapa se centra en la pantalla (en el celular, algo más abajo para dejar ver la tarjeta)
    this.view.cyRatio = W < 700 ? 0.56 : 0.5;
    this.view.unitsAcross = W < 700 ? MAP_UNITS_NARROW : MAP_UNITS;
    this.view.resize(W, H, dpr);
  }

  set visible(v: boolean) {
    this.layer.hidden = !v;
  }

  /** Estado de cada marcador (llamar cuando cambia el avance o la selección). */
  refresh(): void {
    for (const s of this.story.sites) {
      const b = this.markers.get(s.id)!;
      const st = this.story.status(s);
      const stars = this.story.stars(s.id).length;
      const max = this.story.maxStars(s);
      b.className = `site-marker ${st}${this.selected === s.id ? ' selected' : ''}`;
      b.setAttribute('aria-pressed', String(this.selected === s.id));
      const zone = this.story.zone(s.zone)?.name ?? '';
      const what = st === 'resuelto' ? `resuelto, ${stars} de ${max} estrellas` : st === 'disponible' ? 'disponible' : 'todavía cerrado';
      b.setAttribute('aria-label', `${s.title}, en ${zone}: ${what}`);
      b.querySelector('.stars')!.textContent = st === 'resuelto' ? '★'.repeat(stars) + '☆'.repeat(Math.max(0, max - stars)) : '';
    }
  }

  // ---------- cámara del mapa ----------

  /** Vuela la cámara del mapa hasta un punto (con zoom); sin animación si se pidió menos movimiento. */
  flyTo(center: Vec2, zoom: number, dur: number, done?: () => void): void {
    const to = { center: { ...center }, zoom };
    if (reducedMotion() || dur <= 0) {
      this.view.reset(to.center, to.zoom);
      this.flight = null;
      done?.();
      return;
    }
    this.flight = { from: { center: { ...this.view.center }, zoom: this.view.zoom }, to, t0: performance.now(), dur, done };
  }

  /** Acercarse a un rastro antes de entrar. */
  diveInto(site: Site, done: () => void): void {
    this.flyTo(site.at, ENTER_ZOOM, 420, done);
  }

  /** Salir de un rastro: el mapa parte acercado sobre él y se aleja. */
  riseFrom(site: Site | null, dur = 650): void {
    if (site) this.view.reset(site.at, ENTER_ZOOM);
    this.flyTo(this.home, 1, dur);
  }

  get flying(): boolean {
    return !!this.flight;
  }

  private tickFlight(now: number): void {
    const f = this.flight;
    if (!f) return;
    const t = Math.min(1, (now - f.t0) / f.dur);
    const k = ease(t);
    // el zoom se interpola en escala logarítmica: se siente parejo al acercarse
    const z = Math.exp(Math.log(f.from.zoom) + (Math.log(f.to.zoom) - Math.log(f.from.zoom)) * k);
    this.view.reset({ x: f.from.center.x + (f.to.center.x - f.from.center.x) * k, y: f.from.center.y + (f.to.center.y - f.from.center.y) * k }, z);
    if (t >= 1) {
      this.flight = null;
      f.done?.();
    }
  }

  // ---------- dibujo ----------

  draw(ctx: CanvasRenderingContext2D, pal: Palette, now: number): void {
    this.tickFlight(now);
    const v = this.view;
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.clearRect(0, 0, v.W, v.H);

    // estrellas lejanas: se mueven menos que el mapa (paralaje), así el vacío tiene profundidad
    ctx.fillStyle = pal.muted;
    for (const s of this.stars) {
      const x = v.W / 2 + (s.x - v.center.x * 0.35) * v.S * 0.55;
      const y = v.H / 2 - (s.y - v.center.y * 0.35) * v.S * 0.55;
      if (x < -2 || y < -2 || x > v.W + 2 || y > v.H + 2) continue;
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const claro = this.story.zones[0].at;
    for (const z of this.story.zones) {
      const sites = this.story.sites.filter((s) => s.zone === z.id);
      const solved = sites.filter((s) => this.story.isSolved(s.id)).length;
      const open = sites.some((s) => this.story.status(s) === 'disponible');
      const x = v.sx(z.at.x);
      const y = v.sy(z.at.y);
      // luz de la zona: crece con lo que ya se resolvió allí
      const lit = sites.length ? solved / sites.length : 0;
      const R = 10 * v.S;
      if (lit > 0 || open) {
        const g = ctx.createRadialGradient(x, y, 0, x, y, R);
        const a = pal.glowAlpha * (0.6 + 1.6 * lit);
        g.addColorStop(0, withAlpha(pal.glow, a));
        g.addColorStop(1, withAlpha(pal.glow, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, R, 0, Math.PI * 2);
        ctx.fill();
      }
      // camino desde el claro: más visible si ya se puede ir
      if (z.id !== 'claro') {
        ctx.strokeStyle = pal.muted;
        ctx.globalAlpha = solved ? 0.4 : open ? 0.28 : 0.1;
        ctx.setLineDash([1, 6]);
        ctx.lineCap = 'round';
        ctx.lineWidth = 1.2;
        const ux = z.at.x - claro.x;
        const uy = z.at.y - claro.y;
        const L = Math.hypot(ux, uy) || 1;
        ctx.beginPath();
        ctx.moveTo(v.sx(claro.x + (ux / L) * 5), v.sy(claro.y + (uy / L) * 5));
        ctx.lineTo(v.sx(z.at.x - (ux / L) * 6.5), v.sy(z.at.y - (uy / L) * 6.5));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineCap = 'butt';
        ctx.globalAlpha = 1;
      }
      // nombre de la zona y qué física hay allí, sobre el rastro más alto de la zona
      const top = Math.max(z.at.y + 1, ...sites.map((s) => s.at.y)) - z.at.y + 2.6;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = solved || open ? 0.95 : 0.45;
      ctx.fillStyle = pal.ink;
      ctx.font = `italic 400 ${Math.round(Math.min(30, Math.max(17, v.S * 0.75)))}px ${pal.serif}`;
      ctx.fillText(z.name, x, y - top * v.S - 14);
      ctx.globalAlpha *= 0.75;
      ctx.fillStyle = pal.muted;
      ctx.font = `400 11.5px ${pal.sans}`;
      ctx.fillText(z.hint, x, y - top * v.S + 2);
      ctx.globalAlpha = 1;
    }
    this.placeMarkers();
  }

  private placeMarkers(): void {
    const v = this.view;
    for (const s of this.story.sites) {
      const b = this.markers.get(s.id)!;
      const t = `translate(${Math.round(v.sx(s.at.x))}px, ${Math.round(v.sy(s.at.y))}px)`;
      if (b.style.transform !== t) b.style.transform = t;
    }
  }

  // ---------- puntero sobre el mapa ----------

  private pointers = new Map<number, { x: number; y: number }>();
  private last: { x: number; y: number; d?: number } | null = null;
  private movedPx = 0;

  onDown(id: number, x: number, y: number): void {
    this.pointers.set(id, { x, y });
    this.flight = null;
    this.movedPx = 0;
    this.last = this.gesture();
  }

  onMove(id: number, x: number, y: number): void {
    if (!this.pointers.has(id)) return;
    this.pointers.set(id, { x, y });
    const now = this.gesture();
    if (this.last && now) {
      if (now.d && this.last.d) this.view.zoomAt(now.x, now.y, now.d / this.last.d);
      this.view.panPx(now.x - this.last.x, now.y - this.last.y);
      this.movedPx += Math.hypot(now.x - this.last.x, now.y - this.last.y);
    }
    this.last = now;
  }

  onUp(id: number): void {
    this.pointers.delete(id);
    this.last = this.gesture();
    // un toque en el vacío (sin arrastrar) quita la selección
    if (!this.pointers.size && this.movedPx < 6) this.actions.select(null);
  }

  onWheel(x: number, y: number, factor: number): void {
    this.flight = null;
    this.view.zoomAt(x, y, factor);
  }

  private gesture(): { x: number; y: number; d?: number } | null {
    const p = [...this.pointers.values()];
    if (!p.length) return null;
    if (p.length === 1) return { x: p[0].x, y: p[0].y };
    return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2, d: Math.max(1, Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y)) };
  }
}

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

/** Lo que un modo de juego cambia en el mapa (la demo). Sin ganchos, es el mapa de siempre. */
export interface MapHooks {
  /** zonas con nombre; null: las de namedZones */
  named?(): Set<string> | null;
  /** rastros que se ven solo como un punto muy atenuado, sin nombre, y no se pueden elegir */
  faint?(site: Site): boolean;
  /** lo que la cámara encuadra al volver al mapa; null: el mapa entero */
  focus?(): Vec2[] | null;
}

/** Zoom máximo con que el mapa encuadra lo que pide un modo de juego. */
const FOCUS_ZOOM_MAX = 2.6;

/** Distancia (unidades del mapa) hasta la que una zona cuenta como vecina de una abierta. */
const NEIGHBOR = 20;

/**
 * Zonas que llevan nombre en el mapa: las abiertas (el claro y las que tienen algún rastro
 * disponible o resuelto) y sus vecinas. El resto se ve como puntos atenuados, sin nombre.
 */
export function namedZones(story: SiteEngine): Set<string> {
  const open = story.zones.filter((z) => z.id === 'claro' || story.sites.some((s) => s.zone === z.id && story.status(s) !== 'cerrado'));
  const out = new Set(open.map((z) => z.id));
  for (const z of story.zones) if (open.some((o) => Math.hypot(o.at.x - z.at.x, o.at.y - z.at.y) <= NEIGHBOR)) out.add(z.id);
  return out;
}

/** Un rectángulo en píxeles de pantalla. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const overlaps = (a: Box, b: Box, pad = 2) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/**
 * Qué etiquetas se muestran: recorre `boxes` en orden de prioridad y se queda con las que caben
 * enteras en la pantalla (W × H) y no pisan a una ya elegida ni a lo que está en `taken`.
 */
export function pickLabels(boxes: Box[], W: number, H: number, taken: Box[] = []): boolean[] {
  const kept = [...taken];
  return boxes.map((b) => {
    const inside = b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H;
    if (!inside || kept.some((k) => overlaps(k, b))) return false;
    kept.push(b);
    return true;
  });
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
  /** zonas con nombre (ver namedZones); se recalcula en refresh() */
  private named = new Set<string>();
  /** rótulos de zona dibujados en este cuadro: los nombres de los rastros no se les montan */
  private zoneBoxes: Box[] = [];
  /** vista y avance con que se repartieron los nombres por última vez */
  private labelKey = '';
  /** zonas que van apareciendo con nombre, una tras otra (ver reveal) */
  private revealing: { t0: number; order: string[]; every: number } | null = null;
  private revealShown = -1;
  /** ganchos de un modo de juego (la demo) */
  hooks: MapHooks = {};

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

  /** Adónde vuelve la cámara: el mapa entero o, si un modo de juego lo pide, lo que hay que mirar. */
  private homeTarget(): { center: Vec2; zoom: number } {
    const pts = this.hooks.focus?.();
    return pts?.length ? this.frameOf(pts) : { center: this.home, zoom: 1 };
  }

  /**
   * Cámara que encuadra unos puntos del mapa en lo que dejan libre la tarjeta (a la izquierda en una
   * pantalla ancha, arriba en el celular) y la barra; nunca más lejos que el mapa entero.
   */
  frameOf(points: Vec2[], pad = 6): { center: Vec2; zoom: number } {
    const v = this.view;
    const minX = Math.min(...points.map((p) => p.x)) - pad;
    const maxX = Math.max(...points.map((p) => p.x)) + pad;
    const minY = Math.min(...points.map((p) => p.y)) - pad;
    const maxY = Math.max(...points.map((p) => p.y)) + pad;
    const card = document.getElementById('card')?.getBoundingClientRect();
    const bar = document.getElementById('bar')?.getBoundingClientRect();
    const narrow = v.W < 700;
    const left = !narrow && card?.width ? card.right + 12 : 0;
    const top = narrow && card?.height ? card.bottom + 8 : 0;
    const bottom = bar?.height ? bar.top - 8 : v.H;
    const zoom = Math.max(1, Math.min(FOCUS_ZOOM_MAX, (v.W - left) / ((maxX - minX) * v.base), (bottom - top) / ((maxY - minY) * v.base)));
    const S = v.base * zoom;
    const px = (left + v.W) / 2;
    const py = (top + bottom) / 2;
    const cy = v.H * (v.cyRatio ?? 0.5);
    return { center: { x: (minX + maxX) / 2 - (px - v.W / 2) / S, y: (minY + maxY) / 2 - (cy - py) / S }, zoom };
  }

  /**
   * Las zonas aparecen con nombre una tras otra (el final de la demo). Con menos movimiento,
   * todas a la vez.
   */
  reveal(order: string[], every = 260): void {
    this.revealing = reducedMotion() ? null : { t0: performance.now(), order, every };
    this.revealShown = -1;
    this.refresh();
  }

  /** Cuánto se ve el nombre de una zona: 1 si ya apareció, 0 si todavía no le toca (ver reveal). */
  private nameAlpha(id: string, now: number): number {
    if (!this.named.has(id)) return 0;
    const r = this.revealing;
    const i = r ? r.order.indexOf(id) : -1;
    if (!r || i < 0) return 1;
    return Math.min(1, Math.max(0, (now - r.t0 - i * r.every) / r.every));
  }

  /** ¿La zona todavía no aparece en el final de la demo? */
  private unrevealed(zone: string): boolean {
    const r = this.revealing;
    if (!r || !r.order.includes(zone)) return false;
    return performance.now() < r.t0 + r.order.indexOf(zone) * r.every;
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
    this.named = this.hooks.named?.() ?? namedZones(this.story);
    this.labelKey = '';
    for (const s of this.story.sites) {
      const b = this.markers.get(s.id)!;
      const st = this.story.status(s);
      const stars = this.story.stars(s.id).length;
      const max = this.story.maxStars(s);
      const faint = !!this.hooks.faint?.(s);
      // en una zona sin nombre, el rastro es solo un punto atenuado (el nombre aparece al enfocarlo)
      const quiet = faint || (!this.named.has(s.zone) && this.selected !== s.id) || this.unrevealed(s.zone);
      b.className = `site-marker ${st}${this.selected === s.id ? ' selected' : ''}${quiet ? ' quiet' : ''}${faint ? ' faint' : ''}`;
      // un punto de fondo no se elige ni se lee: solo insinúa que hay más mundo
      b.tabIndex = faint ? -1 : 0;
      if (faint) b.setAttribute('aria-hidden', 'true');
      else b.removeAttribute('aria-hidden');
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

  /** Salir de un rastro: el mapa parte acercado sobre él y se aleja (y después, si se pide, done). */
  riseFrom(site: Site | null, dur = 650, done?: () => void): void {
    if (site) this.view.reset(site.at, ENTER_ZOOM);
    const to = this.homeTarget();
    this.flyTo(to.center, to.zoom, dur, done);
  }

  /** Aleja la cámara hasta el mapa entero (el final de la demo). */
  showAll(dur = 1600, done?: () => void): void {
    this.flyTo(this.home, 1, dur, done);
  }

  get flying(): boolean {
    return !!this.flight;
  }

  private tickFlight(now: number): void {
    const f = this.flight;
    if (!f) return;
    // el tiempo de un cuadro puede ser algo anterior al instante en que empezó el vuelo
    const t = Math.min(1, Math.max(0, (now - f.t0) / f.dur));
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
    const r = this.revealing;
    if (r) {
      // cada zona que aparece destapa los nombres de sus rastros
      const shown = r.order.filter((_, i) => now >= r.t0 + i * r.every).length;
      if (now >= r.t0 + (r.order.length + 1) * r.every) {
        this.revealing = null;
        this.refresh();
      } else if (shown !== this.revealShown) {
        this.revealShown = shown;
        this.refresh();
      }
    }
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
      // una zona sin nombre es un punto atenuado
      if (this.nameAlpha(z.id, now) < 1) {
        ctx.fillStyle = pal.muted;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(x, y, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    this.drawZoneLabels(ctx, pal, now);
    this.placeMarkers();
  }

  /** La tarjeta y la barra tapan el mapa: ningún rótulo ni nombre se dibuja debajo. */
  private uiBoxes(): Box[] {
    const out: Box[] = [];
    const origin = this.layer.getBoundingClientRect();
    const add = (r: DOMRect) => {
      if (r.width && r.height) out.push({ x: r.left - origin.left - 6, y: r.top - origin.top - 6, w: r.width + 12, h: r.height + 12 });
    };
    // de la tarjeta, solo lo escrito (cada renglón con su largo real) y sus botones: el resto de su caja es vacío
    const card = document.getElementById('card');
    if (card && !card.hidden && this.view.W <= 700) {
      // en el celular la tarjeta lleva un fondo a todo el ancho que llega bajo los botones
      const r = card.getBoundingClientRect();
      add(new DOMRect(0, r.top, this.view.W, r.height + 28));
    } else if (card && !card.hidden) {
      const range = document.createRange();
      for (const el of card.querySelectorAll<HTMLElement>('.eyebrow, h1, p, blockquote')) {
        if (!el.textContent?.trim() || !el.offsetParent) continue;
        range.selectNodeContents(el);
        for (const r of range.getClientRects()) add(r);
      }
      card.querySelectorAll<HTMLElement>('button').forEach((b) => b.offsetParent && add(b.getBoundingClientRect()));
    }
    // de la barra, sus botones (la zona vacía del medio no tapa nada)
    document.querySelectorAll<HTMLElement>('#bar .tool').forEach((b) => b.offsetParent && add(b.getBoundingClientRect()));
    return out;
  }

  /**
   * Nombre de cada zona con nombre y qué física hay allí, sobre su rastro más alto. Se corren hacia
   * adentro si quedarían cortados en el borde, y si dos se pisan queda el de la zona abierta.
   */
  private drawZoneLabels(ctx: CanvasRenderingContext2D, pal: Palette, now: number): void {
    const v = this.view;
    const nameFont = `italic 400 ${Math.round(Math.min(30, Math.max(17, v.S * 0.75)))}px ${pal.serif}`;
    const hintFont = `400 11.5px ${pal.sans}`;
    const nameSize = Math.round(Math.min(30, Math.max(17, v.S * 0.75)));
    const items = this.story.zones
      .filter((z) => this.nameAlpha(z.id, now) > 0)
      .map((z) => {
        const sites = this.story.sites.filter((s) => s.zone === z.id);
        const lit = sites.some((s) => this.story.status(s) !== 'cerrado');
        const top = Math.max(z.at.y + 1, ...sites.map((s) => s.at.y)) - z.at.y + 2.6;
        const yName = v.sy(z.at.y) - top * v.S - 14;
        const yHint = v.sy(z.at.y) - top * v.S + 2;
        ctx.font = nameFont;
        const wName = ctx.measureText(z.name).width;
        ctx.font = hintFont;
        const wHint = ctx.measureText(z.hint).width;
        const w = Math.max(wName, wHint);
        // corrido hacia adentro: el nombre nunca queda cortado en el borde
        const x = Math.min(Math.max(v.sx(z.at.x), w / 2 + 8), v.W - w / 2 - 8);
        const box: Box = { x: x - w / 2, y: yName - nameSize * 0.85, w, h: yHint + 3 - (yName - nameSize * 0.85) };
        return { z, lit, x, yName, yHint, box };
      })
      // primero el claro y las zonas abiertas; después las vecinas
      .sort((a, b) => Number(b.z.id === 'claro') - Number(a.z.id === 'claro') || Number(b.lit) - Number(a.lit));
    // los puntos de los rastros no quedan bajo un rótulo: si pisa uno, el rótulo sube un poco
    const dots: Box[] = this.story.sites.map((s) => ({ x: v.sx(s.at.x) - 8, y: v.sy(s.at.y) - 8, w: 16, h: 16 }));
    this.zoneBoxes = [...this.uiBoxes()];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    items.forEach((it) => {
      const lift = [0, 14, 28, 42, 56, -14, -28].find((dy) => pickLabels([{ ...it.box, y: it.box.y - dy }], v.W, v.H, [...this.zoneBoxes, ...dots])[0]);
      if (lift === undefined) return;
      it.box = { ...it.box, y: it.box.y - lift };
      it.yName -= lift;
      it.yHint -= lift;
      this.zoneBoxes.push(it.box);
      ctx.globalAlpha = (it.lit ? 0.95 : 0.5) * this.nameAlpha(it.z.id, now);
      ctx.fillStyle = pal.ink;
      ctx.font = nameFont;
      ctx.fillText(it.z.name, it.x, it.yName);
      ctx.globalAlpha *= 0.75;
      ctx.fillStyle = pal.muted;
      ctx.font = hintFont;
      ctx.fillText(it.z.hint, it.x, it.yHint);
    });
    ctx.globalAlpha = 1;
  }

  private placeMarkers(): void {
    const v = this.view;
    for (const s of this.story.sites) {
      const b = this.markers.get(s.id)!;
      const t = `translate(${Math.round(v.sx(s.at.x))}px, ${Math.round(v.sy(s.at.y))}px)`;
      if (b.style.transform !== t) b.style.transform = t;
    }
    const key = `${v.center.x.toFixed(2)}|${v.center.y.toFixed(2)}|${v.zoom.toFixed(3)}|${v.W}|${v.H}|${this.selected}`;
    if (key !== this.labelKey && !this.layer.hidden) {
      this.labelKey = key;
      this.layoutNames();
    }
  }

  /**
   * Nombres de los rastros: el elegido siempre; después los disponibles, los resueltos y los
   * cerrados, cada uno solo si cabe entero en la pantalla y no pisa un rótulo de zona, otro nombre
   * ni el punto de otro rastro. Los que no caben aparecen al pasar el mouse o al enfocarlos.
   */
  private layoutNames(): void {
    const origin = this.layer.getBoundingClientRect();
    const rel = (r: DOMRect): Box => ({ x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height });
    const rank = { disponible: 1, resuelto: 2, cerrado: 3 } as const;
    const cx = this.view.W / 2;
    const cy = this.view.H / 2;
    const entries = this.story.sites
      .map((s) => ({ s, b: this.markers.get(s.id)! }))
      .filter(({ b }) => !b.classList.contains('quiet'));
    entries.forEach(({ b }) => b.classList.remove('nameless'));
    const dots = this.story.sites.map((s) => rel(this.markers.get(s.id)!.querySelector('.dot')!.getBoundingClientRect()));
    const boxOf = (b: HTMLButtonElement): Box => {
      const parts = [b.querySelector('.name')!, b.querySelector('.stars')!].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0);
      const left = Math.min(...parts.map((r) => r.left));
      const top = Math.min(...parts.map((r) => r.top));
      const right = Math.max(...parts.map((r) => r.right));
      const bottom = Math.max(...parts.map((r) => r.bottom));
      return rel(new DOMRect(left, top, right - left, bottom - top));
    };
    const ordered = entries
      .map((e) => ({ ...e, box: boxOf(e.b), sel: e.s.id === this.selected }))
      .sort(
        (a, b) =>
          Number(b.sel) - Number(a.sel) ||
          rank[this.story.status(a.s)] - rank[this.story.status(b.s)] ||
          Math.hypot(a.box.x - cx, a.box.y - cy) - Math.hypot(b.box.x - cx, b.box.y - cy),
      );
    // el elegido se muestra siempre; los demás, si caben
    const forced = ordered.filter((o) => o.sel).map((o) => o.box);
    const rest = ordered.filter((o) => !o.sel);
    const show = pickLabels(
      rest.map((o) => o.box),
      this.view.W,
      this.view.H,
      [...this.zoneBoxes, ...forced, ...dots],
    );
    rest.forEach((o, k) => o.b.classList.toggle('nameless', !show[k]));
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

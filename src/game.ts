import { EventBus, type GameEvent } from './core/events';
import { dist, type Vec2 } from './core/vec';
import { SurfaceConstraint } from './physics/constraints';
import { FrictionForce, G_GAME, NormalForce, Spring, SpringForces, UniformGravity, WorldDrag, WorldGravitation, type MediumId } from './physics/forces';
import { OscillationMeter } from './physics/oscillationMeter';
import { toWorld } from './physics/rigid';
import { Lab } from './lab/lab';
import { Simulation } from './physics/simulation';
import { Painter, type Rect } from './render/painter';
import { drawScene } from './render/renderer';
import { applyTheme, loadTheme, readPalette } from './render/theme';
import { View } from './render/view';
import { freshProgress, loadProgress, saveProgress, type Progress } from './state/progress';
import { seedFree } from './story/chapters';
import { RunMonitor } from './story/runMonitor';
import { SiteEngine } from './story/siteEngine';
import { CATCH_DIST, SITES, SITE_IDS, ZONES } from './story/sites';
import type { ForceSwitch, Grant, LensId, TimeSkill } from './story/types';
import { WorldMap } from './map/worldMap';
import { Journal } from './ui/journal';
import { FrameDrag } from './tools/frameDrag';
import { TOOL_ORDER, createTools } from './tools/registry';
import type { Tool, ToolContext, ToolId, WorldPointer } from './tools/tool';
import { TreeView } from './tree/treeView';
import { StoryCard } from './ui/card';
import { $ } from './ui/dom';
import { Hud } from './ui/hud';
import { Inspector, K_MAX, K_MIN, L0_MAX, L0_MIN, MU_MAX, clampMass } from './ui/inspector';
import { Toast } from './ui/toast';
import { Timeline } from './ui/timeline';
import { EnergyMeter } from './ui/energyMeter';
import { GraphsPanel } from './ui/graphs';
import { LENS_NAMES, SWITCH_NAMES, TIME_NAMES, Toolbar } from './ui/toolbar';
import { ReferenceFrame } from './world/frame';
import { G_EARTH, World, type EntityRef } from './world/world';

/** Segundos que tarda la sonda en cada salto. */
const PROBE_HOP = 0.45;

/** Radio de toque en píxeles según el dispositivo. */
const TOUCH_PX: Record<string, number> = { touch: 24, pen: 18, mouse: 14 };

export interface GameOptions {
  /** muestra fps en el HUD */
  debug?: boolean;
  /** prueba de rendimiento: N partículas oscilando en resortes, sin tocar el progreso guardado */
  stress?: number;
}

/** Conecta mundo, simulación, render, herramientas, relato e interfaz. */
export class Game {
  private canvas = $<HTMLCanvasElement>('cv');
  private view = new View();
  private world = new World();
  private sim = new Simulation(this.world);
  private bus = new EventBus<GameEvent>();
  private painter: Painter;
  private story: SiteEngine;
  private map: WorldMap;
  private journal: Journal;
  /** rastro elegido en el mapa (su nota se lee en la tarjeta) */
  private mapSelection: string | null = null;
  /** viaje de la sonda por su cadena de vectores, cuando la cadena llega a una baliza */
  private probeTravel: { points: Vec2[]; labels: string; t: number; arrived: boolean } | null = null;
  private probeKey = '';
  /** lanzamiento en que ya se alcanzó la boya (para avisar una sola vez) */
  private caughtRun = -1;
  /** los ejes que el jugador eligió en el claro: siguen con él de un rastro del claro al otro */
  private claroFrame: { origin: Vec2; angle: number } | null = null;

  private tools = createTools();
  private activeTool: Tool;
  private selection: EntityRef | null = null;
  private highlighted = new Set<string>();
  private ctx: ToolContext;

  private card: StoryCard;
  private toolbar: Toolbar;
  private inspector: Inspector;
  private hud: Hud;
  private toast = new Toast();
  private tree: TreeView;
  private lab: Lab;
  private timeline: Timeline;
  private energyMeter = new EnergyMeter();
  private graphs: GraphsPanel;
  /** lentes activos (se recuerdan entre visitas) */
  private lensOn = loadLenses();
  /** cámara lenta en el relato (en el laboratorio vale la preferencia guardada) */
  private storyTimeScale = 1;

  private pointerId: number | null = null;
  private frameDrag: FrameDrag | null = null;
  /** punteros apoyados sobre el lienzo, en px (para el pellizco con dos dedos) */
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: { dist: number; cx: number; cy: number } | null = null;
  /** arrastre de la vista con el botón del medio o el derecho */
  private panFrom: { x: number; y: number } | null = null;
  private lastWorldPointer: WorldPointer | null = null;
  private hitFlash = 0;
  private monitor: RunMonitor;
  private meter: OscillationMeter;
  private structure = '';
  private last = 0;
  private fps = 60;
  private restartArmed = 0;

  constructor(private opts: GameOptions = {}) {
    const ctx2d = this.canvas.getContext('2d');
    if (!ctx2d) throw new Error('Este navegador no tiene Canvas 2D.');
    applyTheme(loadTheme());
    this.painter = new Painter(ctx2d, this.view, readPalette());

    // superficies: la restricción decide quién está apoyado; la normal y el roce leen esos contactos
    const surfaces = new SurfaceConstraint(() => this.world.surfaces);
    this.sim.constraints.push(surfaces);
    this.sim.forces.push(
      new UniformGravity(),
      new SpringForces(() => this.world.springs),
      new WorldGravitation(() => this.world.gravitation),
      new WorldDrag(() => this.world.medium),
      new NormalForce(surfaces.contacts),
      new FrictionForce(surfaces.contacts),
    );
    // las órbitas necesitan más que los 10 s de una caída
    this.sim.maxTime = 30;
    // cronómetro de oscilaciones de cada resorte
    this.meter = new OscillationMeter(this.sim, () => this.world.springs.map((s) => ({ id: s.id, length: this.world.springLength(s) })));
    this.meter.onFirstPeriod = () => this.bus.emit({ type: 'oscillated' });
    this.monitor = new RunMonitor(this.world, this.sim, (ev) => this.bus.emit(ev));

    const stress = opts.stress ?? 0;
    const progress: Progress = stress ? { ...freshProgress(), free: true } : loadProgress(SITE_IDS);
    this.story = new SiteEngine(SITES, ZONES, progress, { world: this.world, view: this.view, sim: this.sim }, stress ? () => {} : saveProgress);
    this.map = new WorldMap(this.story, {
      select: (id) => this.selectSite(id),
      enter: (id) => this.goToSite(id),
    });
    this.journal = new Journal(this.story, () => this.journal.hide());

    // contexto que reciben las herramientas
    const self = this;
    this.ctx = {
      world: this.world,
      view: this.view,
      sim: this.sim,
      get selection() {
        return self.selection;
      },
      select: (ref) => this.select(ref),
      highlighted: this.highlighted,
      emit: (ev) => this.bus.emit(ev),
      toast: (m) => this.toast.show(m),
    };

    this.card = new StoryCard(
      {
        next: () => this.bus.emit({ type: 'next' }),
        choose: (id) => this.story.choose(id),
        openTree: () => this.openTree(),
        goFree: () => this.setFree(true),
        openLab: () => this.lab.show(),
        enter: (id) => this.goToSite(id),
        toMap: () => this.toMap(),
        openJournal: (id) => this.journal.show(id),
        setControl: (id, v) => this.setLabControl(id, v),
        controlValue: (c) => c.get(this.world),
      },
      (g) => this.grantName(g),
    );
    this.toolbar = new Toolbar({
      selectTool: (id) => this.setTool(id),
      flow: () => this.flow(),
      rewind: () => this.rewind(),
      step: () => this.stepTime(),
      slow: () => this.cycleSlow(),
      toggleForce: (id) => this.toggleForce(id),
      toggleLens: (id) => this.toggleLens(id),
      openTree: () => this.openTree(),
      openLab: () => this.lab.show(),
      openMap: () => this.toMap(),
      openJournal: () => this.journal.show(this.story.site?.id),
    });
    this.inspector = new Inspector(this.world, {
      changeMass: (id, k) => {
        const q = this.world.particle(id);
        if (!q) return;
        const m = clampMass(q.mass * k);
        if (m === q.mass) return;
        q.mass = m;
        this.bus.emit({ type: 'mass-changed' });
      },
      changeMu: (id, which, delta) => {
        const sf = this.world.surface(id);
        if (!sf) return;
        const round = (x: number) => Math.round(x * 100) / 100;
        if (which === 'muS') {
          sf.muS = round(Math.min(MU_MAX, Math.max(0, sf.muS + delta)));
          sf.muK = Math.min(sf.muK, sf.muS);
        } else {
          sf.muK = round(Math.min(sf.muS, Math.max(0, sf.muK + delta)));
        }
      },
      changeSpring: (id, which, delta) => {
        const sp = this.world.spring(id);
        if (!sp) return;
        if (this.sim.hasRun) this.sim.reset();
        const round = (x: number) => Math.round(x * 100) / 100;
        if (which === 'k') sp.k = round(Math.min(K_MAX, Math.max(K_MIN, sp.k + delta)));
        else sp.restLength = round(Math.min(L0_MAX, Math.max(L0_MIN, sp.restLength + delta)));
      },
      period: (id) => this.meter.period(id),
      remove: (ref) => {
        this.world.remove(ref);
        if (ref.kind === 'surface' || ref.kind === 'spring') this.sim.clearRun();
        this.select(null);
      },
      forces: (id) => this.sim.forcesOn(id)?.parts ?? null,
      changeLoad: (bodyId, loadId, k) => {
        const b = this.world.body(bodyId);
        const l = b?.loads.find((x) => x.id === loadId);
        if (!b || !l || l.locked) return;
        if (this.sim.hasRun) this.sim.reset();
        if (k === 0) b.loads = b.loads.filter((x) => x !== l);
        else l.mass = clampMass(l.mass * k);
        this.inspector.rebuild();
        this.bus.emit({ type: 'load-moved' });
      },
      changeBodyMass: (bodyId, k) => {
        const b = this.world.body(bodyId);
        if (!b) return;
        if (this.sim.hasRun) this.sim.reset();
        b.mass = clampMass(b.mass * k);
        this.bus.emit({ type: 'mass-changed' });
      },
      flip: (id) => {
        const v = this.world.vector(id);
        if (!v?.fixed) return;
        this.world.flipVector(v);
        this.inspector.rebuild();
        this.bus.emit({ type: 'vector-flipped' });
      },
      close: () => this.select(null),
    });
    this.hud = new Hud(!!opts.debug || stress > 0);
    this.tree = new TreeView(() => this.tree.hide());
    this.lab = new Lab(
      {
        world: this.world,
        sim: this.sim,
        isFree: () => this.story.free,
        enterFree: () => this.setFree(true),
        afterWorldReplaced: () => {
          this.select(null);
          this.highlighted.clear();
          // un laboratorio con guía enciende los lentes que necesita
          for (const l of this.lab?.guide?.guide?.lenses ?? []) this.lensOn.add(l);
          saveLenses(this.lensOn);
          this.view.home = { center: { x: 0, y: 0 }, zoom: 1 };
          this.view.reset();
          this.refreshUI();
          // la guía del laboratorio ya está dibujada en el cuadro siguiente: ahí se sabe qué tapa
          requestAnimationFrame(() => requestAnimationFrame(() => this.fitScene(true)));
        },
        toast: (m) => this.toast.show(m),
      },
      stress === 0,
    );

    this.graphs = new GraphsPanel(this.sim, this.world, (t) => {
      // tocar un gráfico lleva a ese instante (si ya se tiene la línea de tiempo)
      if (!this.has('timeline') || !this.sim.hasRun) return;
      this.sim.seek(t);
      this.checkPeak();
    });
    this.timeline = new Timeline((t) => {
      if (!this.has('timeline')) return;
      this.sim.seek(t);
      this.checkPeak();
    });

    this.activeTool = this.tools[this.initialTool()];
    // ?debug deja el juego a mano en la consola para inspeccionarlo
    if (opts.debug) (window as unknown as { mundo: Game }).mundo = this;
    this.wireEvents();
    this.wireTreeButtons();
  }

  start(): void {
    this.resize();
    if (this.opts.stress) this.seedStress(this.opts.stress);
    else if (this.story.free) {
      if (!this.lab.restoreSlot('lab')) seedFree(this.story.ctx);
    } else if (this.story.site) {
      // el mundo autoguardado del rastro en curso; si no hay, el rastro se arma de nuevo
      const restored = this.lab.restoreSlot('story');
      this.story.resume(!restored);
    }
    this.map.riseFrom(null, 0);
    this.refreshUI();
    if (this.mode !== 'map') this.fitScene(this.mode === 'free');
    void this.lab.loadFromHash();
    this.activeTool.onActivate?.(this.ctx);
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------- estado ----------

  private initialTool(): ToolId {
    if (this.story.free) return 'move';
    const tools = [...this.unlocked()];
    // la última herramienta ganada, o la primera disponible
    const grants = [...this.story.grants()].filter((g): g is `tool:${ToolId}` => g.startsWith('tool:'));
    const last = grants.at(-1)?.slice(5) as ToolId | undefined;
    return last && tools.includes(last) ? last : (tools[0] ?? 'origin');
  }

  private has(skill: TimeSkill): boolean {
    return this.story.timeSkills().has(skill);
  }

  private get timeScale(): number {
    if (this.story.free) return this.lab.prefs.timeScale;
    return this.has('slow') ? this.storyTimeScale : 1;
  }

  private unlocked() {
    return this.story.unlockedTools(TOOL_ORDER);
  }

  /** En el mapa, dentro de un rastro o en el laboratorio libre. */
  private get mode(): 'map' | 'site' | 'free' {
    if (this.story.free) return 'free';
    return this.story.site ? 'site' : 'map';
  }

  private refreshUI(fresh: readonly Grant[] = []): void {
    const unlocked = this.unlocked();
    if (!unlocked.has(this.activeTool.id)) this.setTool(this.initialTool(), false);
    const inMap = this.mode === 'map';
    this.toolbar.render({
      tools: inMap ? [] : TOOL_ORDER.filter((id) => unlocked.has(id)).map((id) => this.tools[id]),
      active: this.activeTool.id,
      time: inMap ? new Set() : this.story.timeSkills(),
      switches: inMap ? [] : [...this.story.forceSwitches()].map((id) => ({ id, on: this.forceOn(id), label: this.switchLabel(id) })),
      lenses: inMap ? [] : [...this.story.lenses()].map((id) => ({ id, on: this.lensOn.has(id) })),
      // los laboratorios con guía se abren desde cualquier parte
      labEnabled: true,
      mapEnabled: !inMap,
      running: this.sim.running,
      timeScale: this.timeScale,
      fresh,
    });
    const guide = this.lab.guide;
    this.card.render(this.story, this.mapSelection, guide?.guide ? { id: guide.id, name: guide.name, guide: guide.guide } : null);
    this.map.selected = this.mapSelection;
    this.map.refresh();
    this.map.visible = inMap;
    $('app').classList.toggle('in-map', inMap);
    const freeBtn = $('freeBtn');
    freeBtn.textContent = this.story.free ? 'Volver al mapa' : 'Modo libre';
    $('themeBtn').textContent = document.documentElement.dataset.theme === 'light' ? 'Tema oscuro' : 'Tema claro';
  }

  private setTool(id: ToolId, render = true): void {
    if (this.activeTool.id !== id) {
      this.activeTool.onDeactivate?.(this.ctx);
      this.activeTool = this.tools[id];
      this.activeTool.onActivate?.(this.ctx);
    }
    if (render) this.toolbar.setActive(id);
  }

  private select(ref: EntityRef | null): void {
    this.selection = ref;
    this.inspector.show(ref);
  }

  // ---------- control del tiempo (habilidades) ----------

  private flow(): void {
    if (!this.has('flow')) return;
    if (this.sim.running) {
      this.sim.pause();
      if (this.sim.t >= 1) this.bus.emit({ type: 'time-paused' });
      this.checkPeak();
    } else {
      this.sim.start();
    }
  }

  // ---------- interruptores de fuerza ----------

  private forceOn(id: ForceSwitch): boolean {
    return id === 'gravitation' ? !!this.world.gravitation : !!this.world.medium;
  }

  private switchLabel(id: ForceSwitch): string | undefined {
    return id === 'drag' ? `${SWITCH_NAMES.drag}: ${this.world.medium ?? 'vacío'}` : undefined;
  }

  private toggleForce(id: ForceSwitch): void {
    if (!this.story.forceSwitches().has(id)) return;
    // cambiar las fuerzas es preparar otro experimento: se vuelve a t = 0
    if (this.sim.hasRun) this.sim.reset();
    if (id === 'gravitation') {
      const on = !this.world.gravitation;
      this.world.gravitation = on ? { G: G_GAME } : null;
      this.toast.show(`${SWITCH_NAMES[id]} entre masas: ${on ? 'encendida' : 'apagada'}`);
      if (on) this.bus.emit({ type: 'gravitation-on' });
    } else {
      // vacío → aire → agua → vacío
      const order: (MediumId | null)[] = [null, 'aire', 'agua'];
      const next = order[(order.indexOf(this.world.medium) + 1) % order.length];
      this.world.medium = next;
      this.toast.show(next ? `Medio: ${next}` : 'Medio: vacío, sin arrastre');
      if (next) this.bus.emit({ type: 'medium-set' });
    }
    this.toolbar.setSwitch(id, this.forceOn(id), this.switchLabel(id));
  }

  // ---------- lentes ----------

  private toggleLens(id: LensId): void {
    if (!this.story.lenses().has(id)) return;
    const on = !this.lensOn.has(id);
    if (on) this.lensOn.add(id);
    else this.lensOn.delete(id);
    saveLenses(this.lensOn);
    this.toolbar.setLens(id, on);
    this.toast.show(`Lente ${LENS_NAMES[id]}: ${on ? 'activo' : 'apagado'}`);
    if (on) this.bus.emit({ type: 'lens-on' });
  }

  private rewind(): void {
    if (!this.has('rewind')) return;
    this.sim.reset();
  }

  private stepTime(): void {
    if (!this.has('step')) return;
    this.sim.stepBy(0.1);
    this.bus.emit({ type: 'time-step' });
    this.checkPeak();
  }

  private cycleSlow(): void {
    if (!this.has('slow')) return;
    const next = this.timeScale === 1 ? 0.5 : this.timeScale === 0.5 ? 0.25 : 1;
    if (this.story.free) this.lab.setTimeScale(next);
    else this.storyTimeScale = next;
    this.toolbar.setScale(next);
    if (next < 1) this.bus.emit({ type: 'slow-set' });
  }

  /**
   * ¿Está alguna partícula en el punto más alto de su vuelo? (detenida en el tiempo, en el aire,
   * con la componente de v a lo largo de g casi nula y moviéndose de lado).
   */
  private checkPeak(): void {
    if (!this.world.anyG || this.sim.running || !this.sim.hasRun) return;
    const atPeak = this.world.particles.some((p) => {
      const g = this.world.gAt(p.pos);
      if (!g) return false;
      const gL = Math.hypot(g.x, g.y);
      const s = this.sim.initialState(p.id);
      if (!s || dist(p.pos, s.pos) < 0.5 || this.sim.contactNormal(p.id)) return false;
      const along = (p.vel.x * g.x + p.vel.y * g.y) / gL;
      return Math.abs(along) < 0.35 && Math.hypot(p.vel.x, p.vel.y) > 0.3;
    });
    if (atPeak) this.bus.emit({ type: 'peak-found' });
  }

  /** Un deslizador del laboratorio: el lanzamiento vuelve a t = 0 con el valor nuevo. */
  private setLabControl(id: string, v: number): void {
    const c = this.lab.guide?.guide?.controls?.find((x) => x.id === id);
    if (!c) return;
    if (this.sim.hasRun) this.sim.reset();
    c.set(this.world, v);
  }

  // ---------- el mapa y los rastros ----------

  /** Nombre legible de una herramienta o habilidad (para «te falta Velocidad»). */
  private grantName(g: Grant): string {
    const [kind, id] = g.split(':') as [string, string];
    if (kind === 'tool') return this.tools[id as ToolId]?.name ?? id;
    if (kind === 'time') return TIME_NAMES[id as TimeSkill] ?? id;
    if (kind === 'force') return SWITCH_NAMES[id as ForceSwitch] ?? id;
    if (kind === 'lens') return LENS_NAMES[id as LensId] ?? id;
    return g;
  }

  private selectSite(id: string | null): void {
    this.mapSelection = id;
    this.refreshUI();
  }

  /** Desde el mapa: acercarse al rastro y entrar. */
  private goToSite(id: string): void {
    const site = this.story.siteById(id);
    if (!site || this.story.status(site) === 'cerrado') return;
    this.journal.hide();
    this.tree.hide();
    if (this.mode === 'map' && !this.map.flying) this.map.diveInto(site, () => this.enterSite(id));
    else this.enterSite(id);
  }

  /** Si se está saliendo de un rastro del claro, guarda los ejes del jugador. */
  private rememberClaroFrame(): void {
    const f = this.world.frame;
    if (this.story.site?.zone === 'claro' && f) this.claroFrame = { origin: { ...f.origin }, angle: f.angle };
  }

  private enterSite(id: string): void {
    this.rememberClaroFrame();
    this.sim.clearRun();
    this.world.clear();
    // en el claro, «los ejes son una elección tuya»: el rastro siguiente parte con los que eligió el jugador
    const target = this.story.siteById(id);
    if (target?.zone === 'claro' && id !== 'vacio' && this.claroFrame) {
      this.world.frame = new ReferenceFrame({ ...this.claroFrame.origin }, this.claroFrame.angle);
    }
    this.select(null);
    this.highlighted.clear();
    this.view.home = { center: { x: 0, y: 0 }, zoom: 1 };
    this.view.reset();
    this.resetProbe();
    this.mapSelection = id;
    if (!this.story.enter(id)) return;
    this.setTool(this.initialTool(), false);
    this.canvas.classList.remove('arrive');
    void this.canvas.offsetWidth;
    this.canvas.classList.add('arrive');
    this.refreshUI();
    this.fitScene();
  }

  /**
   * Encuadra lo que trae el rastro en la franja libre entre la tarjeta y la barra. En una pantalla
   * ancha casi nunca hace falta; en el celular evita que la mitad del rastro quede fuera.
   *
   * Un laboratorio (lab) además esquiva la guía, que en una pantalla ancha va al costado, y los
   * paneles de la derecha (energía, gráficos, inspector): en una ventana angosta la escena quedaría
   * bajo ellos. Busca el rectángulo libre donde se vea más grande; si aun así hubiera que alejar a
   * menos de 0,45, deja la vista de siempre.
   */
  private fitScene(lab = false): void {
    const w = this.world;
    const pts: Vec2[] = [];
    if (w.frame) pts.push(w.frame.origin, w.frame.pointToGlobal({ x: 3.4, y: 0 }), w.frame.pointToGlobal({ x: 0, y: 2.6 }));
    if (w.probe) pts.push(w.probe);
    for (const b of w.beacons) if (!b.hidden) pts.push(b.pos);
    for (const v of w.vectors) pts.push(v.tail, v.tip);
    for (const p of w.particles) pts.push(p.pos);
    for (const s of w.surfaces) pts.push(s.a, s.b);
    for (const t of w.targets) pts.push(t.pos);
    for (const body of w.bodies) {
      if (body.shape === 'rod') pts.push(toWorld(body, { x: -body.size / 2, y: 0 }), toWorld(body, { x: body.size / 2, y: 0 }));
      else pts.push({ x: body.pos.x - body.size, y: body.pos.y - body.size }, { x: body.pos.x + body.size, y: body.pos.y + body.size });
      if (body.pivot) pts.push(body.pivot.at);
    }
    if (pts.length < 2) return;
    const b = {
      minX: Math.min(...pts.map((p) => p.x)) - 0.6,
      maxX: Math.max(...pts.map((p) => p.x)) + 0.6,
      minY: Math.min(...pts.map((p) => p.y)) - 0.6,
      maxY: Math.max(...pts.map((p) => p.y)) + 0.6,
    };
    const card = $('card').getBoundingClientRect();
    const bar = $('bar').getBoundingClientRect();
    // en una pantalla ancha la tarjeta está al costado: la franja es casi toda la pantalla
    const top = this.view.narrow ? card.bottom + 8 : 24;
    let bottom = (bar.top || this.view.H - 70) - 12;
    // en el celular los paneles (HUD, gráficos) van abajo: la escena queda sobre ellos
    if (this.view.narrow) {
      for (const el of document.querySelectorAll<HTMLElement>('#dock > *')) {
        const r = el.getBoundingClientRect();
        if (!el.hidden && r.height > 0) bottom = Math.min(bottom, r.top - 8);
      }
    }
    const v = this.view;
    if (!lab) {
      const fitsNow = v.sx(b.minX) > 16 && v.sx(b.maxX) < v.W - 16 && v.sy(b.maxY) > top && v.sy(b.minY) < bottom;
      if (!fitsNow) v.fit(b, top, bottom);
      return;
    }
    // laboratorio: se parte de la vista de siempre
    v.home = { center: { x: 0, y: 0 }, zoom: 1 };
    v.reset();
    const blocks = [card, ...[...document.querySelectorAll<HTMLElement>('#dock > *')].filter((el) => !el.hidden).map((el) => el.getBoundingClientRect())].filter(
      (r) => r.width > 0 && r.height > 0,
    );
    const free = (l: number, r: number, t: number, d: number) => blocks.every((k) => r <= k.left || l >= k.right || d <= k.top || t >= k.bottom);
    const PAD = 20;
    // ¿algo de la escena (un punto, o un tramo de una superficie) cae bajo un panel?
    const samples = [...pts];
    for (const sf of w.surfaces) {
      const n = Math.ceil(Math.hypot(sf.b.x - sf.a.x, sf.b.y - sf.a.y) / 0.5);
      for (let i = 1; i < n; i++) samples.push({ x: sf.a.x + ((sf.b.x - sf.a.x) * i) / n, y: sf.a.y + ((sf.b.y - sf.a.y) * i) / n });
    }
    const hidden = samples.some((q) => !free(v.sx(q.x) - 8, v.sx(q.x) + 8, v.sy(q.y) - 8, v.sy(q.y) + 8));
    if (v.sx(b.minX) > 16 && v.sx(b.maxX) < v.W - 16 && v.sy(b.maxY) > top && v.sy(b.minY) < bottom && !hidden) return;
    // rectángulos candidatos: sus bordes son los de la pantalla o los de los paneles
    const Ls = [16, ...blocks.map((k) => k.right + 12)];
    const Rs = [v.W - 16, ...blocks.map((k) => k.left - 12)];
    const Ts = [top, ...blocks.map((k) => k.bottom + 8)];
    const Bs = [bottom, ...blocks.map((k) => k.top - 8)];
    const wid = Math.max(1, b.maxX - b.minX);
    const hgt = Math.max(1, b.maxY - b.minY);
    let best: { z: number; l: number; r: number; t: number; d: number } | null = null;
    for (const l of Ls)
      for (const r of Rs)
        for (const t of Ts)
          for (const d of Bs) {
            if (r - l < 120 || d - t < 100 || l < 0 || r > v.W || t < top || d > bottom || !free(l, r, t, d)) continue;
            const z = Math.min(1, (r - l - 2 * PAD) / (wid * v.base), (d - t - 2 * PAD) / (hgt * v.base));
            if (!best || z > best.z + 1e-6) best = { z, l, r, t, d };
          }
    if (best && best.z >= 0.45) v.fit(b, best.t, best.d, PAD, best.l, best.r);
  }

  /** Volver al mapa (desde un rastro o desde el laboratorio libre). */
  private toMap(): void {
    if (this.story.free) {
      this.setFree(false);
      if (this.story.site) this.story.leave();
    }
    const site = this.story.site;
    this.rememberClaroFrame();
    this.sim.clearRun();
    this.world.clear();
    this.select(null);
    this.highlighted.clear();
    this.resetProbe();
    this.lab.forget('story');
    this.story.leave();
    this.mapSelection = site?.id ?? null;
    // la primera vez, el mapa se revela desde el claro con calma
    const first = site?.id === 'vacio' && Object.keys(this.story.progress.solved).length === 1;
    this.map.riseFrom(site, first ? 1400 : 650);
    this.journal.hide();
    this.tree.hide();
    this.refreshUI();
  }

  private resetProbe(): void {
    this.probeTravel = null;
    this.probeKey = '';
  }

  /**
   * La sonda: si la cadena de tarjetas que parte de ella termina en una baliza, viaja tramo a tramo
   * y al llegar avisa al relato. Si la cadena cruza un muro, no sale.
   */
  private updateProbe(dt: number): void {
    const w = this.world;
    if (!w.probe) return;
    const chain = w.probeChain();
    const key = chain.vectors.map((v) => v.id).join(',');
    if (key !== this.probeKey) {
      this.probeKey = key;
      this.probeTravel = null;
      const end = chain.points[chain.points.length - 1];
      const hit = chain.vectors.length > 0 && w.beacons.some((b) => !b.hidden && dist(b.pos, end) <= b.radius);
      if (hit && chain.blocked) {
        this.toast.show('La cadena cruza el muro: la sonda no puede pasar');
        this.bus.emit({ type: 'probe-blocked' });
      } else if (hit) {
        this.probeTravel = { points: chain.points, labels: chain.vectors.map((v) => v.label).join(','), t: 0, arrived: false };
      }
    }
    const tr = this.probeTravel;
    if (tr && !tr.arrived) {
      tr.t += dt;
      if (tr.t >= PROBE_HOP * (tr.points.length - 1)) {
        tr.arrived = true;
        w.probeLog.push(tr.labels);
        this.toast.show('La sonda llegó a la baliza');
        this.bus.emit({ type: 'probe-arrived' });
      }
    }
  }

  /** Dónde se dibuja la sonda: en su partida o en su viaje por la cadena. */
  private probeDrawPos(): Vec2 | null {
    const w = this.world;
    if (!w.probe) return null;
    const tr = this.probeTravel;
    if (!tr) return w.probe;
    const k = Math.min(tr.points.length - 1, tr.t / PROBE_HOP);
    const i = Math.min(tr.points.length - 2, Math.floor(k));
    const f = Math.min(1, k - i);
    // cada salto acelera y frena, como una sonda que se impulsa
    const e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
    const a = tr.points[i];
    const b = tr.points[i + 1];
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
  }

  /** Condiciones del mundo que los rastros escuchan: balizas ocultas y la boya alcanzada. */
  private watchSite(): void {
    const w = this.world;
    for (const b of w.beacons) {
      if (b.hidden && w.particles.some((p) => dist(p.pos, b.pos) <= b.radius)) {
        b.hidden = false;
        this.toast.show('¡Encontraste la baliza!');
        this.bus.emit({ type: 'beacon-found' });
      }
    }
    if (this.sim.hasRun && this.caughtRun !== this.sim.runId) {
      const locked = w.particles.filter((p) => p.locked);
      const free = w.particles.filter((p) => !p.locked);
      if (locked.some((a) => free.some((b) => dist(a.pos, b.pos) < CATCH_DIST))) {
        this.caughtRun = this.sim.runId;
        this.toast.show('¡La alcanzaste!');
        this.bus.emit({ type: 'caught' });
      }
    }
  }

  private openTree(): void {
    this.restartArmed = 0;
    $('restartBtn').textContent = 'Empezar de nuevo';
    $('restartBtn').classList.remove('warn');
    this.tree.show({ have: this.story.grants(), upcoming: this.story.upcomingGrants(), reached: this.story.reachedChapters(), next: this.story.nextChapter() });
  }

  /** El relato y el laboratorio tienen cada uno su propio mundo: al cambiar de modo se guarda uno y se recupera el otro. */
  private setFree(free: boolean): void {
    if (free === this.story.free) return;
    this.lab.autosaveNow(this.story.free ? 'lab' : 'story');
    this.story.setFree(free);
    this.sim.clearRun();
    this.select(null);
    this.highlighted.clear();
    if (free) {
      if (!this.lab.restoreSlot('lab')) {
        this.world.clear();
        seedFree(this.story.ctx);
      }
      this.setTool('move', false);
      this.toast.show('Laboratorio: todas las herramientas');
    } else {
      this.world.clear();
      if (this.story.site) {
        const restored = this.lab.restoreSlot('story');
        this.story.resume(!restored);
      }
      this.setTool(this.initialTool(), false);
    }
    this.tree.hide();
    this.lab.hide();
    this.refreshUI();
  }

  private restart(): void {
    this.sim.clearRun();
    this.lab.forget('story');
    this.world.clear();
    this.select(null);
    this.highlighted.clear();
    this.story.restart();
    this.resetProbe();
    this.mapSelection = null;
    this.story.resume();
    this.setTool('origin', false);
    this.tree.hide();
    this.journal.hide();
    this.refreshUI();
  }

  // ---------- eventos ----------

  private wireEvents(): void {
    this.bus.on((ev) => this.story.handle(ev));
    this.story.onChange = ({ newGrants, newStars, solved }) => {
      const site = this.story.site;
      if (site && newStars?.length) {
        const labels = newStars.map((id) => site.mastery?.find((m) => m.id === id)?.label).filter(Boolean);
        if (labels.length) this.toast.show(`★ ${labels.join(' · ')}`, 3400);
      }
      if (solved && site) this.toast.show(`Rastro resuelto: ${site.title}`, 3000);
      // un lente recién ganado se enciende solo, para que se vea qué es
      for (const g of newGrants) {
        if (!g.startsWith('lens:')) continue;
        this.lensOn.add(g.slice(5) as LensId);
        saveLenses(this.lensOn);
      }
      const tools = newGrants.filter((g) => g.startsWith('tool:')).map((g) => g.slice(5) as ToolId);
      const skills = newGrants.filter((g) => g.startsWith('time:')).map((g) => g.slice(5) as TimeSkill);
      const switches = newGrants.filter((g) => g.startsWith('force:')).map((g) => g.slice(6) as ForceSwitch);
      const names = [...tools.map((t) => this.tools[t].name), ...skills.map((k) => TIME_NAMES[k]), ...switches.map((f) => SWITCH_NAMES[f])];
      if (names.length) this.toast.show(`${tools.length ? 'Nueva herramienta' : 'Nueva habilidad'}: ${names.join(', ')}`);
      if (tools.length) this.setTool(tools[0], false);
      this.refreshUI(newGrants);
    };

    this.sim.onStateChange = () => this.toolbar.setRunning(this.sim.running);
    this.sim.shouldStop = () => {
      // sin área visible (página oculta o aún sin diseño) no hay «fuera de la vista»
      if (!this.view.W || !this.view.H) return false;
      const b = this.view.homeBounds(Math.max(this.view.W, this.view.H) * 0.5);
      if (!this.world.particles.length) return false;
      return this.world.particles.every((p) => p.pos.x < b.minX || p.pos.x > b.maxX || p.pos.y < b.minY || p.pos.y > b.maxY);
    };
    this.sim.onStep.push(() => {
      if (this.hitFlash > 0 || this.sim.replaying) return;
      for (const t of this.world.targets) {
        if (this.world.particles.some((p) => dist(p.pos, t.pos) < t.radius)) {
          this.hitFlash = 1.2;
          this.toast.show('¡Le diste al blanco!');
          this.bus.emit({ type: 'target-hit' });
          return;
        }
      }
    });

    const cv = this.canvas;
    cv.addEventListener('pointerdown', (e) => this.onDown(e));
    cv.addEventListener('pointermove', (e) => this.onMove(e));
    cv.addEventListener('pointerup', (e) => this.onUp(e));
    cv.addEventListener('pointercancel', (e) => this.onUp(e));
    // rueda: acercar o alejar en torno al puntero
    cv.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = cv.getBoundingClientRect();
        const k = Math.exp(-Math.max(-60, Math.min(60, e.deltaY)) * 0.004);
        if (this.mode === 'map') this.map.onWheel(e.clientX - r.left, e.clientY - r.top, k);
        else this.view.zoomAt(e.clientX - r.left, e.clientY - r.top, k);
      },
      { passive: false },
    );
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    // un pellizco del trackpad (rueda con Ctrl) fuera del lienzo cambiaba el zoom de toda la página
    // y la dejaba así: sobre el árbol, la bitácora o una tarjeta no hace nada
    window.addEventListener(
      'wheel',
      (e) => {
        if (e.ctrlKey && e.target !== cv) e.preventDefault();
      },
      { passive: false },
    );

    window.addEventListener('resize', () => this.resize());
    // guardar al salir o al cambiar de pestaña (en el celular la página puede no volver)
    window.addEventListener('pagehide', () => this.lab.autosaveNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.lab.autosaveNow();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
    $('recenter').addEventListener('click', () => this.view.reset());
    window.addEventListener('resize', () => {
      // si el jugador movió la cámara, se respeta su vista
      if (this.mode !== 'map' && !this.view.moved) this.fitScene(this.mode === 'free');
    });
  }

  private wireTreeButtons(): void {
    $('freeBtn').addEventListener('click', () => this.setFree(!this.story.free));
    $('themeBtn').addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
      this.painter.pal = readPalette();
      this.refreshUI();
    });
    const restartBtn = $('restartBtn');
    restartBtn.addEventListener('click', () => {
      // dos toques: el progreso se pierde
      if (performance.now() - this.restartArmed < 4000) {
        this.restartArmed = 0;
        restartBtn.textContent = 'Empezar de nuevo';
        restartBtn.classList.remove('warn');
        this.restart();
        return;
      }
      this.restartArmed = performance.now();
      restartBtn.textContent = '¿Seguro? Toca otra vez';
      restartBtn.classList.add('warn');
    });
  }

  private onKey(e: KeyboardEvent): void {
    if (this.tree.open || this.lab.open || this.journal.open) return;
    if (this.mode === 'map') {
      if (e.key === 'Escape') this.selectSite(null);
      return;
    }
    const el = document.activeElement;
    const typing = el && el !== document.body && el !== this.canvas;
    if (e.key === ' ' && !typing) {
      e.preventDefault();
      this.flow();
    } else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !typing) {
      this.rewind();
    } else if (e.key === 'ArrowRight' && !typing) {
      this.stepTime();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selection && !typing && !this.world.isProtected(this.selection)) {
      this.world.remove(this.selection);
      this.select(null);
    } else if (e.key === 'Escape') {
      this.select(null);
    } else if ((e.key === '+' || e.key === '=') && !typing) {
      this.view.zoomAt(this.view.W / 2, this.view.H / 2, 1.25);
    } else if (e.key === '-' && !typing) {
      this.view.zoomAt(this.view.W / 2, this.view.H / 2, 0.8);
    } else if (e.key === '0' && !typing) {
      this.view.reset();
    }
  }

  // ---------- puntero: herramientas, paneo y pellizco ----------

  private localPoint(e: PointerEvent): { x: number; y: number } {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private pinchState(): { dist: number; cx: number; cy: number } {
    const [a, b] = [...this.pointers.values()];
    return { dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  }

  /** Termina lo que estaba haciendo la herramienta (al apoyar un segundo dedo para el pellizco). */
  private cancelToolGesture(): void {
    if (this.pointerId === null) return;
    this.pointerId = null;
    if (this.frameDrag) {
      this.frameDrag.end(this.ctx);
      this.frameDrag = null;
    } else if (this.lastWorldPointer) {
      this.activeTool.onPointerUp(this.lastWorldPointer, this.ctx);
    }
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    const pt = this.localPoint(e);
    if (this.mode === 'map') {
      this.map.onDown(e.pointerId, pt.x, pt.y);
      return;
    }
    this.pointers.set(e.pointerId, pt);
    if (this.pointers.size === 2) {
      this.cancelToolGesture();
      this.panFrom = null;
      this.pinch = this.pinchState();
      return;
    }
    if (this.pointers.size > 2 || this.pointerId !== null) return;
    if (e.pointerType === 'mouse' && (e.button === 1 || e.button === 2)) {
      this.panFrom = pt;
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.pointerId = e.pointerId;
    const wp = (this.lastWorldPointer = this.worldPointer(e));
    // el asa de los ejes se puede girar con cualquier herramienta
    this.frameDrag = FrameDrag.tryStart(wp.p, wp.tol, this.ctx, false);
    if (!this.frameDrag) this.activeTool.onPointerDown(wp, this.ctx);
  }

  private onMove(e: PointerEvent): void {
    if (this.mode === 'map') {
      const q = this.localPoint(e);
      this.map.onMove(e.pointerId, q.x, q.y);
      return;
    }
    if (!this.pointers.has(e.pointerId)) return;
    const pt = this.localPoint(e);
    this.pointers.set(e.pointerId, pt);
    if (this.pinch) {
      if (this.pointers.size < 2) return;
      const now = this.pinchState();
      this.view.zoomAt(now.cx, now.cy, now.dist / this.pinch.dist);
      this.view.panPx(now.cx - this.pinch.cx, now.cy - this.pinch.cy);
      this.pinch = now;
      return;
    }
    if (this.panFrom) {
      this.view.panPx(pt.x - this.panFrom.x, pt.y - this.panFrom.y);
      this.panFrom = pt;
      return;
    }
    if (e.pointerId !== this.pointerId) return;
    const wp = (this.lastWorldPointer = this.worldPointer(e));
    if (this.frameDrag) this.frameDrag.move(wp.p, this.ctx);
    else this.activeTool.onPointerMove(wp, this.ctx);
  }

  private onUp(e: PointerEvent): void {
    if (this.mode === 'map') {
      this.map.onUp(e.pointerId);
      return;
    }
    this.pointers.delete(e.pointerId);
    if (this.pinch) {
      // el pellizco termina cuando se levantan los dos dedos; el que queda no dibuja nada
      if (this.pointers.size === 0) this.pinch = null;
      return;
    }
    if (this.panFrom) {
      if (this.pointers.size === 0) this.panFrom = null;
      return;
    }
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    if (this.frameDrag) {
      this.frameDrag.end(this.ctx);
      this.frameDrag = null;
    } else {
      this.activeTool.onPointerUp(this.worldPointer(e), this.ctx);
    }
  }

  private worldPointer(e: PointerEvent): WorldPointer {
    const r = this.canvas.getBoundingClientRect();
    return {
      p: this.view.toWorld(e.clientX - r.left, e.clientY - r.top),
      tol: this.view.m(TOUCH_PX[e.pointerType] ?? 14),
    };
  }

  private resize(): void {
    const W = this.canvas.clientWidth;
    const H = this.canvas.clientHeight;
    this.view.resize(W, H, window.devicePixelRatio);
    this.map.resize(W, H, window.devicePixelRatio);
    this.canvas.width = Math.round(W * this.view.dpr);
    this.canvas.height = Math.round(H * this.view.dpr);
  }

  // ---------- bucle ----------

  private loop(now: number): void {
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;

    this.lab.tick(now);
    if (this.mode === 'map') {
      this.map.draw(this.painter.ctx, this.painter.pal, now);
      requestAnimationFrame((t) => this.loop(t));
      return;
    }
    this.sim.timeScale = this.timeScale;
    this.sim.advance(dt);
    this.monitor.update();
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.opts.stress && this.sim.finished) this.sim.start();

    // el inspector agrega filas cuando aparece el origen, la primera superficie o g
    const structure = `${this.world.bodies.map((b) => b.loads.length).join(',')}|${!!this.world.frame}|${this.world.surfaces.length > 0}|${this.world.springs.length > 0}|${!!this.world.gravitation}|${!!this.world.medium}|${!!this.world.g}`;
    this.toolbar.setSwitch('gravitation', !!this.world.gravitation);
    this.toolbar.setSwitch('drag', !!this.world.medium, this.switchLabel('drag'));
    if (structure !== this.structure) {
      this.structure = structure;
      this.inspector.rebuild();
    }
    if (this.selection && !this.world.exists(this.selection)) this.select(null);
    this.inspector.update();
    const focus = this.selection?.kind === 'particle' ? this.world.particle(this.selection.id)?.pos : this.world.particles[0]?.pos;
    this.hud.update(this.world, this.sim, this.has('flow'), this.fps, focus);
    const recenter = $('recenter');
    if (recenter.hidden === this.view.moved) recenter.hidden = !this.view.moved;
    this.energyMeter.update(this.lensOn.has('energy') && this.story.lenses().has('energy'), this.world, this.sim);
    this.graphs.update(this.lensOn.has('graphs') && this.story.lenses().has('graphs'), this.selection?.kind === 'particle' ? this.selection.id : null);
    this.timeline.update(this.has('timeline') && this.sim.hasRun && this.sim.duration > 0, this.sim.t, this.sim.duration);
    this.updateProbe(dt);
    this.watchSite();
    this.story.tick();

    const tool = this.activeTool;
    drawScene({
      world: this.world,
      sim: this.sim,
      view: this.view,
      painter: this.painter,
      selection: this.selection,
      highlighted: this.highlighted,
      hitFlash: this.hitFlash,
      draft: tool.renderDraft ? (p) => tool.renderDraft!(p, this.ctx) : null,
      display: this.lab.display(),
      avoid: this.uiRects(),
      probe: this.probeDrawPos(),
    });
    requestAnimationFrame((t) => this.loop(t));
  }

  /** Zonas del lienzo tapadas por la interfaz: los rótulos de masa y de vectores no se dibujan debajo. */
  private uiRects(): Rect[] {
    const out: Rect[] = [];
    const els = [$('card'), $('hud'), $('insp'), $('bar'), $('timeline'), ...document.querySelectorAll<HTMLElement>('#dock > .energy, #dock > .graphs')];
    for (const el of els) {
      if (el.hidden) continue;
      const r = el.getBoundingClientRect();
      if (r.width && r.height) out.push({ x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 });
    }
    return out;
  }

  // ---------- prueba de rendimiento ----------

  private seedStress(n: number): void {
    const w = this.world;
    seedFree(this.story.ctx);
    w.particles = [];
    const b = this.view.bounds(-this.view.S);
    for (let i = 0; i < n; i++) {
      const pos = { x: b.minX + Math.random() * (b.maxX - b.minX), y: b.minY + Math.random() * (b.maxY - b.minY) };
      const q = w.addParticle(pos, 0.25 * 2 ** Math.floor(Math.random() * 5), {
        x: (Math.random() - 0.5) * 6,
        y: (Math.random() - 0.5) * 6,
      });
      // cada partícula cuelga de un resorte anclado algo más arriba: oscila sin salir de la vista
      this.sim.forces.push(new Spring({ particle: q.id }, { anchor: { x: pos.x, y: pos.y + 1 } }, 40 * q.mass, 0));
    }
    w.g = { x: 0, y: -G_EARTH };
    this.sim.maxTime = Infinity;
    this.sim.start();
  }
}

const LENS_KEY = 'mundoVacio.lenses';

function loadLenses(): Set<LensId> {
  try {
    const raw = JSON.parse(localStorage.getItem(LENS_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(raw) ? (raw.filter((x) => x === 'energy' || x === 'graphs') as LensId[]) : []);
  } catch {
    return new Set();
  }
}

function saveLenses(on: ReadonlySet<LensId>): void {
  try {
    localStorage.setItem(LENS_KEY, JSON.stringify([...on]));
  } catch {
    /* sin almacenamiento */
  }
}

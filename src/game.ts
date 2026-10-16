import { EventBus, type GameEvent } from './core/events';
import { dist } from './core/vec';
import { SurfaceConstraint } from './physics/constraints';
import { FrictionForce, G_GAME, NormalForce, Spring, SpringForces, UniformGravity, WorldDrag, WorldGravitation, type MediumId } from './physics/forces';
import { OscillationMeter } from './physics/oscillationMeter';
import { Lab } from './lab/lab';
import { Simulation } from './physics/simulation';
import { Painter } from './render/painter';
import { drawScene } from './render/renderer';
import { applyTheme, loadTheme, readPalette } from './render/theme';
import { View } from './render/view';
import { freshProgress, loadProgress, saveProgress, type Progress } from './state/progress';
import { CHAPTERS, seedFree } from './story/chapters';
import { RunMonitor } from './story/runMonitor';
import { StoryEngine } from './story/storyEngine';
import type { ForceSwitch, Grant, TimeSkill } from './story/types';
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
import { SWITCH_NAMES, TIME_NAMES, Toolbar } from './ui/toolbar';
import { G_EARTH, World, type EntityRef } from './world/world';

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
  private story: StoryEngine;

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
  /** cámara lenta en el relato (en el laboratorio vale la preferencia guardada) */
  private storyTimeScale = 1;

  private pointerId: number | null = null;
  private frameDrag: FrameDrag | null = null;
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
    const progress: Progress = stress ? { ...freshProgress(), free: true } : loadProgress(CHAPTERS.map((c) => c.id));
    this.story = new StoryEngine(
      CHAPTERS,
      progress,
      { world: this.world, view: this.view, sim: this.sim },
      stress ? () => {} : saveProgress,
    );

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

    this.card = new StoryCard({
      next: () => this.bus.emit({ type: 'next' }),
      choose: (id) => this.story.choose(id),
      openTree: () => this.openTree(),
      goFree: () => this.setFree(true),
      openLab: () => this.lab.show(),
    });
    this.toolbar = new Toolbar({
      selectTool: (id) => this.setTool(id),
      flow: () => this.flow(),
      rewind: () => this.rewind(),
      step: () => this.stepTime(),
      slow: () => this.cycleSlow(),
      toggleForce: (id) => this.toggleForce(id),
      openTree: () => this.openTree(),
      openLab: () => this.lab.show(),
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
          this.refreshUI();
        },
        toast: (m) => this.toast.show(m),
      },
      stress === 0,
    );

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
    } else {
      // el mundo autoguardado del relato; los capítulos agregan lo que falte
      this.lab.restoreSlot('story');
      this.story.resume();
    }
    this.refreshUI();
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

  private refreshUI(fresh: readonly Grant[] = []): void {
    const unlocked = this.unlocked();
    if (!unlocked.has(this.activeTool.id)) this.setTool(this.initialTool(), false);
    this.toolbar.render({
      tools: TOOL_ORDER.filter((id) => unlocked.has(id)).map((id) => this.tools[id]),
      active: this.activeTool.id,
      time: this.story.timeSkills(),
      switches: [...this.story.forceSwitches()].map((id) => ({ id, on: this.forceOn(id), label: this.switchLabel(id) })),
      labEnabled: this.story.free,
      running: this.sim.running,
      timeScale: this.timeScale,
      fresh,
    });
    this.card.render(this.story);
    const freeBtn = $('freeBtn');
    freeBtn.textContent = this.story.free ? 'Volver al relato' : 'Modo libre';
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
    const g = this.world.g;
    if (!g || this.sim.running || !this.sim.hasRun) return;
    const gL = Math.hypot(g.x, g.y);
    const atPeak = this.world.particles.some((p) => {
      const s = this.sim.initialState(p.id);
      if (!s || dist(p.pos, s.pos) < 0.5 || this.sim.contactNormal(p.id)) return false;
      const along = (p.vel.x * g.x + p.vel.y * g.y) / gL;
      return Math.abs(along) < 0.35 && Math.hypot(p.vel.x, p.vel.y) > 0.3;
    });
    if (atPeak) this.bus.emit({ type: 'peak-found' });
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
      if (!this.lab.restoreSlot('story')) this.world.clear();
      this.story.resume();
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
    this.setTool('origin', false);
    this.tree.hide();
    this.refreshUI();
  }

  // ---------- eventos ----------

  private wireEvents(): void {
    this.bus.on((ev) => this.story.handle(ev));
    this.story.onChange = ({ newGrants }) => {
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
      const b = this.view.bounds(Math.max(this.view.W, this.view.H) * 0.5);
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
    cv.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      cv.setPointerCapture(e.pointerId);
      this.pointerId = e.pointerId;
      const wp = this.worldPointer(e);
      // el asa de los ejes se puede girar con cualquier herramienta
      this.frameDrag = FrameDrag.tryStart(wp.p, wp.tol, this.ctx, false);
      if (!this.frameDrag) this.activeTool.onPointerDown(wp, this.ctx);
    });
    cv.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId) return;
      const wp = this.worldPointer(e);
      if (this.frameDrag) this.frameDrag.move(wp.p, this.ctx);
      else this.activeTool.onPointerMove(wp, this.ctx);
    });
    const up = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      if (this.frameDrag) {
        this.frameDrag.end(this.ctx);
        this.frameDrag = null;
      } else {
        this.activeTool.onPointerUp(this.worldPointer(e), this.ctx);
      }
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('resize', () => this.resize());
    // guardar al salir o al cambiar de pestaña (en el celular la página puede no volver)
    window.addEventListener('pagehide', () => this.lab.autosaveNow());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.lab.autosaveNow();
    });
    window.addEventListener('keydown', (e) => this.onKey(e));
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
    if (this.tree.open || this.lab.open) return;
    const el = document.activeElement;
    const typing = el && el !== document.body && el !== this.canvas;
    if (e.key === ' ' && !typing) {
      e.preventDefault();
      this.flow();
    } else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !typing) {
      this.rewind();
    } else if (e.key === 'ArrowRight' && !typing) {
      this.stepTime();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.selection && !typing) {
      this.world.remove(this.selection);
      this.select(null);
    } else if (e.key === 'Escape') {
      this.select(null);
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
    this.canvas.width = Math.round(W * this.view.dpr);
    this.canvas.height = Math.round(H * this.view.dpr);
  }

  // ---------- bucle ----------

  private loop(now: number): void {
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;

    this.lab.tick(now);
    this.sim.timeScale = this.timeScale;
    this.sim.advance(dt);
    this.monitor.update();
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.opts.stress && this.sim.finished) this.sim.start();

    // el inspector agrega filas cuando aparece el origen, la primera superficie o g
    const structure = `${!!this.world.frame}|${this.world.surfaces.length > 0}|${this.world.springs.length > 0}|${!!this.world.gravitation}|${!!this.world.medium}|${!!this.world.g}`;
    this.toolbar.setSwitch('gravitation', !!this.world.gravitation);
    this.toolbar.setSwitch('drag', !!this.world.medium, this.switchLabel('drag'));
    if (structure !== this.structure) {
      this.structure = structure;
      this.inspector.rebuild();
    }
    if (this.selection && !this.world.exists(this.selection)) this.select(null);
    this.inspector.update();
    this.hud.update(this.world, this.sim, this.has('flow'), this.fps);
    this.timeline.update(this.has('timeline') && this.sim.hasRun && this.sim.duration > 0, this.sim.t, this.sim.duration);

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
    });
    requestAnimationFrame((t) => this.loop(t));
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

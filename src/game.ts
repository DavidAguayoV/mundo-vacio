import { EventBus, type GameEvent } from './core/events';
import { dist } from './core/vec';
import { Spring, UniformGravity } from './physics/forces';
import { Simulation } from './physics/simulation';
import { Painter } from './render/painter';
import { drawScene } from './render/renderer';
import { applyTheme, loadTheme, readPalette } from './render/theme';
import { View } from './render/view';
import { freshProgress, loadProgress, saveProgress, type Progress } from './state/progress';
import { CHAPTERS, seedFree } from './story/chapters';
import { StoryEngine } from './story/storyEngine';
import { FrameDrag } from './tools/frameDrag';
import { TOOL_ORDER, createTools } from './tools/registry';
import type { Tool, ToolContext, ToolId, WorldPointer } from './tools/tool';
import { TreeView } from './tree/treeView';
import { StoryCard } from './ui/card';
import { $ } from './ui/dom';
import { Hud } from './ui/hud';
import { Inspector, clampMass } from './ui/inspector';
import { Toast } from './ui/toast';
import { Toolbar } from './ui/toolbar';
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

  private pointerId: number | null = null;
  private frameDrag: FrameDrag | null = null;
  private hitFlash = 0;
  private fellRun = -1;
  private hadFrame = false;
  private last = 0;
  private fps = 60;
  private restartArmed = 0;

  constructor(private opts: GameOptions = {}) {
    const ctx2d = this.canvas.getContext('2d');
    if (!ctx2d) throw new Error('Este navegador no tiene Canvas 2D.');
    applyTheme(loadTheme());
    this.painter = new Painter(ctx2d, this.view, readPalette());

    this.sim.forces.push(new UniformGravity());

    const stress = opts.stress ?? 0;
    const progress: Progress = stress ? { ...freshProgress(), free: true } : loadProgress(CHAPTERS.length);
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
      openTree: () => this.openTree(),
      goFree: () => this.setFree(true),
    });
    this.toolbar = new Toolbar({
      selectTool: (id) => this.setTool(id),
      togglePlay: () => this.togglePlay(),
      reset: () => this.sim.reset(),
      openTree: () => this.openTree(),
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
      remove: (ref) => {
        this.world.remove(ref);
        this.select(null);
      },
    });
    this.hud = new Hud(!!opts.debug || stress > 0);
    this.tree = new TreeView(() => this.tree.hide());

    this.activeTool = this.tools[this.initialTool()];
    // ?debug deja el juego a mano en la consola para inspeccionarlo
    if (opts.debug) (window as unknown as { mundo: Game }).mundo = this;
    this.wireEvents();
    this.wireTreeButtons();
  }

  start(): void {
    this.resize();
    if (this.opts.stress) this.seedStress(this.opts.stress);
    else if (this.story.free) seedFree(this.story.ctx);
    else this.story.resume();
    this.refreshUI();
    this.activeTool.onActivate?.(this.ctx);
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  // ---------- estado ----------

  private initialTool(): ToolId {
    if (this.story.free) return 'move';
    return this.story.chapter.unlocks[0] ?? 'origin';
  }

  private unlocked() {
    return this.story.unlockedTools(TOOL_ORDER);
  }

  private refreshUI(fresh: readonly ToolId[] = []): void {
    const unlocked = this.unlocked();
    if (!unlocked.has(this.activeTool.id)) this.setTool(this.initialTool(), false);
    this.toolbar.render({
      tools: TOOL_ORDER.filter((id) => unlocked.has(id)).map((id) => this.tools[id]),
      active: this.activeTool.id,
      simEnabled: this.story.simEnabled(),
      running: this.sim.running,
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

  private togglePlay(): void {
    if (!this.story.simEnabled()) return;
    this.sim.toggle();
  }

  private openTree(): void {
    this.restartArmed = 0;
    $('restartBtn').textContent = 'Empezar de nuevo';
    $('restartBtn').classList.remove('warn');
    this.tree.show(this.unlocked(), this.story.upcomingTools());
  }

  private setFree(free: boolean): void {
    this.story.setFree(free);
    if (free) {
      seedFree(this.story.ctx);
      this.setTool('move', false);
      this.toast.show('Todas las herramientas desbloqueadas');
    } else {
      this.story.resume();
      this.setTool(this.initialTool(), false);
    }
    this.tree.hide();
    this.refreshUI();
  }

  private restart(): void {
    this.sim.clearRun();
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
    this.story.onChange = ({ newTools }) => {
      if (newTools.length) {
        this.toast.show(`Nueva herramienta: ${newTools.map((t) => this.tools[t].name).join(', ')}`);
        this.setTool(newTools[0], false);
      }
      this.refreshUI(newTools);
    };

    this.sim.onStateChange = () => this.toolbar.setRunning(this.sim.running);
    this.sim.shouldStop = () => {
      const b = this.view.bounds(Math.max(this.view.W, this.view.H) * 0.5);
      return this.world.particles.every((p) => p.pos.x < b.minX || p.pos.x > b.maxX || p.pos.y < b.minY || p.pos.y > b.maxY);
    };
    this.sim.onStep.push(() => {
      if (this.hitFlash > 0) return;
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
    if (this.tree.open) return;
    const el = document.activeElement;
    const typing = el && el !== document.body && el !== this.canvas;
    if (e.key === ' ' && !typing) {
      e.preventDefault();
      this.togglePlay();
    } else if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey && !typing) {
      this.sim.reset();
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

    this.sim.advance(dt);
    this.checkFell();
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.opts.stress && this.sim.finished) this.sim.start();

    const hasFrame = !!this.world.frame;
    if (hasFrame !== this.hadFrame) {
      this.hadFrame = hasFrame;
      this.inspector.rebuild();
    }
    if (this.selection && !this.world.exists(this.selection)) this.select(null);
    this.inspector.update();
    this.hud.update(this.world, this.sim, this.story.simEnabled(), this.fps);

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
    });
    requestAnimationFrame((t) => this.loop(t));
  }

  /** "Cayó": alguna partícula se alejó más de 1 m de donde partió en este lanzamiento. */
  private checkFell(): void {
    if (!this.sim.hasRun || this.fellRun === this.sim.runId) return;
    const moved = this.world.particles.some((p) => {
      const s = this.sim.initialState(p.id);
      return s && dist(p.pos, s.pos) > 1;
    });
    if (moved) {
      this.fellRun = this.sim.runId;
      this.bus.emit({ type: 'fell' });
    }
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

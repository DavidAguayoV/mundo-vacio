import type { GameEvent, GameEventType } from '../core/events';
import { freshProgress, type Progress } from '../state/progress';
import type { ToolId } from '../tools/tool';
import type { Chapter, Step, StoryContext } from './types';

export interface StoryChange {
  /** herramientas recién desbloqueadas (al pasar de capítulo) */
  newTools: ToolId[];
}

/**
 * Avanza el relato: escucha los eventos del juego y, cuando llega el evento del paso actual
 * y se cumple su condición, pasa al siguiente paso o capítulo.
 */
export class StoryEngine {
  private seenSinceStep = new Set<GameEventType>();
  onChange: ((c: StoryChange) => void) | null = null;
  readonly ctx: StoryContext;

  constructor(
    readonly chapters: Chapter[],
    public progress: Progress,
    ctx: Omit<StoryContext, 'seen'>,
    private save: (p: Progress) => void,
  ) {
    this.ctx = { ...ctx, seen: (t) => this.seenSinceStep.has(t) };
    if (!this.chapters[progress.chapter]?.steps[progress.step]) {
      this.progress = { ...freshProgress(), free: progress.free };
    }
  }

  get chapter(): Chapter {
    return this.chapters[this.progress.chapter];
  }

  get step(): Step {
    return this.chapter.steps[this.progress.step];
  }

  get free(): boolean {
    return this.progress.free;
  }

  get atEnd(): boolean {
    return this.step.on === 'end';
  }

  /** Herramientas disponibles: las de los capítulos ya alcanzados, o todas en modo libre. */
  unlockedTools(all: readonly ToolId[]): Set<ToolId> {
    if (this.free) return new Set(all);
    const s = new Set<ToolId>();
    for (let c = 0; c <= this.progress.chapter; c++) this.chapters[c].unlocks.forEach((t) => s.add(t));
    return s;
  }

  /** Herramientas que se desbloquean en el capítulo siguiente (para marcar "próxima" en el árbol). */
  upcomingTools(): ToolId[] {
    if (this.free) return [];
    return this.chapters[this.progress.chapter + 1]?.unlocks ?? [];
  }

  simEnabled(): boolean {
    return this.free || this.chapters.slice(0, this.progress.chapter + 1).some((c) => c.sim);
  }

  /** Prepara el mundo para el punto donde quedó el jugador (al cargar la página). */
  resume(): void {
    if (this.free) return;
    this.chapter.seed?.(this.ctx);
    this.step.enter?.(this.ctx);
  }

  handle(ev: GameEvent): void {
    if (this.free) return;
    this.seenSinceStep.add(ev.type);
    const st = this.step;
    if (st.on !== ev.type) return;
    if (st.when && !st.when(this.ctx)) return;
    this.advance();
  }

  advance(): void {
    const ch = this.chapter;
    let newTools: ToolId[] = [];
    if (this.progress.step < ch.steps.length - 1) {
      this.progress = { ...this.progress, step: this.progress.step + 1 };
    } else if (this.progress.chapter < this.chapters.length - 1) {
      this.progress = { ...this.progress, chapter: this.progress.chapter + 1, step: 0 };
      newTools = this.chapter.unlocks;
      this.chapter.seed?.(this.ctx);
    } else {
      return;
    }
    this.seenSinceStep.clear();
    this.step.enter?.(this.ctx);
    this.save(this.progress);
    this.onChange?.({ newTools });
  }

  setFree(free: boolean): void {
    this.progress = { ...this.progress, free };
    this.seenSinceStep.clear();
    this.save(this.progress);
    this.onChange?.({ newTools: [] });
  }

  restart(): void {
    this.progress = freshProgress();
    this.seenSinceStep.clear();
    this.save(this.progress);
    this.onChange?.({ newTools: [] });
  }
}

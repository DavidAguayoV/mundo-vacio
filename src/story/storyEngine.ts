import type { GameEvent, GameEventType } from '../core/events';
import { freshProgress, type Progress } from '../state/progress';
import type { ToolId } from '../tools/tool';
import { FORCE_SWITCHES, LENSES, TIME_SKILLS, type Chapter, type ForceSwitch, type Grant, type LensId, type Step, type StoryContext, type TimeSkill } from './types';

export interface StoryChange {
  /** herramientas o habilidades recién ganadas */
  newGrants: Grant[];
}

/**
 * Avanza el relato: escucha los eventos del juego y, cuando llega el evento del paso actual
 * y se cumple su condición, pasa al siguiente paso o capítulo. Lleva la cuenta de lo que el
 * jugador ya ganó (herramientas y habilidades del tiempo) y de sus predicciones.
 */
export class StoryEngine {
  private seenSinceStep = new Map<GameEventType, number>();
  onChange: ((c: StoryChange) => void) | null = null;
  readonly ctx: StoryContext;

  constructor(
    readonly chapters: Chapter[],
    public progress: Progress,
    ctx: Omit<StoryContext, 'seen' | 'count' | 'prediction'>,
    private save: (p: Progress) => void,
  ) {
    this.ctx = {
      ...ctx,
      seen: (t) => (this.seenSinceStep.get(t) ?? 0) > 0,
      count: (t) => this.seenSinceStep.get(t) ?? 0,
      prediction: (k) => this.progress.predictions[k],
    };
    const ch = this.chapters.find((c) => c.id === progress.chapter);
    if (!ch || !ch.steps[progress.step]) {
      this.progress = { ...freshProgress(chapters[0].id), free: progress.free, predictions: progress.predictions ?? {} };
    }
  }

  get index(): number {
    return Math.max(0, this.chapters.findIndex((c) => c.id === this.progress.chapter));
  }

  get chapter(): Chapter {
    return this.chapters[this.index];
  }

  get step(): Step {
    return this.chapter.steps[this.progress.step];
  }

  get free(): boolean {
    return this.progress.free;
  }

  /** Texto del paso actual (puede depender de las predicciones). */
  text(step: Step = this.step): string {
    return typeof step.text === 'function' ? step.text(this.ctx) : step.text;
  }

  // ---------- lo que el jugador ya ganó ----------

  private grantsUpTo(chapterIndex: number, stepIndex: number): Set<Grant> {
    const s = new Set<Grant>();
    for (let c = 0; c <= chapterIndex && c < this.chapters.length; c++) {
      const ch = this.chapters[c];
      ch.grants?.forEach((g) => s.add(g));
      const last = c < chapterIndex ? ch.steps.length - 1 : Math.min(stepIndex, ch.steps.length - 1);
      for (let k = 0; k <= last; k++) ch.steps[k]?.grants?.forEach((g) => s.add(g));
    }
    return s;
  }

  /** Todo lo que se puede ganar en el relato. */
  allGrants(): Set<Grant> {
    return this.grantsUpTo(this.chapters.length - 1, Infinity);
  }

  grants(): Set<Grant> {
    if (this.free) {
      const all = this.allGrants();
      TIME_SKILLS.forEach((t) => all.add(`time:${t}`));
      FORCE_SWITCHES.forEach((f) => all.add(`force:${f}`));
      LENSES.forEach((l) => all.add(`lens:${l}`));
      return all;
    }
    return this.grantsUpTo(this.index, this.progress.step);
  }

  /** Lo que todavía falta ganar en este capítulo y lo que trae el siguiente (para marcar «próxima» en el árbol). */
  upcomingGrants(): Set<Grant> {
    if (this.free) return new Set();
    const have = this.grants();
    const upTo = this.grantsUpTo(Math.min(this.index + 1, this.chapters.length - 1), Infinity);
    return new Set([...upTo].filter((g) => !have.has(g)));
  }

  unlockedTools(all: readonly ToolId[]): Set<ToolId> {
    const g = this.grants();
    return new Set(all.filter((t) => g.has(`tool:${t}`)));
  }

  timeSkills(): Set<TimeSkill> {
    const g = this.grants();
    return new Set(TIME_SKILLS.filter((t) => g.has(`time:${t}`)));
  }

  forceSwitches(): Set<ForceSwitch> {
    const g = this.grants();
    return new Set(FORCE_SWITCHES.filter((f) => g.has(`force:${f}`)));
  }

  lenses(): Set<LensId> {
    const g = this.grants();
    return new Set(LENSES.filter((l) => g.has(`lens:${l}`)));
  }

  /** Capítulos ya alcanzados (todos en modo libre). */
  reachedChapters(): Set<string> {
    const upTo = this.free ? this.chapters.length - 1 : this.index;
    return new Set(this.chapters.slice(0, upTo + 1).map((c) => c.id));
  }

  nextChapter(): string | null {
    if (this.free) return null;
    return this.chapters[this.index + 1]?.id ?? null;
  }

  // ---------- avanzar ----------

  /** Prepara el mundo para el punto donde quedó el jugador (al cargar la página). */
  resume(): void {
    if (this.free) return;
    this.chapter.seed?.(this.ctx);
    this.step.enter?.(this.ctx);
  }

  handle(ev: GameEvent): void {
    if (this.free) return;
    this.seenSinceStep.set(ev.type, (this.seenSinceStep.get(ev.type) ?? 0) + 1);
    const st = this.step;
    if (st.on !== ev.type) return;
    if (st.when && !st.when(this.ctx)) return;
    this.advance();
  }

  /** El jugador eligió una opción en una predicción. */
  choose(id: string): void {
    const st = this.step;
    if (this.free || !st.choices) return;
    if (st.ask) this.progress = { ...this.progress, predictions: { ...this.progress.predictions, [st.ask]: id } };
    this.advance();
  }

  advance(): void {
    const before = this.grants();
    const ch = this.chapter;
    if (this.progress.step < ch.steps.length - 1) {
      this.progress = { ...this.progress, step: this.progress.step + 1 };
    } else if (this.index < this.chapters.length - 1) {
      this.progress = { ...this.progress, chapter: this.chapters[this.index + 1].id, step: 0 };
      this.chapter.seed?.(this.ctx);
    } else {
      return;
    }
    this.seenSinceStep.clear();
    this.step.enter?.(this.ctx);
    this.save(this.progress);
    const newGrants = [...this.grants()].filter((g) => !before.has(g));
    this.onChange?.({ newGrants });
  }

  setFree(free: boolean): void {
    this.progress = { ...this.progress, free };
    this.seenSinceStep.clear();
    this.save(this.progress);
    this.onChange?.({ newGrants: [] });
  }

  restart(): void {
    this.progress = freshProgress(this.chapters[0].id);
    this.seenSinceStep.clear();
    this.save(this.progress);
    this.onChange?.({ newGrants: [] });
  }
}

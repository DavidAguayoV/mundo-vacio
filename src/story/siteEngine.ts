import type { GameEvent, GameEventType } from '../core/events';
import { freshProgress, type Progress, type SolvedSite } from '../state/progress';
import type { ToolId } from '../tools/tool';
import {
  FORCE_SWITCHES,
  LENSES,
  STAR_PREDICTION,
  STAR_SOLVED,
  TIME_SKILLS,
  type Choice,
  type ForceSwitch,
  type Grant,
  type LensId,
  type Site,
  type Step,
  type StoryContext,
  type TimeSkill,
  type Zone,
} from './types';

export interface StoryChange {
  /** herramientas o habilidades recién ganadas */
  newGrants: Grant[];
  /** estrellas recién ganadas en el rastro en curso */
  newStars?: string[];
  /** el rastro en curso se acaba de resolver */
  solved?: boolean;
  /** aviso para el jugador (un paso que no se dio por cumplido y pide repetir) */
  notice?: string;
}

/** Un tipo de estrella de un rastro: cuántas tiene el jugador de las que da. */
export interface StarPart {
  id: string;
  label: string;
  got: number;
  max: number;
}

/** Cómo se ve un rastro desde el mapa. */
export type SiteStatus = 'resuelto' | 'disponible' | 'cerrado';

/**
 * Motor del mundo abierto. Lleva el rastro en curso (o el mapa, si no hay ninguno), avanza sus pasos
 * con los eventos del juego, reparte herramientas y estrellas, y escribe la página de la bitácora
 * al resolver. Conserva la forma del antiguo motor de capítulos para que el resto del juego no cambie.
 */
export class SiteEngine {
  /** lo prestado por el rastro en curso (ver lend) */
  private lent = new Set<Grant>();
  private seenSinceStep = new Map<GameEventType, number>();
  private seenSinceEnter = new Map<GameEventType, number>();
  private runIds = new Set<number>();
  onChange: ((c: StoryChange) => void) | null = null;
  readonly ctx: StoryContext;

  constructor(
    readonly sites: Site[],
    readonly zones: Zone[],
    public progress: Progress,
    ctx: Omit<StoryContext, 'seen' | 'count' | 'prediction' | 'total' | 'runs'>,
    private save: (p: Progress) => void,
  ) {
    this.ctx = {
      ...ctx,
      seen: (t) => (this.seenSinceStep.get(t) ?? 0) > 0,
      count: (t) => this.seenSinceStep.get(t) ?? 0,
      prediction: (k) => this.progress.predictions[k],
      predictionLabel: (k) => {
        const id = this.progress.predictions[k];
        if (id === undefined) return undefined;
        for (const site of this.sites) {
          const step = site.steps.find((st) => st.ask === k);
          const choice = step ? this.choices(step).find((c) => c.id === id) : undefined;
          if (choice) return choice.label;
        }
        return undefined;
      },
      total: (t) => this.seenSinceEnter.get(t) ?? 0,
      runs: () => this.runIds.size,
    };
    if (this.progress.site && !this.siteById(this.progress.site)) this.progress = { ...this.progress, site: null, step: 0 };
  }

  // ---------- consultas ----------

  siteById(id: string): Site | undefined {
    return this.sites.find((s) => s.id === id);
  }

  zone(id: string): Zone | undefined {
    return this.zones.find((z) => z.id === id);
  }

  /** Rastro en curso (null en el mapa o en modo libre). */
  get site(): Site | null {
    if (this.progress.free || !this.progress.site) return null;
    return this.siteById(this.progress.site) ?? null;
  }

  get inMap(): boolean {
    return !this.progress.free && !this.site;
  }

  /** ¿Ya terminó los pasos del rastro en curso? (se está mirando su página) */
  get done(): boolean {
    const s = this.site;
    return !!s && this.progress.step >= s.steps.length;
  }

  get step(): Step | null {
    const s = this.site;
    if (!s || this.done) return null;
    return s.steps[this.progress.step] ?? null;
  }

  get free(): boolean {
    return this.progress.free;
  }

  text(step: Step | null = this.step): string {
    if (!step) return '';
    return typeof step.text === 'function' ? step.text(this.ctx) : step.text;
  }

  isSolved(id: string): boolean {
    return !!this.progress.solved[id];
  }

  solved(id: string): SolvedSite | undefined {
    return this.progress.solved[id];
  }

  /** Lo que le falta al jugador para entrar a un rastro. */
  missing(site: Site): Grant[] {
    const have = this.grants();
    return (site.needs ?? []).filter((g) => !have.has(g));
  }

  status(site: Site): SiteStatus {
    if (this.isSolved(site.id)) return 'resuelto';
    return this.missing(site).length ? 'cerrado' : 'disponible';
  }

  /** Estrellas de un rastro: las del mejor intento resuelto más las ganadas en el intento en curso. */
  stars(id: string): string[] {
    return [...new Set([...(this.progress.solved[id]?.stars ?? []), ...(this.progress.earned[id] ?? [])])];
  }

  /** Cuántas estrellas puede dar un rastro. */
  maxStars(site: Site): number {
    return this.starParts(site).reduce((n, p) => n + p.max, 0);
  }

  /** Las estrellas de un rastro con nombre: resuelto, predicción (si tiene) y retos, cuántas tiene y cuántas da cada una. */
  starParts(site: Site): StarPart[] {
    const have = this.stars(site.id);
    const parts: StarPart[] = [{ id: STAR_SOLVED, label: 'resuelto', got: have.includes(STAR_SOLVED) ? 1 : 0, max: 1 }];
    if (site.steps.some((s) => s.correct)) parts.push({ id: STAR_PREDICTION, label: 'predicción', got: have.includes(STAR_PREDICTION) ? 1 : 0, max: 1 });
    const dares = site.mastery ?? [];
    if (dares.length) {
      const got = dares.filter((m) => have.includes(m.id)).length;
      parts.push({ id: 'reto', label: dares.length > 1 ? 'retos' : 'reto', got, max: dares.length });
    }
    return parts;
  }

  /**
   * ¿El rastro en curso espera ahora este evento? (en el paso actual o en un reto que falta).
   * Sirve para avisar de un fallo solo cuando acertar todavía cuenta.
   */
  listensFor(type: GameEventType): boolean {
    const site = this.site;
    if (!site) return false;
    if (this.step?.on === type) return true;
    const have = this.stars(site.id);
    return (site.mastery ?? []).some((m) => m.on === type && !have.includes(m.id));
  }

  /** Dónde se gana algo (para explicar una puerta cerrada: «se gana en La deriva»). */
  sourceOf(g: Grant): Site | undefined {
    return this.sites.find((s) => this.siteGrants(s).has(g));
  }

  // ---------- lo ganado ----------

  private siteGrants(site: Site, upToStep = Infinity): Set<Grant> {
    const out = new Set<Grant>(site.grants ?? []);
    site.steps.forEach((st, i) => {
      if (i <= upToStep) st.grants?.forEach((g) => out.add(g));
    });
    return out;
  }

  /** Todo lo que se puede ganar en el mundo. */
  allGrants(): Set<Grant> {
    const all = new Set<Grant>();
    for (const s of this.sites) this.siteGrants(s).forEach((g) => all.add(g));
    return all;
  }

  grants(): Set<Grant> {
    if (this.free) {
      const all = this.allGrants();
      TIME_SKILLS.forEach((t) => all.add(`time:${t}`));
      FORCE_SWITCHES.forEach((f) => all.add(`force:${f}`));
      LENSES.forEach((l) => all.add(`lens:${l}`));
      return all;
    }
    return new Set([...this.progress.have, ...this.lent]);
  }

  /** Lo que el rastro en curso presta y el jugador todavía no tiene: se pierde al salir sin resolverlo. */
  get borrowed(): ReadonlySet<Grant> {
    return this.lent;
  }

  /** Lo que se puede ganar en los rastros abiertos que faltan (el árbol lo marca como «próxima»). */
  upcomingGrants(): Set<Grant> {
    if (this.free) return new Set();
    const have = this.grants();
    const out = new Set<Grant>();
    for (const s of this.sites) {
      if (this.status(s) !== 'disponible' && s.id !== this.site?.id) continue;
      this.siteGrants(s).forEach((g) => {
        if (!have.has(g)) out.add(g);
      });
    }
    return out;
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

  /** Rastros resueltos o en curso (el árbol los usa para la normal y el roce). */
  reachedChapters(): Set<string> {
    if (this.free) return new Set(this.sites.map((s) => s.id));
    const out = new Set(Object.keys(this.progress.solved));
    if (this.site) out.add(this.site.id);
    return out;
  }

  /** En el mundo abierto no hay un «siguiente»: lo próximo es todo lo abierto. */
  nextChapter(): string | null {
    return null;
  }

  /** Se queda con el jugador para siempre (al resolver el rastro). */
  private give(grants: Iterable<Grant>): Grant[] {
    const have = new Set(this.progress.have);
    const fresh = [...grants].filter((g) => !have.has(g));
    if (fresh.length) this.progress = { ...this.progress, have: [...have, ...fresh] };
    return fresh;
  }

  /**
   * Se presta mientras dure la visita al rastro. Las puertas del mapa miran solo lo que el jugador
   * tiene de verdad: entrar a un rastro y salir sin resolverlo no abre nada nuevo.
   */
  private lend(grants: Iterable<Grant>): Grant[] {
    const have = this.grants();
    const fresh = [...grants].filter((g) => !have.has(g));
    fresh.forEach((g) => this.lent.add(g));
    return fresh;
  }

  // ---------- entrar, salir, retomar ----------

  /** Entra a un rastro: el mundo se arma desde cero (quien llama lo vació antes). */
  enter(id: string): boolean {
    const site = this.siteById(id);
    if (!site || this.free || this.status(site) === 'cerrado') return false;
    this.progress = { ...this.progress, site: id, step: 0, earned: { ...this.progress.earned, [id]: [] } };
    this.resetCounters();
    this.ctx.sim.pauseAt = null;
    this.lent.clear();
    site.seed?.(this.ctx);
    const fresh = this.lend(this.siteGrants(site, 0));
    site.steps[0]?.enter?.(this.ctx);
    this.save(this.progress);
    this.onChange?.({ newGrants: fresh });
    return true;
  }

  /** Vuelve al mapa. */
  leave(): void {
    if (!this.progress.site) return;
    this.progress = { ...this.progress, site: null, step: 0 };
    this.resetCounters();
    this.ctx.sim.pauseAt = null;
    this.lent.clear();
    this.save(this.progress);
    this.onChange?.({ newGrants: [] });
  }

  /** Prepara el mundo para el punto donde quedó el jugador (al cargar la página). */
  resume(seed = true): void {
    const site = this.site;
    if (!site) return;
    // si el mundo del rastro se recuperó del autoguardado, no se vuelve a armar encima
    if (seed) site.seed?.(this.ctx);
    this.lent.clear();
    if (this.done) this.give(this.siteGrants(site));
    else this.lend(this.siteGrants(site, this.progress.step));
    this.step?.enter?.(this.ctx);
  }

  private resetCounters(): void {
    this.seenSinceStep.clear();
    this.seenSinceEnter.clear();
    this.runIds.clear();
  }

  // ---------- avanzar ----------

  handle(ev: GameEvent): void {
    if (!this.site) return;
    this.seenSinceStep.set(ev.type, (this.seenSinceStep.get(ev.type) ?? 0) + 1);
    this.seenSinceEnter.set(ev.type, (this.seenSinceEnter.get(ev.type) ?? 0) + 1);
    this.checkMastery(ev.type);
    const st = this.step;
    if (!st || st.on !== ev.type) return;
    if (st.when && !st.when(this.ctx)) return;
    const retry = st.retry?.(this.ctx);
    if (retry) {
      this.onChange?.({ newGrants: [], notice: retry });
      return;
    }
    this.advance();
  }

  /** Cada cuadro: objetivos que son una condición del mundo ('tick') y conteo de lanzamientos. */
  tick(): void {
    if (!this.site) return;
    const sim = this.ctx.sim;
    if (sim.hasRun) this.runIds.add(sim.runId);
    this.checkMastery('tick');
    const st = this.step;
    if (st?.on === 'tick' && st.when?.(this.ctx)) this.advance();
  }

  private checkMastery(type: GameEventType | 'tick'): void {
    const site = this.site;
    if (!site?.mastery) return;
    const earned = this.progress.earned[site.id] ?? [];
    const fresh = site.mastery.filter((m) => m.on === type && !earned.includes(m.id) && (!m.when || m.when(this.ctx))).map((m) => m.id);
    if (!fresh.length) return;
    this.progress = { ...this.progress, earned: { ...this.progress.earned, [site.id]: [...earned, ...fresh] } };
    this.save(this.progress);
    this.onChange?.({ newGrants: [], newStars: fresh });
  }

  /** El jugador eligió una opción en una predicción. */
  choose(id: string): void {
    const st = this.step;
    if (!st?.choices) return;
    if (st.ask) this.progress = { ...this.progress, predictions: { ...this.progress.predictions, [st.ask]: id } };
    // una pregunta con respuesta (no una predicción) puede pedir mirar de nuevo
    const retry = st.retry?.(this.ctx);
    if (retry) {
      this.onChange?.({ newGrants: [], notice: retry });
      return;
    }
    this.advance();
  }

  /** Las opciones del paso en curso (pueden depender del tiro del jugador). */
  choices(step: Step | null = this.step): Choice[] {
    if (!step?.choices) return [];
    return typeof step.choices === 'function' ? step.choices(this.ctx) : step.choices;
  }

  advance(): void {
    const site = this.site;
    if (!site || this.done) return;
    const next = this.progress.step + 1;
    this.progress = { ...this.progress, step: next };
    this.seenSinceStep.clear();
    if (next >= site.steps.length) {
      this.solve(site);
      return;
    }
    const fresh = this.lend(site.steps[next].grants ?? []);
    site.steps[next].enter?.(this.ctx);
    this.save(this.progress);
    this.onChange?.({ newGrants: fresh });
  }

  /** Cierra el rastro: estrellas, lo medido y la página de la bitácora. */
  private solve(site: Site): void {
    const stars = new Set<string>([STAR_SOLVED, ...(this.progress.earned[site.id] ?? [])]);
    const asked = site.steps.filter((s) => s.correct && s.ask);
    if (asked.length && asked.every((s) => this.progress.predictions[s.ask!] === s.correct)) stars.add(STAR_PREDICTION);
    const prev = this.progress.solved[site.id];
    prev?.stars.forEach((s) => stars.add(s));
    let measured: string | undefined;
    try {
      measured = site.page.measured?.(this.ctx) ?? prev?.measured;
    } catch {
      measured = prev?.measured;
    }
    const fresh = [...stars].filter((s) => !prev?.stars.includes(s) && !(this.progress.earned[site.id] ?? []).includes(s));
    this.progress = {
      ...this.progress,
      solved: { ...this.progress.solved, [site.id]: { stars: [...stars], measured, at: Date.now() } },
    };
    // lo prestado se queda: ahora sí abre las puertas del mapa
    this.give(this.siteGrants(site));
    this.lent.clear();
    this.save(this.progress);
    this.onChange?.({ newGrants: [], newStars: fresh, solved: true });
  }

  setFree(free: boolean): void {
    this.progress = { ...this.progress, free };
    this.resetCounters();
    this.ctx.sim.pauseAt = null;
    // al volver del laboratorio al rastro en curso, Game llama a resume(), que vuelve a prestar
    this.lent.clear();
    this.save(this.progress);
    this.onChange?.({ newGrants: [] });
  }

  /** Empieza de nuevo (o con un avance traído de un archivo). */
  restart(progress: Progress = freshProgress()): void {
    this.progress = progress;
    this.resetCounters();
    this.lent.clear();
    this.save(this.progress);
    this.onChange?.({ newGrants: [] });
  }
}

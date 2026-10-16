import type { Simulation } from '../physics/simulation';
import { loadPrefs, savePrefs, type LabPrefs } from '../state/prefs';
import { worldFromJSON } from '../world/serialize';
import { G_EARTH, type World } from '../world/world';
import { EXAMPLES } from './examples';
import { SHARE_PREFIX, decodeShare, fileName, makeExperiment, parseExperimentText, setupState, shareUrl, type Experiment } from './experiment';
import { LabPanel } from './labPanel';
import { ExperimentLibrary, type WorldSlot } from './library';

/** Lo que el laboratorio necesita del juego. */
export interface LabHost {
  world: World;
  sim: Simulation;
  isFree(): boolean;
  /** pasar al modo libre (el mundo se reemplaza justo después) */
  enterFree(): void;
  /** el mundo cambió por completo: limpiar selección y refrescar la interfaz */
  afterWorldReplaced(): void;
  toast(msg: string): void;
}

const AUTOSAVE_EVERY = 1000; // ms

/**
 * Laboratorio: guarda y abre experimentos (en este navegador, como archivo .json o como enlace),
 * autoguarda el mundo de cada modo y aplica las preferencias de vista del modo libre.
 */
export class Lab {
  readonly library = new ExperimentLibrary();
  prefs: LabPrefs = loadPrefs();
  name = 'Mi experimento';
  private panel: LabPanel;
  private lastSaved: Partial<Record<WorldSlot, string>> = {};
  private lastCheck = 0;

  constructor(
    private host: LabHost,
    /** false en la prueba de rendimiento: no se toca nada guardado */
    private persist = true,
  ) {
    this.panel = new LabPanel({
      state: () => ({ name: this.name, saved: this.library.list(), g: host.world.g, prefs: this.prefs }),
      save: (name) => this.save(name),
      download: (name) => this.download(name),
      share: (name) => this.share(name),
      open: (id) => {
        const e = this.library.get(id);
        if (e) this.load(e);
      },
      remove: (id) => {
        this.library.remove(id);
        this.panel.refresh();
      },
      openFile: (f) => this.openFile(f),
      openExample: (id) => {
        const e = EXAMPLES.find((x) => x.id === id);
        if (e) this.load(e.build());
      },
      setG: (g) => this.setG(g),
      clearWorld: () => this.clearWorld(),
      setPrefs: (p) => {
        this.prefs = p;
        savePrefs(p);
        this.panel.refresh();
      },
    });
    this.wireDrop();
    // un enlace pegado en la barra con la app ya abierta solo cambia el hash, sin recargar
    window.addEventListener('hashchange', () => void this.loadFromHash());
  }

  get open(): boolean {
    return this.panel.open;
  }

  show(): void {
    this.panel.show();
  }

  hide(): void {
    this.panel.hide();
  }

  /** Qué dibujar: en el relato siempre todo; en el laboratorio, según las preferencias. */
  display(): { positions: boolean; trails: boolean } {
    if (!this.host.isFree()) return { positions: true, trails: true };
    return { positions: this.prefs.showPositions, trails: this.prefs.showTrails };
  }

  /** Cada cuadro: cámara lenta y autoguardado (como mucho una vez por segundo, y solo si algo cambió). */
  tick(now: number): void {
    this.host.sim.timeScale = this.host.isFree() ? this.prefs.timeScale : 1;
    if (now - this.lastCheck < AUTOSAVE_EVERY) return;
    this.lastCheck = now;
    this.autosaveNow();
  }

  private get slot(): WorldSlot {
    return this.host.isFree() ? 'lab' : 'story';
  }

  autosaveNow(slot: WorldSlot = this.slot): void {
    if (!this.persist) return;
    const json = setupState(this.host.world, this.host.sim);
    const text = JSON.stringify(json);
    if (text === this.lastSaved[slot]) return;
    this.lastSaved[slot] = text;
    this.library.autosave(slot, json);
  }

  /** Recupera el mundo autoguardado de un modo. Devuelve false si no había. */
  restoreSlot(slot: WorldSlot): boolean {
    if (!this.persist) return false;
    const json = this.library.loadAutosave(slot);
    if (!json) return false;
    this.host.sim.clearRun();
    worldFromJSON(json, this.host.world);
    this.lastSaved[slot] = JSON.stringify(json);
    return true;
  }

  forget(slot: WorldSlot): void {
    if (!this.persist) return;
    this.library.clearAutosave(slot);
    delete this.lastSaved[slot];
  }

  // ---------- abrir ----------

  load(exp: Experiment): void {
    if (!this.host.isFree()) this.host.enterFree();
    this.host.sim.clearRun();
    worldFromJSON(exp.world, this.host.world);
    this.name = exp.name;
    this.host.afterWorldReplaced();
    this.autosaveNow('lab');
    this.panel.hide();
    this.host.toast(`Abriste «${exp.name}»`);
  }

  private openFile(file: File): void {
    file
      .text()
      .then((text) => this.load(parseExperimentText(text)))
      .catch((e: unknown) => this.host.toast(e instanceof Error ? e.message : 'No se pudo abrir el archivo.'));
  }

  /** Si la página se abrió con un enlace de experimento (#exp=…), lo carga y limpia la URL. */
  async loadFromHash(): Promise<void> {
    if (!location.hash.startsWith(SHARE_PREFIX)) return;
    const code = location.hash.slice(SHARE_PREFIX.length);
    history.replaceState(null, '', location.pathname + location.search);
    try {
      this.load(await decodeShare(code));
    } catch (e) {
      this.host.toast(e instanceof Error ? e.message : 'No se pudo abrir el enlace.');
    }
  }

  private wireDrop(): void {
    window.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    });
    window.addEventListener('drop', (e) => {
      const f = e.dataTransfer?.files?.[0];
      if (!f) return;
      e.preventDefault();
      this.openFile(f);
    });
  }

  // ---------- guardar ----------

  private current(name: string): Experiment {
    this.name = name.trim() || this.name;
    return makeExperiment(setupState(this.host.world, this.host.sim), this.name);
  }

  private save(name: string): void {
    const saved = this.library.save(this.current(name));
    this.host.toast(saved ? `Guardaste «${saved.name}» en este navegador` : 'No se pudo guardar: el navegador no permite almacenamiento.');
    this.panel.refresh();
  }

  private download(name: string): void {
    const exp = this.current(name);
    const blob = new Blob([JSON.stringify(exp, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName(exp.name);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private async share(name: string): Promise<{ url: string; copied: boolean }> {
    const url = await shareUrl(this.current(name), location.origin + location.pathname);
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      /* sin portapapeles: se muestra el enlace para copiarlo a mano */
    }
    return { url, copied };
  }

  // ---------- mundo ----------

  private setG(mag: number | null): void {
    const w = this.host.world;
    if (mag === null) {
      w.g = null;
    } else {
      // se conserva la dirección elegida; si no había g, hacia abajo
      const g = w.g;
      const L = g ? Math.hypot(g.x, g.y) : 0;
      w.g = L > 0 && g ? { x: (g.x / L) * mag, y: (g.y / L) * mag } : { x: 0, y: -mag };
    }
    if (this.host.sim.hasRun) this.host.sim.reset();
    this.host.toast(mag === null ? 'Sin gravedad' : mag === G_EARTH ? 'g de la Tierra' : `|g| = ${String(mag).replace('.', ',')} m/s²`);
    this.panel.refresh();
  }

  private clearWorld(): void {
    const w = this.host.world;
    this.host.sim.clearRun();
    w.particles = [];
    w.vectors = [];
    w.sums = [];
    w.targets = [];
    w.surfaces = [];
    this.name = 'Mi experimento';
    this.host.afterWorldReplaced();
    this.panel.refresh();
  }
}

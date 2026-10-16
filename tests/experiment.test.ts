import { describe, expect, it } from 'vitest';
import { decodeShare, encodeShare, fileName, makeExperiment, parseExperiment, parseExperimentText, setupState } from '../src/lab/experiment';
import { ExperimentLibrary } from '../src/lab/library';
import { UniformGravity } from '../src/physics/forces';
import { Simulation } from '../src/physics/simulation';
import { ReferenceFrame } from '../src/world/frame';
import { worldToJSON } from '../src/world/serialize';
import { World } from '../src/world/world';

function sampleWorld(): World {
  const w = new World();
  w.frame = new ReferenceFrame({ x: 0.5, y: -1 }, 0.3);
  w.g = { x: 0, y: -1.62 };
  w.addParticle({ x: -3, y: 1.5 }, 2, { x: 4, y: 3 });
  w.addSurface({ x: -5, y: -1 }, { x: 5, y: 0 }, 0.7, 0.3);
  const a = w.addVector({ x: 0, y: 0 }, { x: 1, y: 2 });
  const b = w.addVector({ x: 1, y: 0 }, { x: 3, y: 0 });
  w.addSum(a.id, b.id);
  return w;
}

/** Storage en memoria para probar sin navegador. */
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe('experimentos', () => {
  it('un enlace comprimido devuelve el mismo experimento', async () => {
    const exp = makeExperiment(worldToJSON(sampleWorld()), 'Luna inclinada', 'con roce');
    const code = await encodeShare(exp, true);
    expect(code[0]).toBe('z');
    expect(await decodeShare(code)).toEqual(exp);
  });

  it('también funciona sin compresión', async () => {
    const exp = makeExperiment(worldToJSON(sampleWorld()), 'Sin comprimir');
    const code = await encodeShare(exp, false);
    expect(code[0]).toBe('j');
    expect(await decodeShare(code)).toEqual(exp);
  });

  it('un enlace dañado da un mensaje legible', async () => {
    await expect(decodeShare('zAAAA')).rejects.toThrow(/enlace|JSON/);
    await expect(decodeShare('x123')).rejects.toThrow(/enlace/);
  });

  it('acepta un mundo sin envoltorio y rechaza basura', () => {
    const bare = worldToJSON(sampleWorld());
    expect(parseExperiment(bare).world).toEqual(bare);
    expect(() => parseExperimentText('no es json')).toThrow(/JSON/);
    expect(() => parseExperiment({ format: 'mundo-vacio', version: 9, world: bare })).toThrow(/versión/);
  });

  it('guarda el estado de preparación, no la partícula a mitad de vuelo', () => {
    const w = sampleWorld();
    const sim = new Simulation(w);
    sim.forces.push(new UniformGravity());
    const start = { ...w.particles[0].pos };
    sim.start();
    for (let k = 0; k < 30; k++) sim.advance(1 / 60);
    expect(w.particles[0].pos).not.toEqual(start);
    expect(setupState(w, sim).particles[0].pos).toEqual(start);
    expect(setupState(w, sim).particles[0].vel).toEqual({ x: 4, y: 3 });
  });

  it('nombres de archivo legibles', () => {
    expect(fileName('Plano inclinado: μ = 0,6')).toBe('plano-inclinado-0-6.json');
    expect(fileName('   ')).toBe('experimento.json');
  });
});

describe('biblioteca local', () => {
  it('guarda, lista del más reciente al más antiguo, reemplaza por nombre y borra', () => {
    const lib = new ExperimentLibrary(new MemoryStorage());
    const w = worldToJSON(sampleWorld());
    const a = lib.save({ ...makeExperiment(w, 'Uno'), savedAt: '2026-10-01T10:00:00Z' })!;
    lib.save({ ...makeExperiment(w, 'Dos'), savedAt: '2026-10-02T10:00:00Z' });
    expect(lib.list().map((e) => e.name)).toEqual(['Dos', 'Uno']);
    const again = lib.save({ ...makeExperiment(w, 'uno'), savedAt: '2026-10-03T10:00:00Z' })!;
    expect(again.id).toBe(a.id);
    expect(lib.list()).toHaveLength(2);
    lib.remove(a.id);
    expect(lib.list().map((e) => e.name)).toEqual(['Dos']);
  });

  it('ignora entradas dañadas y funciona sin almacenamiento', () => {
    const st = new MemoryStorage();
    st.setItem('mundoVacio.experiments', '[{"format":"mundo-vacio","version":1,"world":{"version":1,"particles":[{"id":"x"}]}}]');
    expect(new ExperimentLibrary(st).list()).toEqual([]);
    const none = new ExperimentLibrary(null);
    expect(none.list()).toEqual([]);
    expect(none.save(makeExperiment(worldToJSON(sampleWorld()), 'x'))).toBeNull();
  });

  it('el autoguardado del relato y del laboratorio no se mezclan', () => {
    const lib = new ExperimentLibrary(new MemoryStorage());
    const story = worldToJSON(sampleWorld());
    const lab = worldToJSON(new World());
    lib.autosave('story', story);
    lib.autosave('lab', lab);
    expect(lib.loadAutosave('story')).toEqual(story);
    expect(lib.loadAutosave('lab')).toEqual(lab);
    lib.clearAutosave('story');
    expect(lib.loadAutosave('story')).toBeNull();
  });
});

import type { Simulation } from '../physics/simulation';
import { worldFromJSON, worldToJSON, type WorldJSON } from '../world/serialize';
import type { World } from '../world/world';

/** Un experimento guardado: el mundo en su estado de preparación, con nombre. */
export interface Experiment {
  format: 'mundo-vacio';
  version: 1;
  name: string;
  description?: string;
  savedAt: string; // ISO 8601
  world: WorldJSON;
}

/**
 * El mundo tal como estaba al lanzar: si hay un lanzamiento en curso o pausado,
 * las partículas se guardan en su posición y velocidad iniciales, no a mitad de vuelo.
 */
export function setupState(world: World, sim: Simulation): WorldJSON {
  const json = worldToJSON(world);
  for (const p of json.particles) {
    const s = sim.initialState(p.id);
    if (s) {
      p.pos = { ...s.pos };
      p.vel = { ...s.vel };
    }
  }
  return json;
}

export function makeExperiment(world: WorldJSON, name: string, description?: string): Experiment {
  return {
    format: 'mundo-vacio',
    version: 1,
    name: name.trim() || 'Experimento sin nombre',
    ...(description ? { description } : {}),
    savedAt: new Date().toISOString(),
    world,
  };
}

/**
 * Lee un experimento (o un mundo suelto) desde JSON ya parseado y lo valida cargándolo en un mundo de prueba.
 * Lanza Error con un mensaje legible si no sirve.
 */
export function parseExperiment(data: unknown): Experiment {
  const d = data as Partial<Experiment> & { version?: unknown };
  if (d && typeof d === 'object' && d.format === 'mundo-vacio') {
    if (d.version !== 1) throw new Error('El experimento es de una versión más nueva de Mundo Vacío.');
    worldFromJSON(d.world);
    return {
      format: 'mundo-vacio',
      version: 1,
      name: typeof d.name === 'string' && d.name.trim() ? d.name : 'Experimento sin nombre',
      ...(typeof d.description === 'string' ? { description: d.description } : {}),
      savedAt: typeof d.savedAt === 'string' ? d.savedAt : new Date().toISOString(),
      world: d.world as WorldJSON,
    };
  }
  // un mundo sin envoltorio también sirve
  worldFromJSON(data);
  return makeExperiment(data as WorldJSON, 'Experimento importado');
}

export function parseExperimentText(text: string): Experiment {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es JSON válido.');
  }
  return parseExperiment(data);
}

// ---------- enlaces para compartir ----------

const toB64url = (bytes: Uint8Array): string => {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromB64url = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const buf = await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream)).arrayBuffer();
  return new Uint8Array(buf);
}

const canCompress = (): boolean => typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

/**
 * Codifica un experimento para ponerlo en la URL (#exp=…).
 * Prefijo "z": JSON comprimido con deflate; prefijo "j": JSON sin comprimir (navegadores sin CompressionStream).
 */
export async function encodeShare(exp: Experiment, compress = canCompress()): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(exp));
  if (compress) return 'z' + toB64url(await pipe(bytes, new CompressionStream('deflate-raw')));
  return 'j' + toB64url(bytes);
}

export async function decodeShare(code: string): Promise<Experiment> {
  const kind = code[0];
  const body = code.slice(1);
  let bytes: Uint8Array;
  try {
    bytes = fromB64url(body);
    if (kind === 'z') {
      if (!canCompress()) throw new Error('Este navegador no puede abrir enlaces comprimidos.');
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } else if (kind !== 'j') {
      throw new Error('formato');
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Este navegador')) throw e;
    throw new Error('El enlace del experimento está incompleto o dañado.');
  }
  return parseExperimentText(new TextDecoder().decode(bytes));
}

export const SHARE_PREFIX = '#exp=';

export async function shareUrl(exp: Experiment, base = location.href): Promise<string> {
  const url = new URL(base);
  url.hash = SHARE_PREFIX.slice(1) + (await encodeShare(exp));
  return url.toString();
}

/** Nombre de archivo a partir del nombre del experimento: "Plano inclinado" → plano-inclinado.json */
export function fileName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'experimento'}.json`;
}

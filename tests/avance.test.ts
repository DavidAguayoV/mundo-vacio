import { describe, expect, it } from 'vitest';
import { freshProgress, openingProgress, progressFile, progressFileName, readProgressFile, type Progress } from '../src/state/progress';
import { SITE_IDS } from '../src/story/sites';

// Al abrir la página y el avance como archivo .json.

/** Un avance a mitad de un rastro, con algo resuelto. */
function midway(): Progress {
  const p = freshProgress();
  p.site = 'boya';
  p.step = 1;
  p.have = ['tool:origin', 'tool:particle', 'tool:move', 'time:flow'];
  p.solved = { vacio: { stars: ['resuelto'], at: 1 }, particula: { stars: ['resuelto', 'prediccion'], at: 2 }, 'desde-siempre': { stars: ['resuelto'], at: 3 } };
  p.predictions = { inercia: 'recto' };
  return p;
}

describe('al abrir la página', () => {
  it('sin nada resuelto, se queda donde iba (al comienzo, «El vacío»)', () => {
    const p = freshProgress();
    p.step = 1;
    expect(openingProgress(p)).toEqual(p);
  });

  it('con avance, entra al mapa y no a mitad de un rastro', () => {
    const p = openingProgress(midway());
    expect(p.site).toBeNull();
    expect(p.step).toBe(0);
    expect(Object.keys(p.solved)).toHaveLength(3);
    expect(p.have).toContain('time:flow');
  });

  it('con avance, tampoco abre en el laboratorio', () => {
    const p = { ...midway(), free: true };
    expect(openingProgress(p).free).toBe(false);
  });
});

describe('el avance como archivo .json', () => {
  it('lo que se descarga se vuelve a leer igual', () => {
    const p = midway();
    const back = readProgressFile(progressFile(p, new Date(2026, 9, 17)), SITE_IDS);
    expect(back).toEqual(p);
  });

  it('el archivo dice qué es y cuándo se guardó', () => {
    const data = JSON.parse(progressFile(midway(), new Date(Date.UTC(2026, 9, 17, 12))));
    expect(data.kind).toBe('mundo-vacio/avance');
    expect(data.savedAt).toBe('2026-10-17T12:00:00.000Z');
    expect(progressFileName(new Date(2026, 9, 7))).toBe('mundo-vacio-avance-2026-10-07.json');
  });

  it('también acepta el progreso suelto que guarda el navegador', () => {
    const p = midway();
    expect(readProgressFile(JSON.stringify(p), SITE_IDS)).toEqual(p);
  });

  it('un experimento del laboratorio, un JSON roto o cualquier otra cosa no es un avance', () => {
    expect(readProgressFile('{"name":"Plano inclinado","world":{}}', SITE_IDS)).toBeNull();
    expect(readProgressFile('{ esto no es json', SITE_IDS)).toBeNull();
    expect(readProgressFile('42', SITE_IDS)).toBeNull();
  });

  it('lo que no calza se descarta: rastros que no existen y herramientas sin forma', () => {
    const p = midway() as unknown as Record<string, unknown>;
    p.solved = { ...(p.solved as object), 'no-existe': { stars: ['resuelto'], at: 1 } };
    p.have = ['tool:origin', 42, 'cualquier-cosa'];
    const back = readProgressFile(JSON.stringify(p), SITE_IDS)!;
    expect(back.solved['no-existe']).toBeUndefined();
    expect(back.have).toEqual(['tool:origin']);
  });

  it('un avance de antes de dividir «Desde siempre» se migra al leerlo', () => {
    const p = midway();
    p.site = 'desde-siempre';
    p.step = 6;
    delete p.solved['desde-siempre'];
    const back = readProgressFile(JSON.stringify(p), SITE_IDS)!;
    expect(back.site).toBe('cuadro-a-cuadro');
    expect(back.solved['desde-siempre']).toBeDefined();
  });
});

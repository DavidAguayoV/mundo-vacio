import { describe, expect, it } from 'vitest';
import { qrMatrix, qrSvg } from '../src/demo/qr';
import ref from './fixtures/qr-demo.json';

// El código QR del kiosco, comparado módulo a módulo con una implementación de referencia (python-qrcode).

const rows = (m: boolean[][]) => m.map((r) => r.map((c) => (c ? '1' : '0')).join(''));

describe('código QR sin dependencias', () => {
  for (const [mask, expected] of Object.entries(ref.masks)) {
    it(`coincide con la referencia con la máscara ${mask}`, () => {
      expect(rows(qrMatrix(ref.text, Number(mask)))).toEqual(expected);
    });
  }

  it('elige una máscara válida y entrega un SVG con su margen claro', () => {
    const m = qrMatrix(ref.text);
    expect(m.length).toBe(33); // versión 4
    const svg = qrSvg(ref.text);
    expect(svg).toContain('viewBox="0 0 41 41"');
    expect(svg.startsWith('<svg')).toBe(true);
  });
});

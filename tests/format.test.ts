import { describe, expect, it } from 'vitest';
import { fmt, fmtDeg, fmtVec, subscript } from '../src/core/format';

describe('formato en español', () => {
  it('usa coma decimal y signo menos tipográfico', () => {
    expect(fmt(1.2)).toBe('1,20');
    expect(fmt(-0.5)).toBe('−0,50');
    expect(fmt(9.8, 1)).toBe('9,8');
  });

  it('no muestra "−0,00"', () => {
    expect(fmt(-0.001)).toBe('0,00');
    expect(fmt(-0)).toBe('0,00');
  });

  it('separa componentes con punto y coma', () => {
    expect(fmtVec({ x: 1.2, y: -0.5 }, 'm')).toBe('(1,20 ; −0,50) m');
    expect(fmtVec({ x: 0, y: 9.8 })).toBe('(0,00 ; 9,80)');
  });

  it('formatea ángulos y subíndices', () => {
    expect(fmtDeg(36.87)).toBe('36,9°');
    expect(subscript(12)).toBe('₁₂');
  });
});

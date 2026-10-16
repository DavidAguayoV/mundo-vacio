// Formato numérico en español: coma decimal, signo menos tipográfico y componentes separadas por " ; ".

import type { Vec2 } from './vec';

const MINUS = '−';

/** 1.2 → "1,20"; −0.004 → "0,00" (nunca "−0,00"). */
export function fmt(n: number, decimals = 2): string {
  if (!Number.isFinite(n)) return '—';
  let s = n.toFixed(decimals);
  if (Number(s) === 0) s = (0).toFixed(decimals);
  return s.replace('.', ',').replace('-', MINUS);
}

/** (1,20 ; −0,50) m */
export function fmtVec(v: Vec2, unit = '', decimals = 2): string {
  const body = `(${fmt(v.x, decimals)} ; ${fmt(v.y, decimals)})`;
  return unit ? `${body} ${unit}` : body;
}

export const fmtDeg = (deg: number, decimals = 1): string => `${fmt(deg, decimals)}°`;

const SUBSCRIPT = '₀₁₂₃₄₅₆₇₈₉';
/** 12 → "₁₂" */
export const subscript = (n: number | string): string =>
  String(n)
    .split('')
    .map((d) => (d >= '0' && d <= '9' ? SUBSCRIPT[+d] : d))
    .join('');

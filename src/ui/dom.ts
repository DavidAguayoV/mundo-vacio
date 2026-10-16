// Ayudas mínimas de DOM (sin framework).

export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Falta el elemento #${id}`);
  return el as T;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
}

/** Cambia el texto solo si es distinto (evita trabajo de layout en cada cuadro). */
export function setText(el: Element, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

const SUB: Record<string, string> = {
  '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
  'ₐ': 'a', 'ₑ': 'e', 'ₓ': 'x', 'ᵧ': 'y', 'ᵥ': 'v', 'ₛ': 's', 'ₖ': 'k',
};

/**
 * Nombre de una magnitud escrito como en la pizarra: las letras sueltas (r, v, θ, Fg) en cursiva,
 * las palabras (largo, medido, tan) en redonda y los subíndices Unicode como <sub>, porque la serif
 * no los trae.
 */
export function symbol(text: string): Node[] {
  const out: Node[] = [];
  const re = /([A-Za-zα-ωΑ-ΓΕ-Ωθ]+)|([₀-₉ₐₑₓᵧᵥₛₖ]+)|([^A-Za-zα-ωΑ-ΓΕ-Ωθ₀-₉ₐₑₓᵧᵥₛₖ]+)/g;
  for (const m of text.matchAll(re)) {
    if (m[1]) out.push(m[1].length <= 2 ? h('i', {}, m[1]) : document.createTextNode(m[1]));
    else if (m[2]) out.push(h('sub', {}, [...m[2]].map((c) => SUB[c] ?? c).join('')));
    else out.push(document.createTextNode(m[3]));
  }
  return out;
}

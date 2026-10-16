// Íconos de 24×24 en trazo, heredan el color del botón.

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  move: svg('<path d="M12 3v18M3 12h18M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5"/>'),
  origin: svg('<path d="M5 19V5M5 19h14M5 5l-2 3M5 5l2 3M19 19l-3-2M19 19l-3 2"/><circle cx="5" cy="19" r="1.4" fill="currentColor"/>'),
  particle: svg('<circle cx="12" cy="12" r="4" fill="currentColor"/><circle cx="12" cy="12" r="8" stroke-dasharray="2 3"/>'),
  vector: svg('<path d="M5 19L19 5M19 5h-7M19 5v7"/>'),
  sum: svg('<path d="M4 18l7-4M11 14l7-9M4 18L18 5"/><path d="M18 5l-1 4M18 5l-4 1"/>'),
  gravity: svg('<path d="M6 4v12M12 4v14M18 4v12M6 16l-2-3M6 16l2-3M12 18l-2-3M12 18l2-3M18 16l-2-3M18 16l2-3"/>'),
  velocity: svg('<circle cx="6" cy="17" r="2.5" fill="currentColor"/><path d="M8 15l11-9M19 6h-5M19 6v5"/>'),
  surface: svg('<path d="M3 15l18-6"/><path d="M6 16l-2 3M10 14.7l-2 3M14 13.3l-2 3M18 12l-2 3" stroke-width="1.2"/><circle cx="12" cy="9" r="2" fill="currentColor"/>'),
  lab: svg('<path d="M9 3h6M10 3v6l-5.5 9.5A1.6 1.6 0 0 0 5.9 21h12.2a1.6 1.6 0 0 0 1.4-2.5L14 9V3"/><path d="M7.5 15h9"/>'),
  play: svg('<path d="M7 5l12 7-12 7z" fill="currentColor"/>'),
  pause: svg('<path d="M8 5v14M16 5v14"/>'),
  reset: svg('<path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4"/>'),
  tree: svg('<circle cx="12" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/><path d="M12 7v5M12 12l-6 5M12 12l6 5"/>'),
} as const;

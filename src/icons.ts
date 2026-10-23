// Small inline SVG icons (24x24, stroked with currentColor) so the toolbar needs no icon font.
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  pen: svg('<path d="M4 20l4-1 11-11-3-3L5 16l-1 4z"/><path d="M14 6l3 3"/>'),
  brush: svg('<path d="M18 3l3 3-9 9-3-3 9-9z"/><path d="M9 12c-3 0-5 2-5 5 0 1.5-1 2.5-2 3 3 1 7 0 8-3 .5-1.5 0-3-1-5z"/>'),
  highlighter: svg('<path d="M9 11l-5 5v4h4l5-5"/><path d="M9 11l6-6 4 4-6 6-4-4z"/><path d="M4 22h16"/>'),
  line: svg('<path d="M5 19L19 5"/>'),
  arrow: svg('<path d="M5 19L19 5"/><path d="M10 5h9v9"/>'),
  rect: svg('<rect x="4" y="6" width="16" height="12" rx="1"/>'),
  ellipse: svg('<ellipse cx="12" cy="12" rx="9" ry="6.5"/>'),
  eraser: svg('<path d="M7 21h10"/><path d="M5 15l9-9 5 5-8 8H9l-4-4z"/><path d="M10 10l5 5"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>'),
  redo: svg('<path d="M15 14l5-5-5-5"/><path d="M20 9H9a5 5 0 000 10h3"/>'),
  clear: svg('<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>'),
  minimize: svg('<path d="M5 12h14"/>'),
  photo: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 8"/>'),
  save: svg('<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>'),
  board: svg('<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 010 16z" fill="currentColor"/>'),
  pointer: svg('<path d="M5 3l14 7-6 2-2 6-6-15z"/>'),
} as const;

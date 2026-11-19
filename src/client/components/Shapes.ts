export function renderOptionShapeSvg(index: number, className = 'w-6 h-6'): string {
  switch (index) {
    case 0:
      // Triangle
      return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="${className}"><path d="M12 3L22 20H2L12 3Z"/></svg>`;
    case 1:
      // Diamond
      return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="${className}"><path d="M12 2L22 12L12 22L2 12L12 2Z"/></svg>`;
    case 2:
      // Circle
      return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="${className}"><circle cx="12" cy="12" r="9"/></svg>`;
    default:
      // Square
      return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="${className}"><rect x="4" y="4" width="16" height="16" rx="2.5"/></svg>`;
  }
}

export function renderKaWinMarkSvg(className = 'w-8 h-8'): string {
  return `<svg viewBox="0 0 36 36" fill="none" aria-hidden="true" class="${className}">
    <rect width="36" height="36" rx="9" fill="#1E293B"/>
    <rect x="1" y="1" width="34" height="34" rx="8" stroke="#F59E0B" stroke-opacity="0.6" stroke-width="1.5"/>
    <path d="M10 9V27M10 18L20 9M14.5 14L22 27" stroke="#F8FAFC" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M25.5 9L28 15L25.5 21L23 15L25.5 9Z" fill="#F59E0B"/>
  </svg>`;
}

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

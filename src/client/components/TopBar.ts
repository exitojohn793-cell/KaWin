import { renderKaWinMarkSvg } from './Shapes.ts';

export type AppRoute = 'home' | 'join' | 'practice' | 'host' | 'library' | 'editor';

export interface TopBarProps {
  activeRoute: AppRoute;
  wsConnected: boolean;
  muted: boolean;
  onNavigate: (route: AppRoute) => void;
  onToggleMute: () => void;
  onQuickHost: () => void;
}

export function renderTopBar(
  container: HTMLElement,
  props: TopBarProps
): void {
  const navItems: Array<{ route: AppRoute; label: string }> = [
    { route: 'home', label: 'Inicio' },
    { route: 'join', label: 'Unirse' },
    { route: 'practice', label: 'Práctica' },
    { route: 'editor', label: 'Crear Quiz' },
    { route: 'library', label: 'Biblioteca' },
  ];

  container.innerHTML = `
    <header class="sticky top-0 z-40 border-b border-white/10 bg-[#0B1020]/90 backdrop-blur-md">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3.5 sm:gap-8 sm:px-6">
        <button
          type="button"
          data-nav="home"
          class="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 rounded-lg focus-visible:outline-amber-400"
          aria-label="Ir al inicio de KaWin"
        >
          ${renderKaWinMarkSvg('w-8 h-8')}
          <span class="font-display text-xl font-extrabold tracking-tight text-white">KaWin</span>
        </button>

        <nav aria-label="Navegación principal" class="hidden md:flex items-center gap-6 text-sm font-medium">
          ${navItems
            .map((item) => {
              const isActive = props.activeRoute === item.route;
              return `
                <button
                  type="button"
                  data-nav="${item.route}"
                  class="whitespace-nowrap shrink-0 py-1 transition-colors border-b-2 ${
                    isActive
                      ? 'border-amber-400 text-white'
                      : 'border-transparent text-slate-300 hover:text-white'
                  }"
                >
                  ${item.label}
                </button>
              `;
            })
            .join('')}
        </nav>

        <div class="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            data-action="toggle-mute"
            aria-label="${props.muted ? 'Activar sonido' : 'Silenciar sonido'}"
            title="${props.muted ? 'Activar sonido' : 'Silenciar sonido'}"
            class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors"
          >
            ${
              props.muted
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`
            }
          </button>

          <button
            type="button"
            data-action="quick-host"
            class="whitespace-nowrap shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors"
          >
            Presentar en Vivo
          </button>
        </div>
      </div>

      <nav aria-label="Navegación móvil" class="flex md:hidden items-center justify-around border-t border-white/10 px-2 py-1.5 text-xs font-medium">
        ${navItems
          .map((item) => {
            const isActive = props.activeRoute === item.route;
            return `
              <button
                type="button"
                data-nav="${item.route}"
                class="whitespace-nowrap shrink-0 rounded-md px-2.5 py-1.5 transition-colors ${
                  isActive
                    ? 'bg-white/10 text-amber-300 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }"
              >
                ${item.label}
              </button>
            `;
          })
          .join('')}
      </nav>
    </header>
  `;

  container.querySelectorAll<HTMLButtonElement>('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const route = btn.dataset.nav as AppRoute | undefined;
      if (route) props.onNavigate(route);
    });
  });

  container
    .querySelector<HTMLButtonElement>('[data-action="toggle-mute"]')
    ?.addEventListener('click', () => props.onToggleMute());

  container
    .querySelector<HTMLButtonElement>('[data-action="quick-host"]')
    ?.addEventListener('click', () => props.onQuickHost());
}

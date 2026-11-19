export function renderFooter(
  container: HTMLElement,
  visitorFormatted: string
): void {
  container.innerHTML = `
    <footer class="border-t border-white/10 bg-[#080C18] px-4 py-6 sm:px-6">
      <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row">
        <p class="text-center text-xs sm:text-sm text-slate-300 leading-relaxed sm:text-left">
          🌎 💡 Creado y Desarrollado 💻🧠 Por El Equipo De “Super Agentes Darwin”• 💎 De AGENCIA DARWIN 🚀 •Todos Los Derechos Reservados 2026 © 2027 ✅
        </p>

        <div class="flex items-center gap-3 shrink-0 rounded-xl border border-amber-400/25 bg-[#121A30] px-4 py-2">
          <span class="text-xs font-medium text-slate-300">Contador de Visitas</span>
          <span
            data-testid="visitor-counter"
            class="font-mono-num text-base font-bold tracking-widest text-amber-300"
          >${visitorFormatted}</span>
        </div>
      </div>
    </footer>
  `;
}

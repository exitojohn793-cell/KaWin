import type { Quiz } from '../../shared/types.ts';
import { OPTION_META } from '../../shared/scoring.ts';
import { escapeHtml, renderOptionShapeSvg } from '../components/Shapes.ts';

export interface HomeViewProps {
  quizzes: Quiz[];
  onJoinPin: (pin: string) => void;
  onStartHost: (quizId: string) => void;
  onEditQuiz: (quizId: string) => void;
  onCreateNew: () => void;
  onOpenLibrary: () => void;
}

export function renderHomeView(
  container: HTMLElement,
  props: HomeViewProps
): void {
  const featured = props.quizzes.slice(0, 3);

  container.innerHTML = `
    <section class="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
      <div class="grid items-stretch gap-8 lg:grid-cols-12">
        <!-- Left Hero: Brand statement & Instant Join -->
        <div class="lg:col-span-7 min-w-0 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#131B31]/90 p-5 sm:p-10">
          <div>
            <p class="text-sm font-semibold tracking-wide text-amber-300">
              Show de Trivia en Tiempo Real · Clases, Empresas y Eventos
            </p>
            <h1 class="mt-3 font-display text-4xl font-extrabold tracking-tight text-white sm:text-5xl leading-[1.08]">
              Convierte cualquier pantalla en un show en vivo.
            </h1>
            <p class="mt-4 max-w-2xl text-base text-slate-300 leading-relaxed">
              Lanza cuestionarios multijugador al instante. Tu audiencia entra desde el móvil con PIN o código QR sin instalar nada, compite en vivo por rapidez y recibe ranking y podio en directo.
            </p>
          </div>

          <div class="mt-8 space-y-2">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <form data-form="home-pin" class="flex-1 min-w-0 flex flex-col gap-2">
                <label for="home-pin-input" class="text-xs font-semibold text-slate-300">
                  ¿Tienes un PIN de sala? Entra ahora
                </label>
                <div class="flex flex-row gap-2.5">
                  <input
                    id="home-pin-input"
                    name="pin"
                    type="text"
                    inputmode="numeric"
                    maxlength="6"
                    placeholder="PIN de 6 dígitos"
                    autocomplete="off"
                    class="font-mono-num h-12 w-full min-w-0 flex-1 rounded-xl border border-white/15 bg-[#0B1020] px-4 text-lg font-bold tracking-widest text-white placeholder:text-slate-500 placeholder:tracking-normal placeholder:font-sans"
                  />
                  <button
                    type="submit"
                    class="h-12 whitespace-nowrap shrink-0 rounded-xl bg-amber-400 px-5 font-bold text-slate-950 hover:bg-amber-300 transition-colors"
                  >
                    Unirse
                  </button>
                </div>
              </form>

              <div class="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  data-action="create-quiz"
                  class="h-12 whitespace-nowrap shrink-0 rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  + Crear Quiz
                </button>
                <button
                  type="button"
                  data-action="open-library"
                  class="h-12 whitespace-nowrap shrink-0 rounded-xl border border-blue-500/40 bg-blue-600/20 px-4 text-sm font-semibold text-blue-200 hover:bg-blue-600/30 transition-colors"
                >
                  Ver Biblioteca
                </button>
              </div>
            </div>
            <p data-error="home-pin" class="hidden text-xs font-medium text-rose-400"></p>
          </div>
        </div>

        <!-- Right Stage Preview: ULTRA TV PREMIUM Showcase -->
        <div class="lg:col-span-5 min-w-0 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#151F38] p-5 sm:p-8">
          <div class="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <p class="text-xs font-semibold text-amber-300">VISTA PREVIA EN DIRECTO</p>
              <h2 class="mt-0.5 font-display text-lg font-bold text-white">Tablero de Mando TV</h2>
            </div>
            <span class="font-mono-num text-xs font-bold text-slate-300">PIN · QR · PODIO</span>
          </div>

          <div class="my-6 space-y-4">
            <div class="rounded-xl border border-white/10 bg-[#0B1020]/80 p-4 text-center">
              <p class="text-xs text-slate-400">Ejemplo de pregunta en pantalla grande</p>
              <p class="mt-1.5 font-display text-lg font-bold text-white">
                ¿Listo para tu próximo reto en vivo?
              </p>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              ${OPTION_META.map(
                (opt, i) => `
                  <div
                    class="flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-sm font-bold text-white"
                    style="background-color: ${opt.bg};"
                  >
                    ${renderOptionShapeSvg(i, 'w-4 h-4 shrink-0')}
                    <span class="truncate">${
                      ['A · Rápido', 'B · Preciso', 'C · En Vivo', 'D · Gratis'][i]
                    }</span>
                  </div>
                `
              ).join('')}
            </div>
          </div>

          <div class="flex items-center justify-between gap-4 border-t border-white/10 pt-4 text-xs text-slate-300">
            <span>Sincronización WebSocket</span>
            <span class="font-mono-num text-amber-300">Sin límites ni muros de pago</span>
          </div>
        </div>
      </div>

      <!-- Featured Multi-Niche Quizzes -->
      <div class="mt-12">
        <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 class="font-display text-2xl font-bold text-white">
              Cuestionarios listos para presentar hoy
            </h2>
            <p class="mt-1 text-sm text-slate-400">
              Elige una plantilla multinicho, preséntala en 1 clic o personalízala en el editor.
            </p>
          </div>
          <button
            type="button"
            data-action="open-library"
            class="self-start sm:self-auto text-sm font-semibold text-amber-300 hover:text-amber-200 transition-colors whitespace-nowrap"
          >
            Explorar todos (${props.quizzes.length}) →
          </button>
        </div>

        <div class="mt-6 grid gap-5 md:grid-cols-3">
          ${featured
            .map(
              (quiz) => `
              <article class="min-w-0 flex flex-col justify-between rounded-2xl border border-white/10 bg-[#131B31] p-6 transition-transform duration-200 hover:-translate-y-0.5">
                <div>
                  <div class="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span>${escapeHtml(quiz.category)}</span>
                    <span class="font-mono-num tabular-nums">${quiz.questions.length} ${quiz.questions.length === 1 ? 'pregunta' : 'preguntas'}</span>
                  </div>
                  <h3 class="mt-2.5 font-display text-xl font-bold text-white leading-snug">
                    ${escapeHtml(quiz.title)}
                  </h3>
                  <p class="mt-2 text-sm text-slate-300 leading-relaxed line-clamp-2">
                    ${escapeHtml(quiz.description || 'Cuestionario interactivo listo para jugar en vivo.')}
                  </p>
                </div>

                <div class="mt-6 flex items-center gap-2.5 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    data-host-quiz="${escapeHtml(quiz.id)}"
                    class="flex-1 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap"
                  >
                    Presentar
                  </button>
                  <button
                    type="button"
                    data-edit-quiz="${escapeHtml(quiz.id)}"
                    class="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                  >
                    Editar
                  </button>
                </div>
              </article>
            `
            )
            .join('')}
        </div>
      </div>

      <!-- KaWin Improvements over legacy quiz software -->
      <div class="mt-12 rounded-2xl border border-white/10 bg-[#11182C] p-6 sm:p-8">
        <div class="grid gap-6 md:grid-cols-3">
          <div>
            <h3 class="font-display text-base font-bold text-white">1. Jugadores y preguntas sin tope</h3>
            <p class="mt-1.5 text-sm text-slate-300 leading-relaxed">
              A diferencia de otras plataformas que cobran por superar 10 o 40 participantes, en KaWin toda la clase, empresa o evento entra sin suscripciones ni registros.
            </p>
          </div>
          <div>
            <h3 class="font-display text-base font-bold text-white">2. Informes CSV y JSON al instante</h3>
            <p class="mt-1.5 text-sm text-slate-300 leading-relaxed">
              Al cerrar el podio final descargas en 1 clic la tabla de puntuaciones, tiempos de respuesta y porcentaje de acierto pregunta por pregunta.
            </p>
          </div>
          <div>
            <h3 class="font-display text-base font-bold text-white">3. Reacciones en vivo y Audio Studio</h3>
            <p class="mt-1.5 text-sm text-slate-300 leading-relaxed">
              El público reacciona en directo sobre la pantalla principal mientras el motor de sonido sintetizado acompaña cada ronda y el podio.
            </p>
          </div>
        </div>
      </div>
    </section>
  `;

  const pinForm = container.querySelector<HTMLFormElement>('[data-form="home-pin"]');
  const pinInput = container.querySelector<HTMLInputElement>('#home-pin-input');
  const pinError = container.querySelector<HTMLElement>('[data-error="home-pin"]');

  pinForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const clean = (pinInput?.value ?? '').replace(/\D/g, '').trim();
    if (clean.length !== 6) {
      if (pinError) {
        pinError.textContent = 'Ingresa un PIN válido de 6 dígitos.';
        pinError.classList.remove('hidden');
      }
      pinInput?.focus();
      return;
    }
    props.onJoinPin(clean);
  });

  container.querySelectorAll<HTMLButtonElement>('[data-action="create-quiz"]').forEach((btn) => {
    btn.addEventListener('click', () => props.onCreateNew());
  });

  container.querySelectorAll<HTMLButtonElement>('[data-action="open-library"]').forEach((btn) => {
    btn.addEventListener('click', () => props.onOpenLibrary());
  });

  container.querySelectorAll<HTMLButtonElement>('[data-host-quiz]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.hostQuiz;
      if (id) props.onStartHost(id);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-edit-quiz]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editQuiz;
      if (id) props.onEditQuiz(id);
    });
  });
}

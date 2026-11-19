import type { Quiz, QuizCategory } from '../../shared/types.ts';
import { escapeHtml } from '../components/Shapes.ts';

export interface LibraryViewProps {
  quizzes: Quiz[];
  onStartHost: (quizId: string) => void;
  onPracticeQuiz: (quizId: string) => void;
  onEditQuiz: (quizId: string) => void;
  onDuplicateQuiz: (quiz: Quiz) => void;
  onDeleteQuiz: (quizId: string) => void;
  onCreateNew: () => void;
  onImportJson: (rawJson: string) => void;
}

const CATEGORIES: Array<'Todos' | QuizCategory> = [
  'Todos',
  'Educación',
  'Empresas',
  'Eventos',
  'General',
];

export function renderLibraryView(
  container: HTMLElement,
  props: LibraryViewProps,
  state: { category: 'Todos' | QuizCategory; search: string; pendingDeleteId: string | null }
): void {
  const query = state.search.trim().toLowerCase();
  const filtered = props.quizzes.filter((q) => {
    const matchCat = state.category === 'Todos' || q.category === state.category;
    const matchText =
      !query ||
      q.title.toLowerCase().includes(query) ||
      q.description.toLowerCase().includes(query);
    return matchCat && matchText;
  });

  container.innerHTML = `
    <section class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="font-display text-3xl font-extrabold text-white">Biblioteca de Cuestionarios</h1>
          <p class="mt-1 text-sm text-slate-300">
            Guarda, reutiliza, duplica o exporta tus cuestionarios para clases, equipos y eventos.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <label class="cursor-pointer rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap">
            Importar JSON
            <input type="file" accept="application/json,.json" data-input="import-json" class="sr-only" />
          </label>
          <button
            type="button"
            data-action="new-quiz"
            class="rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap"
          >
            + Nuevo Cuestionario
          </button>
        </div>
      </div>

      <!-- Filter Bar -->
      <div class="mt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="flex flex-wrap items-center gap-1 rounded-xl bg-[#131B31] p-1 border border-white/10">
          ${CATEGORIES.map((cat) => {
            const active = state.category === cat;
            return `
              <button
                type="button"
                data-filter-cat="${cat}"
                class="rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }"
              >
                ${cat}
              </button>
            `;
          }).join('')}
        </div>

        <div class="w-full md:w-72">
          <label for="library-search" class="sr-only">Buscar cuestionarios</label>
          <input
            id="library-search"
            type="search"
            value="${escapeHtml(state.search)}"
            placeholder="Buscar por título o tema..."
            class="h-10 w-full rounded-xl border border-white/15 bg-[#131B31] px-3.5 text-sm text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      ${
        filtered.length === 0
          ? `
            <div class="mt-10 rounded-2xl border border-white/10 bg-[#131B31] p-10 text-center">
              <p class="font-display text-lg font-bold text-white">No hay cuestionarios que coincidan</p>
              <p class="mt-1 text-sm text-slate-400">Prueba cambiando el filtro o crea un cuestionario nuevo desde cero.</p>
              <button
                type="button"
                data-action="new-quiz"
                class="mt-5 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors"
              >
                Crear Cuestionario
              </button>
            </div>
          `
          : `
            <div class="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              ${filtered
                .map((quiz) => {
                  const isDeleting = state.pendingDeleteId === quiz.id;
                  return `
                    <article class="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#131B31] p-6">
                      <div>
                        <div class="flex items-center justify-between gap-2 text-xs text-slate-400">
                          <span>${escapeHtml(quiz.category)}</span>
                          <span class="font-mono-num">${quiz.questions.length} ${quiz.questions.length === 1 ? 'pregunta' : 'preguntas'}</span>
                        </div>
                        <h2 class="mt-2 font-display text-xl font-bold text-white leading-snug">
                          ${escapeHtml(quiz.title)}
                        </h2>
                        <p class="mt-2 text-sm text-slate-300 leading-relaxed">
                          ${escapeHtml(quiz.description || 'Sin descripción adicional.')}
                        </p>
                      </div>

                      <div class="mt-6 space-y-2.5 border-t border-white/10 pt-4">
                        <div class="flex items-center gap-2">
                          <button
                            type="button"
                            data-host-id="${escapeHtml(quiz.id)}"
                            class="flex-1 rounded-xl bg-amber-400 px-3.5 py-2.5 text-sm font-bold text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap"
                          >
                            Presentar
                          </button>
                          <button
                            type="button"
                            data-practice-id="${escapeHtml(quiz.id)}"
                            class="rounded-xl border border-blue-400/40 bg-blue-600/20 px-3.5 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-600/30 transition-colors whitespace-nowrap"
                          >
                            Practicar
                          </button>
                          <button
                            type="button"
                            data-edit-id="${escapeHtml(quiz.id)}"
                            class="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors whitespace-nowrap"
                          >
                            Editar
                          </button>
                        </div>

                        <div class="flex items-center justify-between text-xs text-slate-400">
                          <div class="flex items-center gap-3">
                            <button type="button" data-dup-id="${escapeHtml(quiz.id)}" class="hover:text-white transition-colors">
                              Duplicar
                            </button>
                            <button type="button" data-export-id="${escapeHtml(quiz.id)}" class="hover:text-white transition-colors">
                              Exportar JSON
                            </button>
                          </div>

                          ${
                            isDeleting
                              ? `
                                <div class="flex items-center gap-2">
                                  <button type="button" data-confirm-delete="${escapeHtml(quiz.id)}" class="font-bold text-rose-400 hover:text-rose-300">
                                    Confirmar
                                  </button>
                                  <button type="button" data-cancel-delete class="text-slate-400 hover:text-white">
                                    Cancelar
                                  </button>
                                </div>
                              `
                              : `
                                <button type="button" data-ask-delete="${escapeHtml(quiz.id)}" class="text-rose-400/80 hover:text-rose-300 transition-colors">
                                  Eliminar
                                </button>
                              `
                          }
                        </div>
                      </div>
                    </article>
                  `;
                })
                .join('')}
            </div>
          `
      }
    </section>
  `;

  container.querySelectorAll<HTMLButtonElement>('[data-action="new-quiz"]').forEach((btn) => {
    btn.addEventListener('click', () => props.onCreateNew());
  });

  container.querySelectorAll<HTMLButtonElement>('[data-filter-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.category = (btn.dataset.filterCat as 'Todos' | QuizCategory) ?? 'Todos';
      renderLibraryView(container, props, state);
    });
  });

  const searchInput = container.querySelector<HTMLInputElement>('#library-search');
  searchInput?.addEventListener('input', () => {
    state.search = searchInput.value;
    renderLibraryView(container, props, state);
    const nextInput = container.querySelector<HTMLInputElement>('#library-search');
    if (nextInput) {
      nextInput.focus();
      nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
    }
  });

  container.querySelector<HTMLInputElement>('[data-input="import-json"]')?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      props.onImportJson(String(reader.result ?? ''));
    };
    reader.readAsText(file);
  });

  container.querySelectorAll<HTMLButtonElement>('[data-host-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.hostId) props.onStartHost(btn.dataset.hostId);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-practice-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.practiceId) props.onPracticeQuiz(btn.dataset.practiceId);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-edit-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.editId) props.onEditQuiz(btn.dataset.editId);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-dup-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const quiz = props.quizzes.find((q) => q.id === btn.dataset.dupId);
      if (quiz) props.onDuplicateQuiz(quiz);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-export-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const quiz = props.quizzes.find((q) => q.id === btn.dataset.exportId);
      if (!quiz) return;
      const blob = new Blob([JSON.stringify(quiz, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${quiz.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'kawin-quiz'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-ask-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.pendingDeleteId = btn.dataset.askDelete ?? null;
      renderLibraryView(container, props, state);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-cancel-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.pendingDeleteId = null;
      renderLibraryView(container, props, state);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-confirm-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.confirmDelete) {
        state.pendingDeleteId = null;
        props.onDeleteQuiz(btn.dataset.confirmDelete);
      }
    });
  });
}

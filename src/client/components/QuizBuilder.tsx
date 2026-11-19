import React, { useSyncExternalStore } from 'react';
import { OPTION_META } from '../../shared/scoring.ts';
import type { PointsMode, QuizCategory } from '../../shared/types.ts';
import { appStore, createEmptyQuestion } from '../store.ts';
import { OptionShape } from './OptionShape.tsx';

const TIME_OPTIONS = [10, 15, 20, 30, 45, 60, 90] as const;
const CATEGORIES: QuizCategory[] = ['General', 'Educación', 'Empresas', 'Eventos'];

export const QuizBuilder: React.FC = () => {
  const state = useSyncExternalStore(appStore.subscribe, appStore.getState);
  const draft = state.editorDraft;
  const current = draft.questions[draft.selectedIndex] ?? draft.questions[0];

  const updateCurrentQuestion = (
    updater: (q: (typeof draft.questions)[number]) => (typeof draft.questions)[number]
  ) => {
    appStore.updateEditorDraft((prev) => {
      const idx = prev.selectedIndex;
      const nextQuestions = prev.questions.map((item, i) =>
        i === idx ? updater(item) : item
      );
      return { ...prev, questions: nextQuestions };
    });
  };

  const handleAddQuestion = () => {
    appStore.updateEditorDraft((prev) => {
      const nextQuestions = [
        ...prev.questions,
        createEmptyQuestion(prev.questions.length + 1),
      ];
      return {
        ...prev,
        questions: nextQuestions,
        selectedIndex: nextQuestions.length - 1,
      };
    });
  };

  const handleDuplicateQuestion = (idx: number) => {
    appStore.updateEditorDraft((prev) => {
      const clone = structuredClone(prev.questions[idx]);
      clone.id = `q_${Date.now().toString(36)}_${prev.questions.length + 1}`;
      const nextQuestions = [...prev.questions];
      nextQuestions.splice(idx + 1, 0, clone);
      return {
        ...prev,
        questions: nextQuestions,
        selectedIndex: idx + 1,
      };
    });
  };

  const handleDeleteQuestion = (idx: number) => {
    appStore.updateEditorDraft((prev) => {
      if (prev.questions.length <= 1) return prev;
      const nextQuestions = prev.questions.filter((_, i) => i !== idx);
      return {
        ...prev,
        questions: nextQuestions,
        selectedIndex: Math.min(prev.selectedIndex, nextQuestions.length - 1),
      };
    });
  };

  const handleMoveQuestion = (idx: number, direction: -1 | 1) => {
    appStore.updateEditorDraft((prev) => {
      const target = idx + direction;
      if (target < 0 || target >= prev.questions.length) return prev;
      const nextQuestions = [...prev.questions];
      const [item] = nextQuestions.splice(idx, 1);
      nextQuestions.splice(target, 0, item);
      return {
        ...prev,
        questions: nextQuestions,
        selectedIndex: target,
      };
    });
  };

  return (
    <section
      data-testid="quiz-builder"
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6"
    >
      <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
            {draft.id ? 'Editar Cuestionario' : 'Estudio de Creación KaWin'}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Añade preguntas, configura 4 opciones por color y forma, marca la correcta y define el tiempo límite.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            data-action="cancel-edit"
            onClick={() => appStore.setRoute('library')}
            className="whitespace-nowrap rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
          >
            Cancelar
          </button>
          <button
            type="button"
            data-action="save-only"
            disabled={draft.saving}
            onClick={() => void appStore.saveQuizFromBuilder(false)}
            className="whitespace-nowrap rounded-xl border border-amber-400/50 bg-amber-400/15 px-4 py-2.5 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-400/25 disabled:opacity-50"
          >
            {draft.saving ? 'Guardando...' : 'Guardar en Biblioteca'}
          </button>
          <button
            type="button"
            data-action="save-and-play"
            disabled={draft.saving}
            onClick={() => void appStore.saveQuizFromBuilder(true)}
            className="whitespace-nowrap rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 disabled:opacity-50"
          >
            Guardar y Presentar
          </button>
        </div>
      </div>

      {draft.errors.length > 0 && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-200"
        >
          <p className="font-bold">Revisa estos campos antes de guardar:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {draft.errors.map((err, idx) => (
              <li key={idx}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 rounded-2xl border border-white/10 bg-[#131B31] p-5 md:grid-cols-12">
        <div className="md:col-span-5">
          <label
            htmlFor="editor-title"
            className="block text-xs font-semibold text-slate-300"
          >
            Título del Cuestionario
          </label>
          <input
            id="editor-title"
            type="text"
            value={draft.title}
            onChange={(e) =>
              appStore.updateEditorDraft((prev) => ({
                ...prev,
                title: e.target.value,
              }))
            }
            placeholder="Ej. Trivia Corporativa Q4 / Historia Universal"
            className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#0B1020] px-3.5 text-sm font-semibold text-white placeholder:text-slate-500"
          />
        </div>

        <div className="md:col-span-4">
          <label
            htmlFor="editor-desc"
            className="block text-xs font-semibold text-slate-300"
          >
            Descripción breve (opcional)
          </label>
          <input
            id="editor-desc"
            type="text"
            value={draft.description}
            onChange={(e) =>
              appStore.updateEditorDraft((prev) => ({
                ...prev,
                description: e.target.value,
              }))
            }
            placeholder="Ideal para clases, onboarding o eventos..."
            className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#0B1020] px-3.5 text-sm text-white placeholder:text-slate-500"
          />
        </div>

        <div className="md:col-span-3">
          <label
            htmlFor="editor-category"
            className="block text-xs font-semibold text-slate-300"
          >
            Categoría
          </label>
          <select
            id="editor-category"
            value={draft.category}
            onChange={(e) =>
              appStore.updateEditorDraft((prev) => ({
                ...prev,
                category: e.target.value as QuizCategory,
              }))
            }
            className="mt-1.5 h-11 w-full rounded-xl border border-white/15 bg-[#0B1020] px-3 text-sm font-semibold text-white"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-12">
        <aside className="space-y-3 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-white">
              Preguntas ({draft.questions.length})
            </h2>
            <button
              type="button"
              data-action="add-question"
              onClick={handleAddQuestion}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-500"
            >
              + Añadir Pregunta
            </button>
          </div>

          <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
            {draft.questions.map((q, idx) => {
              const isSelected = idx === draft.selectedIndex;
              return (
                <div
                  key={q.id}
                  className={`rounded-xl border p-3 transition-colors ${
                    isSelected
                      ? 'border-amber-400 bg-[#1A2542]'
                      : 'border-white/10 bg-[#131B31]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      data-select-q={idx}
                      onClick={() =>
                        appStore.updateEditorDraft((prev) => ({
                          ...prev,
                          selectedIndex: idx,
                        }))
                      }
                      className="flex-1 text-left"
                    >
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-mono-num font-bold text-amber-300">
                          #{idx + 1}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-num">{q.timeLimitSec}s</span>
                        {q.pointsMode === 'double' && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>Doble</span>
                          </>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold text-white">
                        {q.prompt || 'Pregunta sin enunciado'}
                      </p>
                    </button>

                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        type="button"
                        data-move-up={idx}
                        aria-label={`Subir pregunta ${idx + 1}`}
                        disabled={idx === 0}
                        onClick={() => handleMoveQuestion(idx, -1)}
                        className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        data-move-down={idx}
                        aria-label={`Bajar pregunta ${idx + 1}`}
                        disabled={idx === draft.questions.length - 1}
                        onClick={() => handleMoveQuestion(idx, 1)}
                        className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-end gap-3 border-t border-white/10 pt-2 text-xs">
                    <button
                      type="button"
                      data-dup-q={idx}
                      onClick={() => handleDuplicateQuestion(idx)}
                      className="text-slate-400 transition-colors hover:text-white"
                    >
                      Duplicar
                    </button>
                    <button
                      type="button"
                      data-del-q={idx}
                      disabled={draft.questions.length <= 1}
                      onClick={() => handleDeleteQuestion(idx)}
                      className="text-rose-400 transition-colors hover:text-rose-300 disabled:opacity-30"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="rounded-2xl border border-white/10 bg-[#131B31] p-6 lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <h2 className="font-display text-lg font-bold text-white">
              Pregunta {draft.selectedIndex + 1} de {draft.questions.length}
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="q-time"
                  className="text-xs font-semibold text-slate-300"
                >
                  Tiempo
                </label>
                <select
                  id="q-time"
                  value={current.timeLimitSec}
                  onChange={(e) => {
                    const nextTime = Number(e.target.value) || 20;
                    updateCurrentQuestion((q) => ({
                      ...q,
                      timeLimitSec: nextTime,
                    }));
                  }}
                  className="h-9 rounded-lg border border-white/15 bg-[#0B1020] px-2.5 font-mono-num text-xs font-bold text-white"
                >
                  {TIME_OPTIONS.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec} seg
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label
                  htmlFor="q-points"
                  className="text-xs font-semibold text-slate-300"
                >
                  Puntos
                </label>
                <select
                  id="q-points"
                  value={current.pointsMode}
                  onChange={(e) => {
                    const nextMode = e.target.value as PointsMode;
                    updateCurrentQuestion((q) => ({
                      ...q,
                      pointsMode: nextMode,
                    }));
                  }}
                  className="h-9 rounded-lg border border-white/15 bg-[#0B1020] px-2.5 text-xs font-bold text-white"
                >
                  <option value="standard">Estándar (1000)</option>
                  <option value="double">Doble (2000)</option>
                  <option value="none">Sin puntos (Encuesta)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <label
              htmlFor="q-prompt"
              className="block text-xs font-semibold text-slate-300"
            >
              Enunciado de la pregunta
            </label>
            <textarea
              id="q-prompt"
              rows={3}
              value={current.prompt}
              onChange={(e) => {
                const value = e.target.value;
                updateCurrentQuestion((q) => ({ ...q, prompt: value }));
              }}
              placeholder="Escribe aquí la pregunta que aparecerá en la pantalla principal..."
              className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#0B1020] p-4 font-display text-lg font-bold text-white placeholder:text-slate-500"
            />
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-300">
              Opciones de respuesta (marca la respuesta correcta)
            </p>
            <div className="mt-3 grid gap-3.5 sm:grid-cols-2">
              {OPTION_META.map((opt, idx) => {
                const isCorrect = current.correctIndex === idx;
                return (
                  <div
                    key={opt.letter}
                    className={`rounded-xl p-3.5 transition-all ${
                      isCorrect ? 'ring-2 ring-white shadow-lg' : 'opacity-95'
                    }`}
                    style={{ backgroundColor: opt.bg }}
                  >
                    <div className="flex items-center justify-between gap-2 text-white">
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <OptionShape index={idx} className="h-4 w-4" />
                        <span>Opción {opt.letter}</span>
                      </div>

                      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-black/25 px-2.5 py-1 text-xs font-bold">
                        <input
                          type="radio"
                          name={`correct-option-${current.id}`}
                          value={idx}
                          data-correct-idx={idx}
                          checked={isCorrect}
                          onChange={() =>
                            updateCurrentQuestion((q) => ({
                              ...q,
                              correctIndex: idx,
                            }))
                          }
                          className="h-4 w-4 accent-white"
                        />
                        <span>{isCorrect ? 'Correcta' : 'Marcar'}</span>
                      </label>
                    </div>

                    <label htmlFor={`q-opt-${idx}`} className="sr-only">
                      Texto de opción {opt.letter}
                    </label>
                    <input
                      id={`q-opt-${idx}`}
                      type="text"
                      data-opt-idx={idx}
                      value={current.options[idx] ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        updateCurrentQuestion((q) => {
                          const nextOpts: [string, string, string, string] = [
                            ...q.options,
                          ] as [string, string, string, string];
                          nextOpts[idx] = value;
                          return { ...q, options: nextOpts };
                        });
                      }}
                      placeholder={`Escribe la opción ${opt.letter}...`}
                      className="mt-2.5 h-11 w-full rounded-lg border border-white/25 bg-black/25 px-3 text-sm font-semibold text-white placeholder:text-white/60"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

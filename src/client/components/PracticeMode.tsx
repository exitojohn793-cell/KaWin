import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { OPTION_META } from '../../shared/scoring.ts';
import { studioAudio } from '../audio.ts';
import { shouldTriggerUrgentTick } from '../audioCues.ts';
import { appStore } from '../store.ts';
import { OptionShape } from './OptionShape.tsx';

export const PracticeMode: React.FC = () => {
  const state = useSyncExternalStore(appStore.subscribe, appStore.getState);
  const { quizzes, practiceSession } = state;

  const [timerState, setTimerState] = useState<{
    secondsLeft: number;
    percentLeft: number;
  }>({ secondsLeft: 0, percentLeft: 100 });
  const lastUrgentTickRef = useRef<number | null>(null);

  useEffect(() => {
    lastUrgentTickRef.current = null;
    if (!practiceSession || practiceSession.phase !== 'PLAYING') {
      return;
    }

    const started = practiceSession.questionStartedAt;
    const ends = practiceSession.questionEndsAt;
    const total = Math.max(1000, ends - started);

    const tick = () => {
      const remainingMs = Math.max(0, ends - Date.now());
      const percentLeft = Math.max(0, Math.min(100, (remainingMs / total) * 100));
      const secondsLeft = Math.ceil(remainingMs / 1000);
      setTimerState({ secondsLeft, percentLeft });

      if (shouldTriggerUrgentTick(secondsLeft, lastUrgentTickRef.current)) {
        lastUrgentTickRef.current = secondsLeft;
        studioAudio.playTimeRunningOut(secondsLeft);
      }

      if (remainingMs <= 0) {
        appStore.timeoutPractice();
      }
    };

    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [
    practiceSession?.phase,
    practiceSession?.questionIndex,
    practiceSession?.questionStartedAt,
    practiceSession?.questionEndsAt,
  ]);

  if (!practiceSession) {
    return (
      <section
        data-testid="practice-picker"
        className="mx-auto max-w-6xl px-4 py-10 sm:px-6"
      >
        <div className="rounded-2xl border border-white/10 bg-[#131B31] p-6 sm:p-8">
          <p className="text-xs font-bold tracking-wider text-amber-300">
            MODO PRÁCTICA INDIVIDUAL
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-white">
            Entrena a tu ritmo contra el reloj
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-300">
            Elige cualquier cuestionario para jugar en solitario con temporizador real, bonus por rapidez, rachas y resumen final sin necesidad de presentador ni sala en vivo.
          </p>

          {quizzes.length === 0 ? (
            <div className="mt-8 rounded-xl border border-dashed border-white/15 bg-[#0B1020]/60 p-8 text-center">
              <p className="text-sm text-slate-300">
                Aún no hay cuestionarios disponibles. Crea uno en el estudio para practicar.
              </p>
              <button
                type="button"
                onClick={() => appStore.openEditorForQuiz()}
                className="mt-4 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300"
              >
                + Crear Cuestionario
              </button>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {quizzes.map((quiz) => {
                const totalSec = quiz.questions.reduce(
                  (acc, q) => acc + q.timeLimitSec,
                  0
                );
                return (
                  <article
                    key={quiz.id}
                    className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#0B1020] p-5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span>{quiz.category}</span>
                        <span className="font-mono-num">
                          {quiz.questions.length}{' '}
                          {quiz.questions.length === 1 ? 'pregunta' : 'preguntas'}{' '}
                          · ~{totalSec}s
                        </span>
                      </div>
                      <h2 className="mt-2 font-display text-lg font-bold text-white">
                        {quiz.title}
                      </h2>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
                        {quiz.description || 'Cuestionario cronometrado listo para practicar.'}
                      </p>
                    </div>

                    <button
                      type="button"
                      data-start-practice={quiz.id}
                      onClick={() => appStore.startPractice(quiz.id)}
                      className="mt-5 h-11 w-full rounded-xl bg-blue-600 text-sm font-bold text-white transition-colors hover:bg-blue-500"
                    >
                      Comenzar Práctica
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  const { quiz, phase, questionIndex, totalScore, streak, bestStreak, correctCount, records } =
    practiceSession;
  const currentQ = quiz.questions[questionIndex];

  if (phase === 'PLAYING' && currentQ) {
    const displaySeconds =
      timerState.secondsLeft > 0 ? timerState.secondsLeft : currentQ.timeLimitSec;

    return (
      <section
        data-testid="practice-playing"
        className="mx-auto max-w-4xl px-4 py-8 sm:px-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-300">
            <span className="font-mono-num text-amber-300">
              Pregunta {questionIndex + 1} de {quiz.questions.length}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{totalScore} pts</span>
            {streak >= 2 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-bold text-amber-300">🔥 Racha {streak}</span>
              </>
            )}
          </div>

          <button
            type="button"
            data-action="exit-practice"
            onClick={() => appStore.exitPractice()}
            className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Salir de Práctica
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-[#131B31] ${
              displaySeconds <= 5 ? 'border-rose-400/70' : 'border-amber-400/40'
            }`}
          >
            <span
              data-testid="practice-timer"
              className={`font-mono-num text-2xl font-extrabold ${
                displaySeconds <= 5 ? 'text-rose-300' : 'text-amber-300'
              }`}
            >
              {displaySeconds}
            </span>
          </div>
          <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full transition-[width] duration-100 ${
                displaySeconds <= 5 ? 'bg-rose-500' : 'bg-amber-400'
              }`}
              style={{ width: `${timerState.percentLeft}%` }}
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-[#131B31] p-7 text-center sm:p-10">
          {currentQ.pointsMode === 'double' && (
            <p className="mb-2 text-xs font-bold tracking-wider text-amber-300">
              RONDA DOBLE (2000 PTS BASE)
            </p>
          )}
          <h1 className="font-display text-2xl font-extrabold leading-tight text-white sm:text-3xl">
            {currentQ.prompt}
          </h1>
        </div>

        <div className="mt-6 grid gap-3.5 sm:grid-cols-2">
          {OPTION_META.map((opt, idx) => (
            <button
              key={opt.letter}
              type="button"
              data-practice-opt={idx}
              onClick={() => appStore.answerPractice(idx)}
              className="flex min-h-[96px] items-center gap-4 rounded-2xl px-5 py-4 text-left text-white shadow-lg transition-transform hover:brightness-110 active:scale-[0.98]"
              style={{ backgroundColor: opt.bg }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/25">
                <OptionShape index={idx} className="h-6 w-6" />
              </span>
              <span className="font-display text-lg font-bold leading-snug">
                {currentQ.options[idx] ?? ''}
              </span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (phase === 'FEEDBACK' && currentQ) {
    const latest = records[records.length - 1];
    const isCorrect = Boolean(latest?.isCorrect);
    const isLast = questionIndex >= quiz.questions.length - 1;

    return (
      <section
        data-testid="practice-feedback"
        className="mx-auto max-w-3xl px-4 py-8 sm:px-6"
      >
        <div
          className={`rounded-2xl border p-7 text-center ${
            isCorrect
              ? 'border-emerald-400/40 bg-emerald-950/40'
              : 'border-rose-500/40 bg-rose-950/35'
          }`}
        >
          <p className="text-xs font-bold tracking-wider text-slate-300">
            PREGUNTA {questionIndex + 1} DE {quiz.questions.length}
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold text-white">
            {isCorrect
              ? '¡Respuesta Correcta!'
              : latest?.timedOut
                ? 'Tiempo Agotado'
                : 'Respuesta Incorrecta'}
          </h1>
          <p
            className={`mt-2 font-mono-num text-2xl font-bold ${
              isCorrect ? 'text-emerald-300' : 'text-slate-300'
            }`}
          >
            +{latest?.pointsEarned ?? 0} pts
          </p>
          {latest && isCorrect && (
            <p className="mt-1 font-mono-num text-xs text-slate-300">
              Base: +{latest.breakdown.basePoints} · Rapidez: +
              {latest.breakdown.speedBonusPoints}
              {latest.breakdown.streakBonusPoints > 0
                ? ` · Racha: +${latest.breakdown.streakBonusPoints}`
                : ''}{' '}
              ({(latest.responseTimeMs / 1000).toFixed(2)}s)
            </p>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {OPTION_META.map((opt, idx) => {
            const correctOption = idx === currentQ.correctIndex;
            const userSelected = idx === latest?.selectedIndex;
            return (
              <div
                key={opt.letter}
                className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-white ${
                  correctOption ? 'ring-3 ring-white shadow-lg' : 'opacity-45'
                }`}
                style={{ backgroundColor: opt.bg }}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/25">
                    <OptionShape index={idx} className="h-5 w-5" />
                  </span>
                  <span className="font-display text-base font-bold">
                    {currentQ.options[idx]}
                  </span>
                </div>
                {correctOption ? (
                  <span className="shrink-0 rounded-lg bg-white px-2.5 py-1 text-xs font-extrabold text-slate-950">
                    CORRECTA
                  </span>
                ) : userSelected ? (
                  <span className="shrink-0 rounded-lg bg-black/50 px-2.5 py-1 text-xs font-bold text-white">
                    TU ELECCIÓN
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="font-mono-num text-sm font-bold text-slate-300">
            Acumulado: <span className="text-amber-300">{totalScore} pts</span>
          </div>
          <button
            type="button"
            data-action="practice-next"
            onClick={() => appStore.advancePractice()}
            className="h-12 rounded-xl bg-amber-400 px-7 font-display text-base font-extrabold text-slate-950 transition-colors hover:bg-amber-300"
          >
            {isLast ? 'Ver Resumen Final →' : 'Siguiente Pregunta →'}
          </button>
        </div>
      </section>
    );
  }

  // SUMMARY
  const accuracy =
    quiz.questions.length > 0
      ? Math.round((correctCount / quiz.questions.length) * 100)
      : 0;
  const avgMs =
    records.length > 0
      ? records.reduce((sum, r) => sum + r.responseTimeMs, 0) / records.length
      : 0;

  return (
    <section
      data-testid="practice-summary"
      className="mx-auto max-w-4xl px-4 py-10 sm:px-6"
    >
      <div className="rounded-2xl border border-amber-400/35 bg-[#131B31] p-7 text-center sm:p-10">
        <p className="text-xs font-bold tracking-wider text-amber-300">
          PRÁCTICA COMPLETADA · {quiz.title}
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold text-white">
          Resultado Final
        </h1>
        <p className="mt-3 font-mono-num text-5xl font-extrabold text-amber-300">
          {totalScore} pts
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-[#0B1020] p-4">
            <p className="text-xs text-slate-400">Precisión</p>
            <p className="mt-1 font-mono-num text-2xl font-bold text-emerald-300">
              {correctCount}/{quiz.questions.length} ({accuracy}%)
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0B1020] p-4">
            <p className="text-xs text-slate-400">Mejor Racha</p>
            <p className="mt-1 font-mono-num text-2xl font-bold text-white">
              🔥 {bestStreak}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-[#0B1020] p-4">
            <p className="text-xs text-slate-400">Tiempo Medio</p>
            <p className="mt-1 font-mono-num text-2xl font-bold text-white">
              {(avgMs / 1000).toFixed(2)}s
            </p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            data-action="practice-retry"
            onClick={() => appStore.startPractice(quiz.id)}
            className="h-11 rounded-xl bg-amber-400 px-6 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300"
          >
            Practicar de Nuevo
          </button>
          <button
            type="button"
            data-action="practice-choose"
            onClick={() => appStore.exitPractice()}
            className="h-11 rounded-xl border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            Elegir Otro Cuestionario
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-white/10 bg-[#131B31] p-6">
        <h2 className="font-display text-lg font-bold text-white">
          Revisión Pregunta por Pregunta
        </h2>
        <div className="mt-4 space-y-3">
          {records.map((rec) => (
            <div
              key={rec.questionIndex}
              className="flex flex-col justify-between gap-3 rounded-xl border border-white/10 bg-[#0B1020] p-4 sm:flex-row sm:items-center"
            >
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="font-mono-num">Pregunta {rec.questionIndex + 1}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">
                    {(rec.responseTimeMs / 1000).toFixed(2)}s
                  </span>
                </div>
                <p className="mt-1 text-sm font-semibold text-white">
                  {rec.prompt}
                </p>
                <p className="mt-1 text-xs text-slate-300">
                  Correcta:{' '}
                  <span className="font-semibold text-emerald-300">
                    {rec.options[rec.correctIndex]}
                  </span>
                  {!rec.isCorrect && rec.selectedIndex !== null && (
                    <>
                      {' '}
                      · Tu respuesta:{' '}
                      <span className="text-rose-300">
                        {rec.options[rec.selectedIndex]}
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="shrink-0 font-mono-num text-sm font-bold">
                {rec.isCorrect ? (
                  <span className="text-emerald-300">+{rec.pointsEarned} pts</span>
                ) : rec.timedOut ? (
                  <span className="text-rose-300">Tiempo agotado</span>
                ) : (
                  <span className="text-rose-300">0 pts</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

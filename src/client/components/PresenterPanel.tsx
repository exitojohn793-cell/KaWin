import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { OPTION_META, buildResultsCsv } from '../../shared/scoring.ts';
import type { Room } from '../../shared/types.ts';
import { studioAudio } from '../audio.ts';
import { shouldTriggerUrgentTick } from '../audioCues.ts';
import { appStore } from '../store.ts';
import { OptionShape } from './OptionShape.tsx';
import { QRCodeCard } from './QRCodeCard.tsx';

const CONFETTI_COLORS = ['#F59E0B', '#38BDF8', '#E11D48', '#10B981'] as const;

export const PresenterPanel: React.FC = () => {
  const state = useSyncExternalStore(appStore.subscribe, appStore.getState);
  const { hostSession, quizzes, hostReactions } = state;
  const room = hostSession.roomState;

  const [timerState, setTimerState] = useState<{
    secondsLeft: number;
    percentLeft: number;
  }>({ secondsLeft: 0, percentLeft: 100 });
  const lastUrgentTickRef = useRef<number | null>(null);

  useEffect(() => {
    lastUrgentTickRef.current = null;
    if (!room || room.phase !== 'QUESTION' || !room.questionEndsAt || !room.questionStartedAt) {
      return;
    }

    const started = room.questionStartedAt;
    const ends = room.questionEndsAt;
    const offset = Date.now() - room.serverTime;
    const total = Math.max(1000, ends - started);

    const tick = () => {
      const nowServer = Date.now() - offset;
      const remainingMs = Math.max(0, ends - nowServer);
      const percentLeft = Math.max(0, Math.min(100, (remainingMs / total) * 100));
      const secondsLeft = Math.ceil(remainingMs / 1000);
      setTimerState({ secondsLeft, percentLeft });
      if (shouldTriggerUrgentTick(secondsLeft, lastUrgentTickRef.current)) {
        lastUrgentTickRef.current = secondsLeft;
        studioAudio.playTimeRunningOut(secondsLeft);
      }
    };

    tick();
    const interval = window.setInterval(tick, 100);
    return () => window.clearInterval(interval);
  }, [
    room?.phase,
    room?.questionIndex,
    room?.questionStartedAt,
    room?.questionEndsAt,
    room?.serverTime,
  ]);

  const [dashboardTab, setDashboardTab] = useState<'launch' | 'history'>('launch');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const { matchHistory } = state;

  if (!room) {
    const selectedMatch =
      matchHistory.find((m) => m.id === expandedMatchId) ??
      matchHistory[0] ??
      null;

    const exportHistoryCsv = (record: (typeof matchHistory)[number]) => {
      const csv = buildResultsCsv(
        record.quizTitle,
        record.pin,
        record.players,
        record.questionStats
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kawin-historial-${record.pin}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    const exportHistoryJson = (record: (typeof matchHistory)[number]) => {
      const blob = new Blob([JSON.stringify(record, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kawin-historial-${record.pin}.json`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <section
        data-testid="presenter-picker"
        className="mx-auto max-w-6xl px-4 py-10 sm:px-6"
      >
        <div className="rounded-2xl border border-white/10 bg-[#131B31] p-6 sm:p-8">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold tracking-wider text-amber-300">
                PANEL DEL PRESENTADOR
              </p>
              <h1 className="mt-1 font-display text-3xl font-extrabold text-white">
                {dashboardTab === 'launch'
                  ? 'Elige un cuestionario para abrir sala en vivo'
                  : 'Historial de Partidas Terminadas'}
              </h1>
              <p className="mt-1.5 text-sm text-slate-300">
                {dashboardTab === 'launch'
                  ? 'Al lanzar una partida recibirás un PIN único de 6 dígitos y un código QR para que tu público se conecte al instante.'
                  : 'Consulta ganadores, clasificaciones completas, porcentajes de acierto y exporta informes de sesiones anteriores.'}
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Vistas del panel del presentador"
              className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-[#0B1020] p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={dashboardTab === 'launch'}
                data-tab="launch"
                onClick={() => setDashboardTab('launch')}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold ${
                  dashboardTab === 'launch'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                Lanzar Sala
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={dashboardTab === 'history'}
                data-tab="history"
                onClick={() => {
                  setDashboardTab('history');
                  void appStore.refreshMatchHistory();
                }}
                className={`whitespace-nowrap rounded-lg px-4 py-2 text-xs font-bold ${
                  dashboardTab === 'history'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'bg-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                Historial ({matchHistory.length})
              </button>
            </div>
          </div>

          {hostSession.error && (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/50 px-4 py-3 text-sm text-rose-200"
            >
              {hostSession.error}
            </div>
          )}

          {dashboardTab === 'launch' ? (
            <>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#0B1020] p-5"
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{quiz.category}</span>
                        <span className="font-mono-num">
                          {quiz.questions.length} preguntas
                        </span>
                      </div>
                      <h2 className="mt-1.5 font-display text-lg font-bold text-white">
                        {quiz.title}
                      </h2>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                        {quiz.description}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-launch-quiz={quiz.id}
                      onClick={() => appStore.startHostRoom(quiz.id)}
                      className="mt-4 h-11 w-full rounded-xl bg-amber-400 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300"
                    >
                      Abrir Sala en Vivo
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => appStore.openEditorForQuiz()}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  + Crear Nuevo Cuestionario
                </button>
                <button
                  type="button"
                  data-action="go-library"
                  onClick={() => appStore.setRoute('library')}
                  className="text-sm font-semibold text-slate-300 underline hover:text-white"
                >
                  Ir a la Biblioteca Completa
                </button>
              </div>
            </>
          ) : matchHistory.length === 0 ? (
            <div
              data-testid="history-empty"
              className="mt-8 rounded-xl border border-dashed border-white/15 bg-[#0B1020]/60 p-10 text-center"
            >
              <p className="font-display text-lg font-bold text-white">
                Todavía no hay partidas terminadas registradas
              </p>
              <p className="mt-1.5 text-sm text-slate-400">
                Cada vez que completes un show hasta el Podio Oficial, los resultados quedarán guardados automáticamente aquí.
              </p>
              <button
                type="button"
                onClick={() => setDashboardTab('launch')}
                className="mt-5 rounded-xl bg-amber-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300"
              >
                Lanzar Primera Sala
              </button>
            </div>
          ) : (
            <div
              data-testid="history-panel"
              className="mt-6 grid gap-6 lg:grid-cols-12"
            >
              <div className="space-y-2.5 lg:col-span-5">
                {matchHistory.map((item) => {
                  const isActive = selectedMatch?.id === item.id;
                  const formattedDate = new Date(item.finishedAt).toLocaleString(
                    'es-ES',
                    {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }
                  );
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-history-item={item.id}
                      onClick={() => setExpandedMatchId(item.id)}
                      className={`w-full rounded-xl border p-4 text-left transition-colors ${
                        isActive
                          ? 'border-amber-400 bg-[#1A2542]'
                          : 'border-white/10 bg-[#0B1020] hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                        <span className="font-mono-num font-bold text-amber-300">
                          PIN {item.pin}
                        </span>
                        <span>{formattedDate}</span>
                      </div>
                      <h2 className="mt-1 truncate font-display text-base font-bold text-white">
                        {item.quizTitle}
                      </h2>
                      <div className="mt-2 flex items-center justify-between text-xs text-slate-300">
                        <span>
                          {item.winnerNickname
                            ? `🏆 ${item.winnerAvatar ?? ''} ${item.winnerNickname}`
                            : 'Sin participantes'}
                        </span>
                        <span className="font-mono-num text-slate-400">
                          {item.playerCount} jug. · {item.totalQuestions} preg.
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedMatch && (
                <div
                  data-testid="history-detail"
                  className="rounded-xl border border-white/10 bg-[#0B1020] p-5 lg:col-span-7"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
                    <div>
                      <p className="font-mono-num text-xs font-bold text-amber-300">
                        SESIÓN PIN {selectedMatch.pin}
                      </p>
                      <h2 className="mt-0.5 font-display text-xl font-extrabold text-white">
                        {selectedMatch.quizTitle}
                      </h2>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportHistoryCsv(selectedMatch)}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 transition-colors hover:bg-emerald-400"
                      >
                        CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => exportHistoryJson(selectedMatch)}
                        className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/10"
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        data-delete-history={selectedMatch.id}
                        onClick={() =>
                          void appStore.deleteMatchHistory(selectedMatch.id)
                        }
                        className="rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-colors hover:bg-rose-950/40"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-white/10 text-xs text-slate-400">
                        <tr>
                          <th className="py-2 pr-3">#</th>
                          <th className="py-2 pr-3">Jugador</th>
                          <th className="py-2 pr-3 text-right">Aciertos</th>
                          <th className="py-2 text-right">Puntos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {selectedMatch.players.map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 pr-3 font-mono-num font-bold text-amber-300">
                              {p.rank}
                            </td>
                            <td className="py-2 pr-3 font-semibold text-white">
                              {p.avatar} {p.nickname}
                            </td>
                            <td className="py-2 pr-3 text-right font-mono-num text-slate-300">
                              {p.correctCount}/{selectedMatch.totalQuestions}
                            </td>
                            <td className="py-2 text-right font-mono-num font-bold text-white">
                              {p.score}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedMatch.questionStats.length > 0 && (
                    <div className="mt-5 border-t border-white/10 pt-4">
                      <h3 className="text-xs font-bold tracking-wider text-slate-300">
                        RENDIMIENTO POR PREGUNTA
                      </h3>
                      <div className="mt-2.5 space-y-2">
                        {selectedMatch.questionStats.map((qs) => {
                          const pct =
                            qs.totalAnswers > 0
                              ? Math.round(
                                  (qs.correctCount / qs.totalAnswers) * 100
                                )
                              : 0;
                          return (
                            <div
                              key={qs.questionIndex}
                              className="flex items-center justify-between gap-3 rounded-lg bg-[#131B31] px-3.5 py-2.5 text-xs"
                            >
                              <span className="truncate font-semibold text-white">
                                #{qs.questionIndex + 1} · {qs.prompt}
                              </span>
                              <span
                                className={`shrink-0 font-mono-num font-bold ${
                                  pct >= 50
                                    ? 'text-emerald-300'
                                    : 'text-amber-300'
                                }`}
                              >
                                {pct}% acierto
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    );
  }

  const joinUrl = new URL(
    `?pin=${encodeURIComponent(room.pin)}`,
    window.location.href
  ).href;

  const reactionLayer = (
    <div
      data-reaction-layer
      className="pointer-events-none fixed inset-x-0 bottom-16 top-20 z-30 overflow-hidden"
    >
      {hostReactions.map((reaction) => (
        <div
          key={reaction.id}
          style={{ left: `${reaction.leftPct}%` }}
          className="animate-reaction pointer-events-none absolute bottom-4 flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#131B31]/90 px-3 py-1.5 text-sm font-bold text-white shadow-lg"
        >
          <span className="text-xl">{reaction.emoji}</span>
          <span>{reaction.nickname}</span>
        </div>
      ))}
    </div>
  );

  // ESTADO 1: SALA DE ESPERA ('espera' / 'LOBBY')
  if (room.gameState === 'espera' || room.phase === 'LOBBY') {
    return (
      <section
        data-testid="presenter-lobby"
        data-game-stage={room.gameState}
        className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6"
      >
        {reactionLayer}

        <div className="grid items-stretch gap-6 lg:grid-cols-12">
          <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#131B31] p-6 sm:p-8 lg:col-span-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold tracking-wider text-amber-300">
                  SALA EN DIRECTO · SALA DE ESPERA
                </p>
                <h1 className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">
                  {room.quizTitle}
                </h1>
                <p className="mt-1 text-sm text-slate-300">
                  Entra desde tu móvil en{' '}
                  <span className="font-mono-num text-white">
                    {window.location.host}
                  </span>{' '}
                  e ingresa el PIN:
                </p>
              </div>
              <button
                type="button"
                data-action="close-room"
                onClick={() => appStore.closeHostRoom()}
                className="rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                Cerrar Sala
              </button>
            </div>

            <div className="my-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-amber-400/35 bg-[#0B1020] p-5 sm:flex-row sm:p-6">
              <div>
                <span className="text-xs font-semibold text-slate-400">
                  PIN DE LA PARTIDA
                </span>
                <div
                  data-testid="host-pin"
                  className="mt-1 font-mono-num text-5xl font-bold tracking-[0.18em] text-amber-300 sm:text-6xl"
                >
                  {room.pin}
                </div>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  data-action="copy-pin"
                  onClick={() => {
                    void navigator.clipboard?.writeText(room.pin);
                    appStore.setHostCopiedNotice(
                      `PIN ${room.pin} copiado al portapapeles.`
                    );
                  }}
                  className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-white/10"
                >
                  Copiar PIN
                </button>
                <button
                  type="button"
                  data-action="copy-link"
                  onClick={() => {
                    void navigator.clipboard?.writeText(joinUrl);
                    appStore.setHostCopiedNotice(
                      'Enlace directo de unión copiado al portapapeles.'
                    );
                  }}
                  className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-blue-500"
                >
                  Copiar Enlace Directo
                </button>
              </div>
            </div>

            {hostSession.copiedNotice && (
              <p className="mb-3 text-xs font-semibold text-emerald-300">
                {hostSession.copiedNotice}
              </p>
            )}

            <div className="flex flex-col justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row sm:items-center">
              <div className="flex flex-wrap items-center gap-5 text-sm text-slate-200">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    data-setting="speedBonus"
                    checked={room.settings.speedBonus}
                    onChange={(e) =>
                      appStore.updateHostSettings({ speedBonus: e.target.checked })
                    }
                    className="h-4 w-4 accent-amber-400"
                  />
                  <span>Bonus por rapidez</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    data-setting="streakBonus"
                    checked={room.settings.streakBonus}
                    onChange={(e) =>
                      appStore.updateHostSettings({
                        streakBonus: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-amber-400"
                  />
                  <span>Bonus por racha</span>
                </label>
              </div>

              <button
                type="button"
                data-action="start-game"
                disabled={room.players.length === 0}
                onClick={() => appStore.startHostGame()}
                className="h-12 whitespace-nowrap rounded-xl bg-amber-400 px-8 font-display text-base font-extrabold text-slate-950 transition-colors hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {room.players.length === 0
                  ? 'Esperando jugadores...'
                  : `Comenzar Show (${room.players.length})`}
              </button>
            </div>
          </div>

          <QRCodeCard pin={room.pin} joinUrl={joinUrl} />
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-[#131B31] p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">
              Participantes en sala (
              <span
                data-testid="lobby-player-count"
                className="font-mono-num text-amber-300"
              >
                {room.players.length}
              </span>
              )
            </h2>
            <span className="text-xs text-slate-400">
              {room.totalQuestions} preguntas preparadas
            </span>
          </div>

          {room.players.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-white/15 bg-[#0B1020]/60 p-8 text-center">
              <p className="text-sm font-medium text-slate-300">
                Todavía no hay jugadores conectados. Comparte el PIN{' '}
                <strong className="font-mono-num text-amber-300">
                  {room.pin}
                </strong>{' '}
                o proyecta el QR.
              </p>
            </div>
          ) : (
            <div
              data-testid="lobby-players"
              className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6"
            >
              {room.players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#0B1020] px-3.5 py-2.5"
                >
                  <span className="shrink-0 text-xl">{p.avatar}</span>
                  <span className="truncate text-sm font-bold text-white">
                    {p.nickname}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  // ESTADO 2: PREGUNTA EN CURSO ('preguntando' -> QUESTION | REVEAL | LEADERBOARD)
  if (room.gameState === 'preguntando') {
    if (room.phase === 'QUESTION' && room.currentQuestion) {
      const q = room.currentQuestion;
      const answeredCount = room.players.filter((p) => p.answeredCurrent).length;
      const displaySeconds =
        timerState.secondsLeft > 0 ? timerState.secondsLeft : q.timeLimitSec;

      return (
        <section
          data-testid="presenter-question"
          data-game-stage={room.gameState}
          className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6"
        >
          {reactionLayer}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-300">
              <span className="font-mono-num text-amber-300">
                Pregunta {room.questionIndex + 1} de {room.totalQuestions}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-num">PIN {room.pin}</span>
              {q.pointsMode === 'double' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-bold text-amber-300">PUNTOS DOBLES</span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="font-mono-num text-sm font-bold text-slate-200">
                Respuestas: <span className="text-amber-300">{answeredCount}</span> /{' '}
                {room.players.length}
              </span>
              <button
                type="button"
                data-action="end-question"
                onClick={() => appStore.endHostQuestionNow()}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10"
              >
                Cerrar Pregunta Ahora
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div
              className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border bg-[#131B31] ${
                displaySeconds <= 5 ? 'border-rose-400/70' : 'border-amber-400/40'
              }`}
            >
              <span
                data-host-timer
                className={`font-mono-num text-2xl font-extrabold ${
                  displaySeconds <= 5 ? 'text-rose-300' : 'text-amber-300'
                }`}
              >
                {displaySeconds}
              </span>
            </div>
            <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                data-host-bar
                className={`h-full transition-[width] duration-100 ${
                  displaySeconds <= 5 ? 'bg-rose-500' : 'bg-amber-400'
                }`}
                style={{ width: `${timerState.percentLeft}%` }}
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-[#131B31] p-8 text-center shadow-2xl sm:p-12">
            <h1 className="font-display text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl">
              {q.prompt}
            </h1>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {OPTION_META.map((opt, idx) => (
              <div
                key={opt.letter}
                className="flex min-h-[108px] items-center gap-4 rounded-2xl px-6 py-5 text-white shadow-lg"
                style={{ backgroundColor: opt.bg }}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/25">
                  <OptionShape index={idx} className="h-7 w-7" />
                </div>
                <p className="font-display text-xl font-bold leading-snug sm:text-2xl">
                  {q.options[idx] ?? ''}
                </p>
              </div>
            ))}
          </div>
        </section>
      );
    }

    if (room.phase === 'REVEAL' && room.currentQuestion && room.revealData) {
      const q = room.currentQuestion;
      const rev = room.revealData;
      const maxCount = Math.max(1, ...rev.counts);
      const isLast = room.questionIndex >= room.totalQuestions - 1;

      return (
        <section
          data-testid="presenter-reveal"
          data-game-stage={room.gameState}
          className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6"
        >
          {reactionLayer}

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold tracking-wider text-amber-300">
                RESULTADOS DE LA RONDA {room.questionIndex + 1}/{room.totalQuestions}
              </p>
              <h1 className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">
                {q.prompt}
              </h1>
            </div>

            <button
              type="button"
              data-action="next-phase"
              onClick={() => appStore.nextHostPhase()}
              className="h-12 whitespace-nowrap rounded-xl bg-amber-400 px-7 font-display text-base font-extrabold text-slate-950 transition-colors hover:bg-amber-300"
            >
              {isLast ? 'Ver Podio Final →' : 'Siguiente: Ranking →'}
            </button>
          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-[#131B31] p-6 sm:p-8">
            <div className="grid h-56 grid-cols-4 items-end gap-4 sm:gap-8">
              {OPTION_META.map((opt, idx) => {
                const count = rev.counts[idx] ?? 0;
                const pct =
                  rev.totalAnswers > 0
                    ? Math.round((count / rev.totalAnswers) * 100)
                    : 0;
                const barPct = Math.max(12, Math.round((count / maxCount) * 100));
                const isCorrect = idx === rev.correctIndex;

                return (
                  <div
                    key={opt.letter}
                    className="flex h-full flex-col items-center justify-end gap-2"
                  >
                    <span
                      className={`font-mono-num text-sm font-bold sm:text-base ${
                        isCorrect ? 'text-amber-300' : 'text-slate-300'
                      }`}
                    >
                      {count} ({pct}%)
                    </span>
                    <div
                      className={`w-full max-w-[110px] rounded-t-xl transition-all ${
                        isCorrect ? 'ring-2 ring-white' : 'opacity-50'
                      }`}
                      style={{
                        height: `${barPct}%`,
                        backgroundColor: opt.bg,
                      }}
                    />
                    <div
                      className={`flex items-center gap-1.5 text-xs font-bold ${
                        isCorrect ? 'text-white' : 'text-slate-400'
                      }`}
                    >
                      <OptionShape index={idx} className="h-4 w-4" />
                      <span>
                        {opt.letter}
                        {isCorrect ? ' ✓' : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-3.5 sm:grid-cols-2">
            {OPTION_META.map((opt, idx) => {
              const isCorrect = idx === rev.correctIndex;
              return (
                <div
                  key={opt.letter}
                  className={`flex items-center justify-between gap-4 rounded-2xl px-5 py-4 text-white ${
                    isCorrect ? 'ring-3 ring-white shadow-xl' : 'opacity-45'
                  }`}
                  style={{ backgroundColor: opt.bg }}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-black/25">
                      <OptionShape index={idx} className="h-5 w-5" />
                    </span>
                    <span className="font-display text-lg font-bold">
                      {q.options[idx] ?? ''}
                    </span>
                  </div>
                  {isCorrect && (
                    <span className="shrink-0 rounded-lg bg-white px-3 py-1 text-xs font-extrabold text-slate-950">
                      CORRECTA
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      );
    }

    // LEADERBOARD
    const topPlayers = room.players.slice(0, 8);
    return (
      <section
        data-testid="presenter-leaderboard"
        data-game-stage={room.gameState}
        className="mx-auto max-w-4xl px-4 py-8 sm:px-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-wider text-amber-300">
              CLASIFICACIÓN EN VIVO
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold text-white">
              Ranking tras la Pregunta {room.questionIndex + 1}
            </h1>
          </div>

          <button
            type="button"
            data-action="next-phase"
            onClick={() => appStore.nextHostPhase()}
            className="h-12 whitespace-nowrap rounded-xl bg-amber-400 px-7 font-display text-base font-extrabold text-slate-950 transition-colors hover:bg-amber-300"
          >
            Siguiente Pregunta →
          </button>
        </div>

        <div className="mt-6 space-y-3">
          {topPlayers.map((p) => {
            const delta = p.previousRank - p.rank;
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between gap-4 rounded-2xl border px-5 py-4 ${
                  p.rank === 1
                    ? 'border-amber-400/50 bg-[#1B2542]'
                    : 'border-white/10 bg-[#131B31]'
                }`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span
                    className={`w-8 text-center font-mono-num text-xl font-extrabold ${
                      p.rank === 1 ? 'text-amber-300' : 'text-slate-300'
                    }`}
                  >
                    #{p.rank}
                  </span>
                  <span className="shrink-0 text-2xl">{p.avatar}</span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold text-white">
                      {p.nickname}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      {delta > 0 ? (
                        <span className="text-emerald-300">▲ +{delta}</span>
                      ) : delta < 0 ? (
                        <span className="text-rose-400">▼ {delta}</span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                      {p.streak >= 2 && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-amber-300">
                            🔥 Racha {p.streak}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <p className="font-mono-num text-xl font-extrabold text-white">
                    {p.score}
                  </p>
                  <p
                    className={`font-mono-num text-xs font-semibold ${
                      p.lastRoundPoints > 0 ? 'text-emerald-300' : 'text-slate-500'
                    }`}
                  >
                    +{p.lastRoundPoints} ronda
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // ESTADO 3: PODIO FINAL ('podio' / 'PODIUM')
  const first = room.players[0] ?? null;
  const second = room.players[1] ?? null;
  const third = room.players[2] ?? null;

  const downloadCsv = (currentRoom: Room) => {
    const csv = buildResultsCsv(
      currentRoom.quizTitle,
      currentRoom.pin,
      currentRoom.players,
      currentRoom.questionStats
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kawin-informe-${currentRoom.pin}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadJson = (currentRoom: Room) => {
    const blob = new Blob([JSON.stringify(currentRoom, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kawin-informe-${currentRoom.pin}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section
      data-testid="presenter-podium"
      data-game-stage={room.gameState}
      className="relative mx-auto max-w-6xl overflow-hidden px-4 py-8 sm:px-6"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden"
      >
        {Array.from({ length: 16 }).map((_, i) => (
          <span
            key={i}
            className="confetti-piece absolute top-0 h-3 w-2 rounded-sm"
            style={{
              left: `${4 + i * 6}%`,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 5) * 0.35}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 text-center">
        <p className="text-xs font-bold tracking-wider text-amber-300">
          GRAN FINAL · {room.quizTitle}
        </p>
        <h1 className="mt-1 font-display text-4xl font-extrabold text-white sm:text-5xl">
          Podio Oficial KaWin
        </h1>
      </div>

      <div className="relative z-10 mx-auto mt-10 grid max-w-4xl items-end gap-4 sm:grid-cols-3">
        <div
          className="animate-podium order-2 flex flex-col justify-between rounded-2xl border border-slate-300/25 bg-[#131B31] p-6 text-center sm:order-1 sm:min-h-[210px]"
          style={{ animationDelay: '120ms' }}
        >
          {second ? (
            <>
              <div>
                <span className="text-3xl">🥈</span>
                <p className="mt-2 truncate font-display text-xl font-bold text-white">
                  {second.avatar} {second.nickname}
                </p>
                <p className="mt-1 font-mono-num text-sm text-slate-400">
                  {second.correctCount}/{room.totalQuestions} aciertos
                </p>
              </div>
              <p className="mt-4 font-mono-num text-2xl font-extrabold text-slate-200">
                {second.score} pts
              </p>
            </>
          ) : (
            <p className="my-auto text-sm text-slate-500">2º Puesto vacante</p>
          )}
        </div>

        <div className="animate-podium order-1 flex flex-col justify-between rounded-2xl border-2 border-amber-400 bg-[#1B2542] p-7 text-center shadow-2xl sm:order-2 sm:min-h-[260px]">
          {first ? (
            <>
              <div>
                <span className="text-4xl">🏆</span>
                <p className="mt-1 text-xs font-bold tracking-wider text-amber-300">
                  CAMPEÓN DEL SHOW
                </p>
                <p className="mt-2 truncate font-display text-2xl font-extrabold text-white">
                  {first.avatar} {first.nickname}
                </p>
                <p className="mt-1 font-mono-num text-sm text-slate-300">
                  {first.correctCount}/{room.totalQuestions} aciertos
                </p>
              </div>
              <p className="mt-4 font-mono-num text-3xl font-extrabold text-amber-300">
                {first.score} pts
              </p>
            </>
          ) : (
            <p className="my-auto text-sm text-slate-500">Sin participantes</p>
          )}
        </div>

        <div
          className="animate-podium order-3 flex flex-col justify-between rounded-2xl border border-amber-700/40 bg-[#131B31] p-6 text-center sm:min-h-[180px]"
          style={{ animationDelay: '220ms' }}
        >
          {third ? (
            <>
              <div>
                <span className="text-3xl">🥉</span>
                <p className="mt-2 truncate font-display text-xl font-bold text-white">
                  {third.avatar} {third.nickname}
                </p>
                <p className="mt-1 font-mono-num text-sm text-slate-400">
                  {third.correctCount}/{room.totalQuestions} aciertos
                </p>
              </div>
              <p className="mt-4 font-mono-num text-2xl font-extrabold text-amber-200">
                {third.score} pts
              </p>
            </>
          ) : (
            <p className="my-auto text-sm text-slate-500">3er Puesto vacante</p>
          )}
        </div>
      </div>

      <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          data-action="download-csv"
          onClick={() => downloadCsv(room)}
          className="h-11 rounded-xl bg-emerald-500 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-emerald-400"
        >
          Descargar Informe CSV
        </button>
        <button
          type="button"
          data-action="download-json"
          onClick={() => downloadJson(room)}
          className="h-11 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
        >
          Descargar JSON
        </button>
        <button
          type="button"
          data-action="restart-room"
          onClick={() => appStore.restartHostRoom()}
          className="h-11 rounded-xl bg-amber-400 px-5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300"
        >
          Jugar de Nuevo (Mismo PIN)
        </button>
        <button
          type="button"
          data-action="close-room"
          onClick={() => appStore.closeHostRoom()}
          className="h-11 rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-semibold text-slate-200 transition-colors hover:bg-white/10"
        >
          Finalizar y Volver
        </button>
      </div>

      <div className="relative z-10 mt-10 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-[#131B31] p-6">
          <h2 className="font-display text-lg font-bold text-white">
            Clasificación Completa
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-white/10 text-xs text-slate-400">
                <tr>
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">Jugador</th>
                  <th className="py-2 pr-3 text-right">Aciertos</th>
                  <th className="py-2 text-right">Puntos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {room.players.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-3 font-mono-num font-bold text-amber-300">
                      {p.rank}
                    </td>
                    <td className="py-2.5 pr-3 font-semibold text-white">
                      {p.avatar} {p.nickname}
                    </td>
                    <td className="py-2.5 pr-3 text-right font-mono-num text-slate-300">
                      {p.correctCount}/{room.totalQuestions}
                    </td>
                    <td className="py-2.5 text-right font-mono-num font-bold text-white">
                      {p.score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#131B31] p-6">
          <h2 className="font-display text-lg font-bold text-white">
            Análisis por Pregunta
          </h2>
          <div className="mt-4 space-y-3">
            {room.questionStats.map((qs) => {
              const pct =
                qs.totalAnswers > 0
                  ? Math.round((qs.correctCount / qs.totalAnswers) * 100)
                  : 0;
              return (
                <div
                  key={qs.questionIndex}
                  className="rounded-xl border border-white/10 bg-[#0B1020] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span className="font-mono-num">
                      Pregunta {qs.questionIndex + 1}
                    </span>
                    <span
                      className={`font-mono-num font-bold ${
                        pct >= 50 ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      {pct}% de acierto
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-white">
                    {qs.prompt}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

import { AVATAR_OPTIONS, OPTION_META } from '../../shared/scoring.ts';
import type {
  PlayerPrivateFeedback,
  RoomPublicState,
} from '../../shared/types.ts';
import { studioAudio } from '../audio.ts';
import { shouldTriggerUrgentTick } from '../audioCues.ts';
import { escapeHtml, renderOptionShapeSvg } from '../components/Shapes.ts';

export interface PlayerSessionState {
  pin: string;
  nickname: string;
  avatar: string;
  playerId: string | null;
  sessionToken: string | null;
  roomState: RoomPublicState | null;
  me: PlayerPrivateFeedback | null;
  error: string | null;
  joining: boolean;
}

export interface PlayerViewProps {
  session: PlayerSessionState;
  onJoinSubmit: (pin: string, nickname: string, avatar: string) => void;
  onSubmitAnswer: (optionIndex: number) => void;
  onSendReaction: (emoji: string) => void;
  onLeaveRoom: () => void;
}

export function renderPlayerView(
  container: HTMLElement,
  props: PlayerViewProps
): () => void {
  const { session } = props;
  const room = session.roomState;

  // Step 1: Join Form (PIN + Nickname + Avatar)
  if (!room || !session.playerId) {
    container.innerHTML = `
      <section class="mx-auto flex min-h-[calc(100vh-140px)] max-w-md flex-col justify-center px-4 py-10">
        <div class="rounded-2xl border border-white/10 bg-[#131B31] p-6 sm:p-8 shadow-2xl">
          <p class="text-xs font-bold tracking-wider text-amber-300">ENTRAR COMO JUGADOR</p>
          <h1 class="mt-1 font-display text-3xl font-extrabold text-white">Únete al Show</h1>
          <p class="mt-1.5 text-sm text-slate-300">
            Sin instalar nada ni registrarte. Ingresa el PIN de la pantalla principal y elige tu apodo.
          </p>

          ${
            session.error
              ? `<div role="alert" class="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/60 px-4 py-3 text-sm font-medium text-rose-200">${escapeHtml(session.error)}</div>`
              : ''
          }

          <form data-form="player-join" class="mt-6 space-y-5">
            <div>
              <label for="join-pin" class="block text-xs font-semibold text-slate-300">
                PIN de la partida (6 dígitos)
              </label>
              <input
                id="join-pin"
                name="pin"
                type="text"
                inputmode="numeric"
                maxlength="6"
                required
                value="${escapeHtml(session.pin)}"
                placeholder="000000"
                autocomplete="off"
                class="mt-1.5 font-mono-num h-14 w-full rounded-xl border border-white/15 bg-[#0B1020] px-4 text-center text-2xl font-bold tracking-[0.25em] text-white placeholder:text-slate-600"
              />
            </div>

            <div>
              <label for="join-nickname" class="block text-xs font-semibold text-slate-300">
                Tu Apodo
              </label>
              <input
                id="join-nickname"
                name="nickname"
                type="text"
                maxlength="20"
                required
                value="${escapeHtml(session.nickname)}"
                placeholder="Ej. Sofía, Capitán Rayo..."
                autocomplete="off"
                class="mt-1.5 h-12 w-full rounded-xl border border-white/15 bg-[#0B1020] px-4 text-base font-semibold text-white placeholder:text-slate-500"
              />
            </div>

            <div>
              <span class="block text-xs font-semibold text-slate-300">Tu Emblema</span>
              <div class="mt-2 grid grid-cols-6 gap-2">
                ${AVATAR_OPTIONS.map((av) => {
                  const selected = session.avatar === av;
                  return `
                    <button
                      type="button"
                      data-avatar="${av}"
                      aria-label="Elegir emblema ${av}"
                      class="h-11 rounded-xl border text-xl transition-transform ${
                        selected
                          ? 'border-amber-400 bg-amber-400/20 scale-105'
                          : 'border-white/10 bg-[#0B1020] hover:bg-white/10'
                      }"
                    >${av}</button>
                  `;
                }).join('')}
              </div>
            </div>

            <button
              type="submit"
              ${session.joining ? 'disabled' : ''}
              class="h-13 w-full rounded-xl bg-amber-400 font-display text-lg font-extrabold text-slate-950 hover:bg-amber-300 transition-colors disabled:opacity-50"
            >
              ${session.joining ? 'Conectando...' : '¡Entrar a Jugar!'}
            </button>
          </form>
        </div>
      </section>
    `;

    const pinEl = container.querySelector<HTMLInputElement>('#join-pin');
    const nickEl = container.querySelector<HTMLInputElement>('#join-nickname');

    container.querySelectorAll<HTMLButtonElement>('[data-avatar]').forEach((btn) => {
      btn.addEventListener('click', () => {
        session.avatar = btn.dataset.avatar ?? AVATAR_OPTIONS[0];
        if (pinEl) session.pin = pinEl.value;
        if (nickEl) session.nickname = nickEl.value;
        renderPlayerView(container, props);
      });
    });

    container
      .querySelector<HTMLFormElement>('[data-form="player-join"]')
      ?.addEventListener('submit', (e) => {
        e.preventDefault();
        const pin = (pinEl?.value ?? '').replace(/\D/g, '').trim();
        const nick = (nickEl?.value ?? '').trim();
        props.onJoinSubmit(pin, nick, session.avatar);
      });

    return () => {};
  }

  const me = session.me;
  const myPlayer = room.players.find((p) => p.id === session.playerId);
  const myScore = myPlayer?.score ?? me?.totalScore ?? 0;
  const myRank = myPlayer?.rank ?? me?.rank ?? 1;
  const myStreak = myPlayer?.streak ?? me?.streak ?? 0;

  let cleanupTimer: (() => void) | null = null;

  // Step 2: Lobby Waiting Screen
  if (room.phase === 'LOBBY') {
    container.innerHTML = `
      <section class="mx-auto flex min-h-[calc(100vh-140px)] max-w-lg flex-col justify-between px-4 py-8">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span class="font-mono-num">SALA PIN ${escapeHtml(room.pin)}</span>
          <button type="button" data-action="leave-room" class="text-slate-300 hover:text-white underline">
            Salir
          </button>
        </div>

        <div class="my-8 rounded-2xl border border-white/10 bg-[#131B31] p-7 text-center">
          <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-400/40 bg-amber-400/15 text-4xl">
            ${escapeHtml(session.avatar)}
          </div>
          <h1 class="mt-4 font-display text-3xl font-extrabold text-white">
            ¡Estás dentro, ${escapeHtml(session.nickname)}!
          </h1>
          <p class="mt-2 text-sm text-slate-300">
            ¿Ves tu nombre en la pantalla principal? Prepárate para la primera pregunta de
            <strong class="text-white">${escapeHtml(room.quizTitle)}</strong>.
          </p>

          <p class="mt-5 font-mono-num text-xs font-bold text-amber-300">
            ${room.players.length} ${room.players.length === 1 ? 'jugador conectado' : 'jugadores conectados'}
          </p>

          <div class="mt-6 border-t border-white/10 pt-5">
            <p class="text-xs font-semibold text-slate-400">Envía una reacción en vivo a la pantalla</p>
            <div class="mt-3 flex items-center justify-center gap-2.5">
              ${['👏', '🔥', '⚡', '🎉', '🤯']
                .map(
                  (emoji) => `
                <button
                  type="button"
                  data-reaction="${emoji}"
                  aria-label="Enviar reacción ${emoji}"
                  class="h-12 w-12 rounded-xl border border-white/10 bg-[#0B1020] text-2xl hover:scale-110 active:scale-95 transition-transform"
                >${emoji}</button>
              `
                )
                .join('')}
            </div>
          </div>
        </div>

        <div class="text-center text-xs text-slate-400">
          Mantén esta pantalla abierta durante el show
        </div>
      </section>
    `;
  } else if (room.phase === 'QUESTION' && room.currentQuestion) {
    // Step 3: Active Question Controller
    const q = room.currentQuestion;
    const answered = Boolean(me?.answered);

    container.innerHTML = `
      <section class="mx-auto flex min-h-[calc(100vh-140px)] max-w-2xl flex-col justify-between px-4 py-6">
        <div class="flex items-center justify-between gap-3">
          <div class="text-xs font-semibold text-slate-300">
            <span class="font-mono-num">Pregunta ${room.questionIndex + 1}/${room.totalQuestions}</span>
            <span aria-hidden="true"> · </span>
            <span class="font-mono-num text-amber-300">${myScore} pts</span>
          </div>
          <div class="font-mono-num text-sm font-bold text-white" data-player-timer>
            ${q.timeLimitSec}s
          </div>
        </div>

        <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div data-player-bar class="h-full bg-amber-400 transition-[width] duration-100" style="width: 100%"></div>
        </div>

        <div class="my-5 rounded-2xl border border-white/10 bg-[#131B31] p-5 text-center">
          <p class="font-display text-lg sm:text-xl font-bold text-white leading-snug">
            ${escapeHtml(q.prompt)}
          </p>
        </div>

        ${
          answered
            ? `
              <div class="flex-1 flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-[#131B31] p-8 text-center">
                <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/20 border border-blue-400/40 text-blue-300">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-8 h-8"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <h2 class="mt-4 font-display text-2xl font-extrabold text-white">
                  ¡Respuesta registrada!
                </h2>
                <p class="mt-2 text-sm text-slate-300">
                  Esperando a que los demás jugadores respondan o termine el tiempo...
                </p>
              </div>
            `
            : `
              <div class="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                ${OPTION_META.map(
                  (opt, idx) => `
                  <button
                    type="button"
                    data-answer-idx="${idx}"
                    class="flex min-h-[84px] items-center gap-4 rounded-2xl px-5 py-4 text-left text-white shadow-lg transition-transform active:scale-[0.98]"
                    style="background-color: ${opt.bg};"
                  >
                    <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-black/25">
                      ${renderOptionShapeSvg(idx, 'w-6 h-6')}
                    </span>
                    <span class="font-display text-base sm:text-lg font-bold leading-snug">
                      ${escapeHtml(q.options[idx] ?? '')}
                    </span>
                  </button>
                `
                ).join('')}
              </div>
            `
        }
      </section>
    `;

    // Live timer countdown synced with server deadline
    if (room.questionEndsAt && room.questionStartedAt) {
      const started = room.questionStartedAt;
      const ends = room.questionEndsAt;
      const offset = Date.now() - room.serverTime;
      const total = Math.max(1000, ends - started);
      let lastUrgentSecond: number | null = null;

      const updateTimer = () => {
        const nowServer = Date.now() - offset;
        const remainingMs = Math.max(0, ends - nowServer);
        const pct = Math.max(0, Math.min(100, (remainingMs / total) * 100));
        const sec = Math.ceil(remainingMs / 1000);
        const timerEl = container.querySelector<HTMLElement>('[data-player-timer]');
        const barEl = container.querySelector<HTMLElement>('[data-player-bar]');
        if (timerEl) timerEl.textContent = `${sec}s`;
        if (barEl) barEl.style.width = `${pct}%`;
        if (!answered && shouldTriggerUrgentTick(sec, lastUrgentSecond)) {
          lastUrgentSecond = sec;
          studioAudio.playTimeRunningOut(sec);
        }
      };
      updateTimer();
      const iv = setInterval(updateTimer, 100);
      cleanupTimer = () => clearInterval(iv);
    }

    container.querySelectorAll<HTMLButtonElement>('[data-answer-idx]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.answerIdx);
        props.onSubmitAnswer(idx);
      });
    });
  } else if (room.phase === 'REVEAL' || room.phase === 'LEADERBOARD') {
    // Step 4: Round Feedback
    const isCorrect = Boolean(me?.isCorrect);
    const earned = me?.pointsEarned ?? 0;

    container.innerHTML = `
      <section class="mx-auto flex min-h-[calc(100vh-140px)] max-w-md flex-col justify-center px-4 py-8">
        <div class="rounded-2xl border ${
          isCorrect
            ? 'border-emerald-400/40 bg-emerald-950/50'
            : 'border-rose-500/40 bg-rose-950/40'
        } p-8 text-center">
          <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ${
            isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-rose-600 text-white'
          }">
            ${
              isCorrect
                ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="w-8 h-8"><polyline points="20 6 9 17 4 12"/></svg>`
                : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="w-8 h-8"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
            }
          </div>

          <h1 class="mt-4 font-display text-3xl font-extrabold text-white">
            ${isCorrect ? '¡Respuesta Correcta!' : me?.answered ? 'Incorrecto' : 'Tiempo Agotado'}
          </h1>

          <p class="mt-2 font-mono-num text-2xl font-bold ${
            isCorrect ? 'text-emerald-300' : 'text-slate-300'
          }">
            ${isCorrect ? `+${earned} pts` : '+0 pts'}
          </p>

          ${
            myStreak >= 2
              ? `<p class="mt-2 text-sm font-bold text-amber-300">🔥 Racha de ${myStreak} aciertos seguidos</p>`
              : ''
          }

          <div class="mt-6 grid grid-cols-2 gap-3 border-t border-white/15 pt-5">
            <div class="rounded-xl bg-black/25 p-3">
              <p class="text-xs text-slate-300">Puntuación</p>
              <p class="mt-0.5 font-mono-num text-xl font-bold text-white">${myScore}</p>
            </div>
            <div class="rounded-xl bg-black/25 p-3">
              <p class="text-xs text-slate-300">Tu Puesto</p>
              <p class="mt-0.5 font-mono-num text-xl font-bold text-amber-300">#${myRank}</p>
            </div>
          </div>

          <p class="mt-5 text-xs text-slate-300">
            Mira la pantalla principal para continuar con la siguiente ronda
          </p>
        </div>
      </section>
    `;
  } else {
    // Step 5: Final Podium on Mobile
    const medal =
      myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : '🏁';
    container.innerHTML = `
      <section class="mx-auto flex min-h-[calc(100vh-140px)] max-w-md flex-col justify-center px-4 py-8">
        <div class="rounded-2xl border border-amber-400/35 bg-[#131B31] p-8 text-center">
          <div class="text-5xl">${medal}</div>
          <h1 class="mt-3 font-display text-3xl font-extrabold text-white">
            ${myRank <= 3 ? `¡Puesto #${myRank} en el Podio!` : `Finalizaste #${myRank}`}
          </h1>
          <p class="mt-1 text-sm text-slate-300">
            ${escapeHtml(session.nickname)} · ${escapeHtml(room.quizTitle)}
          </p>

          <div class="mt-6 grid grid-cols-2 gap-3">
            <div class="rounded-xl border border-white/10 bg-[#0B1020] p-4">
              <p class="text-xs text-slate-400">Puntos Totales</p>
              <p class="mt-1 font-mono-num text-2xl font-bold text-amber-300">${myScore}</p>
            </div>
            <div class="rounded-xl border border-white/10 bg-[#0B1020] p-4">
              <p class="text-xs text-slate-400">Aciertos</p>
              <p class="mt-1 font-mono-num text-2xl font-bold text-white">${myPlayer?.correctCount ?? 0}/${room.totalQuestions}</p>
            </div>
          </div>

          <button
            type="button"
            data-action="leave-room"
            class="mt-6 h-12 w-full rounded-xl bg-amber-400 font-bold text-slate-950 hover:bg-amber-300 transition-colors"
          >
            Unirse a Otra Partida
          </button>
        </div>
      </section>
    `;
  }

  container.querySelectorAll<HTMLButtonElement>('[data-reaction]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.reaction) props.onSendReaction(btn.dataset.reaction);
    });
  });

  container.querySelectorAll<HTMLButtonElement>('[data-action="leave-room"]').forEach((btn) => {
    btn.addEventListener('click', () => props.onLeaveRoom());
  });

  return () => {
    if (cleanupTimer) cleanupTimer();
  };
}

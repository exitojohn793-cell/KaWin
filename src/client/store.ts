import {
  AVATAR_OPTIONS,
  formatVisitorCount,
  validateQuizInput,
} from '../shared/scoring.ts';
import type {
  FinishedMatchRecord,
  GameLifecycleStage,
  PlayerPrivateFeedback,
  PointsMode,
  Quiz,
  QuizCategory,
  QuizQuestion,
  ReactionEventPayload,
  Room,
  RoomPhase,
  RoomSettings,
} from '../shared/types.ts';
import {
  checkRoomExists,
  createQuiz,
  deleteMatchHistoryRecord,
  deleteQuiz,
  fetchMatchHistory,
  fetchQuizzes,
  fetchVisitorHit,
  updateQuiz,
} from './api.ts';
import { studioAudio } from './audio.ts';
import type { AppRoute } from './components/TopBar.ts';
import {
  type PracticeSessionState,
  advancePracticeSession,
  answerPracticeQuestion,
  startPracticeSession,
  timeoutPracticeQuestion,
} from './practiceEngine.ts';
import { wsClient } from './wsClient.ts';

export interface EditorDraft {
  id: string | null;
  title: string;
  description: string;
  category: QuizCategory;
  questions: QuizQuestion[];
  selectedIndex: number;
  errors: string[];
  saving: boolean;
}

export interface HostSessionState {
  pin: string | null;
  hostToken: string | null;
  roomState: Room | null;
  copiedNotice: string | null;
  error: string | null;
}

export interface PlayerSessionState {
  pin: string;
  nickname: string;
  avatar: string;
  playerId: string | null;
  sessionToken: string | null;
  roomState: Room | null;
  me: PlayerPrivateFeedback | null;
  error: string | null;
  joining: boolean;
}

export interface HostFloatingReaction extends ReactionEventPayload {
  leftPct: number;
}

export interface AppState {
  route: AppRoute;
  wsConnected: boolean;
  muted: boolean;
  visitorFormatted: string;
  quizzes: Quiz[];
  matchHistory: FinishedMatchRecord[];
  practiceSession: PracticeSessionState | null;
  editorDraft: EditorDraft;
  libraryFilter: {
    category: 'Todos' | QuizCategory;
    search: string;
    pendingDeleteId: string | null;
  };
  hostSession: HostSessionState;
  hostReactions: HostFloatingReaction[];
  playerSession: PlayerSessionState;
  lastHostPhase: RoomPhase | null;
  lastPlayerPhase: RoomPhase | null;
  toast: string | null;
}

export function createEmptyQuestion(index: number): QuizQuestion {
  return {
    id: `q_${Date.now().toString(36)}_${index}`,
    prompt: '',
    options: ['', '', '', ''],
    correctIndex: 0,
    timeLimitSec: 20,
    pointsMode: 'standard',
  };
}

export function createInitialDraft(quiz?: Quiz): EditorDraft {
  if (quiz) {
    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      category: quiz.category,
      questions: structuredClone(quiz.questions),
      selectedIndex: 0,
      errors: [],
      saving: false,
    };
  }
  return {
    id: null,
    title: '',
    description: '',
    category: 'General',
    questions: [createEmptyQuestion(1)],
    selectedIndex: 0,
    errors: [],
    saving: false,
  };
}

function resolveInitialRoute(): { route: AppRoute; initialPin: string } {
  if (typeof window === 'undefined') {
    return { route: 'home', initialPin: '' };
  }
  const params = new URLSearchParams(window.location.search);
  const initialPin = (params.get('pin') ?? '').replace(/\D/g, '').slice(0, 6);
  const initialViewParam = params.get('view') as AppRoute | null;
  const autostart = params.get('autostart') === '1';

  const route: AppRoute = initialPin
    ? 'join'
    : autostart
      ? 'library'
      : initialViewParam &&
          ['home', 'join', 'practice', 'host', 'library', 'editor'].includes(
            initialViewParam
          )
        ? initialViewParam
        : 'home';

  return { route, initialPin };
}

type StoreListener = () => void;

class CentralizedAppStore {
  private state: AppState;
  private listeners = new Set<StoreListener>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;

  constructor() {
    const { route, initialPin } = resolveInitialRoute();
    this.state = {
      route,
      wsConnected: false,
      muted: studioAudio.isMuted(),
      visitorFormatted: formatVisitorCount(1000),
      quizzes: [],
      matchHistory: [],
      practiceSession: null,
      editorDraft: createInitialDraft(),
      libraryFilter: {
        category: 'Todos',
        search: '',
        pendingDeleteId: null,
      },
      hostSession: {
        pin: null,
        hostToken: null,
        roomState: null,
        copiedNotice: null,
        error: null,
      },
      hostReactions: [],
      playerSession: {
        pin: initialPin,
        nickname: '',
        avatar: AVATAR_OPTIONS[0],
        playerId: null,
        sessionToken: null,
        roomState: null,
        me: null,
        error: null,
        joining: false,
      },
      lastHostPhase: null,
      lastPlayerPhase: null,
      toast: null,
    };
  }

  getState = (): AppState => this.state;

  subscribe = (listener: StoreListener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(updater: (prev: AppState) => AppState): void {
    this.state = updater(this.state);
    for (const listener of this.listeners) {
      listener();
    }
  }

  showToast(message: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.setState((prev) => ({ ...prev, toast: message }));
    this.toastTimer = setTimeout(() => {
      this.setState((prev) => ({ ...prev, toast: null }));
    }, 3200);
  }

  setRoute(route: AppRoute): void {
    this.setState((prev) => ({ ...prev, route }));
  }

  toggleMute(): void {
    const muted = studioAudio.toggleMute();
    this.setState((prev) => ({ ...prev, muted }));
  }

  openEditorForQuiz(quizId?: string): void {
    const found = quizId
      ? this.state.quizzes.find((q) => q.id === quizId)
      : undefined;
    this.setState((prev) => ({
      ...prev,
      editorDraft: createInitialDraft(found),
      route: 'editor',
    }));
  }

  updateEditorDraft(updater: (draft: EditorDraft) => EditorDraft): void {
    this.setState((prev) => ({
      ...prev,
      editorDraft: updater(prev.editorDraft),
    }));
  }

  async saveQuizFromBuilder(launchAfterSave: boolean): Promise<void> {
    const draft = this.state.editorDraft;
    const check = validateQuizInput({
      title: draft.title,
      description: draft.description,
      category: draft.category,
      questions: draft.questions,
    });

    if (!check.valid || !check.sanitized) {
      this.setState((prev) => ({
        ...prev,
        editorDraft: {
          ...prev.editorDraft,
          errors: check.errors,
          saving: false,
        },
      }));
      return;
    }

    this.setState((prev) => ({
      ...prev,
      editorDraft: {
        ...prev.editorDraft,
        errors: [],
        saving: true,
      },
    }));

    try {
      const saved: Quiz = draft.id
        ? await updateQuiz(draft.id, check.sanitized)
        : await createQuiz(check.sanitized);

      this.setState((prev) => {
        const nextQuizzes = draft.id
          ? prev.quizzes.map((q) => (q.id === saved.id ? saved : q))
          : [saved, ...prev.quizzes];

        return {
          ...prev,
          quizzes: nextQuizzes,
          editorDraft: {
            ...createInitialDraft(saved),
            saving: false,
          },
        };
      });

      if (launchAfterSave) {
        this.startHostRoom(saved.id);
      } else {
        this.showToast('Cuestionario guardado en el estado centralizado y servidor.');
        this.setRoute('library');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el cuestionario.';
      this.setState((prev) => ({
        ...prev,
        editorDraft: {
          ...prev.editorDraft,
          errors: [msg],
          saving: false,
        },
      }));
    }
  }

  async duplicateQuizInLibrary(quiz: Quiz): Promise<void> {
    const created = await createQuiz({
      title: `${quiz.title} (Copia)`,
      description: quiz.description,
      category: quiz.category,
      questions: structuredClone(quiz.questions),
    });
    this.setState((prev) => ({
      ...prev,
      quizzes: [created, ...prev.quizzes],
    }));
    this.showToast('Cuestionario duplicado en tu biblioteca.');
  }

  async deleteQuizFromLibrary(quizId: string): Promise<void> {
    await deleteQuiz(quizId);
    this.setState((prev) => ({
      ...prev,
      quizzes: prev.quizzes.filter((q) => q.id !== quizId),
    }));
    this.showToast('Cuestionario eliminado.');
  }

  async importQuizJson(rawJson: string): Promise<void> {
    try {
      const parsed = JSON.parse(rawJson) as Partial<Quiz>;
      const check = validateQuizInput(parsed);
      if (!check.valid || !check.sanitized) {
        this.showToast(check.errors[0] || 'Archivo JSON inválido.');
        return;
      }
      const created = await createQuiz(check.sanitized);
      this.setState((prev) => ({
        ...prev,
        quizzes: [created, ...prev.quizzes],
      }));
      this.showToast('Cuestionario importado correctamente.');
    } catch {
      this.showToast('No se pudo leer el archivo JSON.');
    }
  }

  startHostRoom(quizId: string): void {
    this.setState((prev) => ({
      ...prev,
      route: 'host',
      hostSession: {
        ...prev.hostSession,
        error: null,
        copiedNotice: null,
      },
    }));
    wsClient.send({
      type: 'host:create',
      quizId,
      settings: { speedBonus: true, streakBonus: true },
    });
  }

  setHostCopiedNotice(notice: string | null): void {
    this.setState((prev) => ({
      ...prev,
      hostSession: {
        ...prev.hostSession,
        copiedNotice: notice,
      },
    }));
  }

  updateHostSettings(settings: Partial<RoomSettings>): void {
    const pin = this.state.hostSession.pin;
    if (!pin) return;
    wsClient.send({ type: 'host:updateSettings', pin, settings });
  }

  startHostGame(): void {
    const pin = this.state.hostSession.pin;
    if (!pin) return;
    wsClient.send({ type: 'host:startGame', pin });
  }

  endHostQuestionNow(): void {
    const pin = this.state.hostSession.pin;
    if (!pin) return;
    wsClient.send({ type: 'host:endQuestionNow', pin });
  }

  nextHostPhase(): void {
    const pin = this.state.hostSession.pin;
    if (!pin) return;
    wsClient.send({ type: 'host:nextPhase', pin });
  }

  setHostStage(stage: GameLifecycleStage): void {
    const pin = this.state.hostSession.pin;
    if (!pin) return;
    wsClient.send({ type: 'host:setStage', pin, stage });
  }

  restartHostRoom(): void {
    const pin = this.state.hostSession.pin;
    if (!pin) return;
    wsClient.send({ type: 'host:restartRoom', pin });
  }

  closeHostRoom(): void {
    const pin = this.state.hostSession.pin;
    if (pin) {
      wsClient.send({ type: 'host:closeRoom', pin });
    }
    this.setState((prev) => ({
      ...prev,
      route: 'host',
      hostReactions: [],
      hostSession: {
        pin: null,
        hostToken: null,
        roomState: null,
        copiedNotice: null,
        error: null,
      },
    }));
    void this.refreshMatchHistory();
  }

  async checkAndGoToJoin(pin: string): Promise<void> {
    const exists = await checkRoomExists(pin).catch(() => true);
    this.setState((prev) => ({
      ...prev,
      route: 'join',
      playerSession: {
        ...prev.playerSession,
        pin,
        error: exists ? null : `No hay ninguna sala activa con el PIN ${pin}.`,
      },
    }));
  }

  submitPlayerJoin(pin: string, nickname: string, avatar: string): void {
    if (pin.length !== 6) {
      this.setState((prev) => ({
        ...prev,
        playerSession: {
          ...prev.playerSession,
          error: 'El PIN debe tener exactamente 6 dígitos.',
        },
      }));
      return;
    }
    if (!nickname) {
      this.setState((prev) => ({
        ...prev,
        playerSession: {
          ...prev.playerSession,
          error: 'Elige un apodo para entrar.',
        },
      }));
      return;
    }

    const sessionToken = this.state.playerSession.sessionToken ?? undefined;
    this.setState((prev) => ({
      ...prev,
      playerSession: {
        ...prev.playerSession,
        pin,
        nickname,
        avatar,
        error: null,
        joining: true,
      },
    }));

    wsClient.send({
      type: 'player:join',
      pin,
      nickname,
      avatar,
      sessionToken,
    });
  }

  submitPlayerAnswer(optionIndex: number): void {
    const room = this.state.playerSession.roomState;
    if (!room) return;
    studioAudio.playLockIn();
    wsClient.send({
      type: 'player:answer',
      pin: room.pin,
      optionIndex,
    });
  }

  sendPlayerReaction(emoji: string): void {
    const room = this.state.playerSession.roomState;
    if (!room) return;
    wsClient.send({
      type: 'player:reaction',
      pin: room.pin,
      emoji,
    });
  }

  leavePlayerRoom(): void {
    this.setState((prev) => ({
      ...prev,
      playerSession: {
        ...prev.playerSession,
        playerId: null,
        sessionToken: null,
        roomState: null,
        me: null,
        error: null,
        joining: false,
      },
    }));
  }

  async refreshMatchHistory(): Promise<void> {
    try {
      const history = await fetchMatchHistory();
      this.setState((prev) => ({ ...prev, matchHistory: history }));
    } catch {
      // ignore transient errors
    }
  }

  async deleteMatchHistory(id: string): Promise<void> {
    await deleteMatchHistoryRecord(id);
    this.setState((prev) => ({
      ...prev,
      matchHistory: prev.matchHistory.filter((item) => item.id !== id),
    }));
    this.showToast('Partida eliminada del historial.');
  }

  startPractice(quizId: string): void {
    const quiz = this.state.quizzes.find((q) => q.id === quizId);
    if (!quiz) {
      this.showToast('No se encontró el cuestionario seleccionado.');
      return;
    }
    studioAudio.playQuestionStart();
    this.setState((prev) => ({
      ...prev,
      route: 'practice',
      practiceSession: startPracticeSession(quiz),
    }));
  }

  answerPractice(optionIndex: number): void {
    const current = this.state.practiceSession;
    if (!current || current.phase !== 'PLAYING') return;
    const next = answerPracticeQuestion(current, optionIndex);
    const latest = next.records[next.records.length - 1];
    if (latest?.isCorrect) {
      studioAudio.playCorrectAnswer();
    } else {
      studioAudio.playWrong();
    }
    this.setState((prev) => ({
      ...prev,
      practiceSession: next,
    }));
  }

  timeoutPractice(): void {
    const current = this.state.practiceSession;
    if (!current || current.phase !== 'PLAYING') return;
    studioAudio.playWrong();
    this.setState((prev) => ({
      ...prev,
      practiceSession: timeoutPracticeQuestion(current),
    }));
  }

  advancePractice(): void {
    const current = this.state.practiceSession;
    if (!current || current.phase !== 'FEEDBACK') return;
    const next = advancePracticeSession(current);
    if (next.phase === 'SUMMARY') {
      studioAudio.playFinalPodiumReveal();
    } else {
      studioAudio.playQuestionStart();
    }
    this.setState((prev) => ({
      ...prev,
      practiceSession: next,
    }));
  }

  exitPractice(): void {
    this.setState((prev) => ({
      ...prev,
      practiceSession: null,
    }));
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    studioAudio.installAutoUnlock();

    wsClient.subscribeConnection((connected) => {
      this.setState((prev) => ({ ...prev, wsConnected: connected }));
      const { hostSession, playerSession } = this.state;
      if (connected && hostSession.pin && hostSession.hostToken) {
        wsClient.send({
          type: 'host:reconnect',
          pin: hostSession.pin,
          hostToken: hostSession.hostToken,
        });
      }
      if (connected && playerSession.pin && playerSession.sessionToken) {
        wsClient.send({
          type: 'player:join',
          pin: playerSession.pin,
          nickname: playerSession.nickname,
          avatar: playerSession.avatar,
          sessionToken: playerSession.sessionToken,
        });
      }
    });

    wsClient.subscribe((msg) => {
      switch (msg.type) {
        case 'room:created':
          studioAudio.playPlayerJoined();
          this.setState((prev) => ({
            ...prev,
            route: 'host',
            lastHostPhase: msg.state.phase,
            hostReactions: [],
            hostSession: {
              pin: msg.pin,
              hostToken: msg.hostToken,
              roomState: msg.state,
              copiedNotice: null,
              error: null,
            },
          }));
          break;

        case 'player:joined':
          studioAudio.playPlayerJoined();
          this.setState((prev) => ({
            ...prev,
            route: 'join',
            lastPlayerPhase: msg.state.phase,
            playerSession: {
              ...prev.playerSession,
              playerId: msg.playerId,
              sessionToken: msg.sessionToken,
              roomState: msg.state,
              me: msg.me,
              error: null,
              joining: false,
            },
          }));
          break;

        case 'room:state':
          this.setState((prev) => {
            let next = prev;

            if (prev.hostSession.pin === msg.state.pin) {
              const prevCount = prev.hostSession.roomState?.players.length ?? 0;
              if (msg.state.players.length > prevCount) {
                studioAudio.playPlayerJoined();
              }
              if (prev.lastHostPhase !== msg.state.phase) {
                if (msg.state.phase === 'QUESTION') studioAudio.playQuestionStart();
                if (
                  msg.state.phase === 'REVEAL' &&
                  msg.state.revealData &&
                  (msg.state.revealData.counts[msg.state.revealData.correctIndex] ?? 0) > 0
                ) {
                  studioAudio.playCorrectAnswer();
                }
                if (msg.state.phase === 'PODIUM') {
                  studioAudio.playFinalPodiumReveal();
                  void this.refreshMatchHistory();
                }
              }
              next = {
                ...next,
                lastHostPhase: msg.state.phase,
                hostSession: {
                  ...next.hostSession,
                  roomState: msg.state,
                  error: null,
                },
              };
            }

            if (
              prev.playerSession.playerId &&
              prev.playerSession.pin === msg.state.pin
            ) {
              if (prev.lastPlayerPhase !== msg.state.phase) {
                if (msg.state.phase === 'QUESTION') studioAudio.playQuestionStart();
                if (msg.state.phase === 'REVEAL') {
                  if (msg.me?.isCorrect) studioAudio.playCorrect();
                  else studioAudio.playWrong();
                }
                if (msg.state.phase === 'PODIUM') studioAudio.playPodium();
              }
              next = {
                ...next,
                lastPlayerPhase: msg.state.phase,
                playerSession: {
                  ...next.playerSession,
                  roomState: msg.state,
                  me: msg.me ?? next.playerSession.me,
                },
              };
            }

            return next;
          });
          break;

        case 'room:ranking':
          this.setState((prev) => {
            let next = prev;
            if (prev.hostSession.roomState && prev.hostSession.pin === msg.pin) {
              next = {
                ...next,
                hostSession: {
                  ...next.hostSession,
                  roomState: {
                    ...prev.hostSession.roomState,
                    ranking: msg.ranking,
                  },
                },
              };
            }
            if (prev.playerSession.roomState && prev.playerSession.pin === msg.pin) {
              next = {
                ...next,
                playerSession: {
                  ...next.playerSession,
                  roomState: {
                    ...prev.playerSession.roomState,
                    ranking: msg.ranking,
                  },
                },
              };
            }
            return next;
          });
          break;

        case 'room:reaction': {
          const item: HostFloatingReaction = {
            ...msg.reaction,
            leftPct: 10 + Math.random() * 80,
          };
          this.setState((prev) => ({
            ...prev,
            hostReactions: [...prev.hostReactions.slice(-14), item],
          }));
          setTimeout(() => {
            this.setState((prev) => ({
              ...prev,
              hostReactions: prev.hostReactions.filter((r) => r.id !== item.id),
            }));
          }, 2500);
          break;
        }

        case 'room:closed':
          if (this.state.route === 'join') {
            this.setState((prev) => ({
              ...prev,
              playerSession: {
                ...prev.playerSession,
                playerId: null,
                sessionToken: null,
                roomState: null,
                me: null,
                error: msg.reason,
              },
            }));
          } else if (this.state.route === 'host') {
            if (this.state.hostSession.pin) {
              this.showToast(msg.reason);
            }
            this.setState((prev) => ({
              ...prev,
              route: 'host',
              hostReactions: [],
              hostSession: {
                pin: null,
                hostToken: null,
                roomState: null,
                copiedNotice: null,
                error: null,
              },
            }));
            void this.refreshMatchHistory();
          }
          break;

        case 'error':
          if (this.state.route === 'join') {
            this.setState((prev) => ({
              ...prev,
              playerSession: {
                ...prev.playerSession,
                joining: false,
                error: msg.message,
              },
            }));
          } else if (this.state.route === 'host') {
            this.setState((prev) => ({
              ...prev,
              hostSession: {
                ...prev.hostSession,
                error: msg.message,
              },
            }));
          } else {
            this.showToast(msg.message);
          }
          break;
      }
    });

    wsClient.connect();
    void this.bootstrap();
  }

  private async bootstrap(): Promise<void> {
    const [quizzesResult, visitorResult, historyResult] = await Promise.allSettled([
      fetchQuizzes(),
      fetchVisitorHit(),
      fetchMatchHistory(),
    ]);

    this.setState((prev) => ({
      ...prev,
      quizzes:
        quizzesResult.status === 'fulfilled' ? quizzesResult.value : prev.quizzes,
      visitorFormatted:
        visitorResult.status === 'fulfilled'
          ? visitorResult.value.formatted
          : prev.visitorFormatted,
      matchHistory:
        historyResult.status === 'fulfilled'
          ? historyResult.value
          : prev.matchHistory,
    }));
  }
}

export const appStore = new CentralizedAppStore();
export type { PointsMode };

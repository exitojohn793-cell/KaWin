/**
 * Modelos centrales de datos y lógica pura de puntuación y ranking de KaWin
 * compartidos entre el servidor (Express + Socket.IO) y el cliente.
 */

export type QuizCategory = 'Educación' | 'Empresas' | 'Eventos' | 'General';
export type CategoriaCuestionario = QuizCategory;

export type PointsMode = 'standard' | 'double' | 'none';
export type ModoPuntos = PointsMode;

/** Pregunta individual perteneciente a un cuestionario */
export interface Question {
  id: string;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  timeLimitSec: number;
  pointsMode: PointsMode;
}
export type QuizQuestion = Question;
export type PreguntaCuestionario = Question;

/** Estructura persistente de un Cuestionario */
export interface Quiz {
  id: string;
  title: string;
  description: string;
  category: QuizCategory;
  createdAt: string;
  updatedAt: string;
  questions: Question[];
}
export type Cuestionario = Quiz;

/** Ciclo de vida principal de una partida en español */
export type GameLifecycleStage = 'espera' | 'preguntando' | 'podio';

/** Fases detalladas de una Partida en vivo */
export type RoomPhase = 'LOBBY' | 'QUESTION' | 'REVEAL' | 'LEADERBOARD' | 'PODIUM';
export type EstadoPartida = RoomPhase;

/** Ajustes configurables por el presentador antes de iniciar */
export interface RoomSettings {
  speedBonus: boolean;
  streakBonus: boolean;
  teamMode: boolean;
}
export type ConfiguracionPartida = RoomSettings;

/** Entrada para calcular la puntuación por precisión y tiempo de reacción */
export interface ScoreCalculationInput {
  isCorrect: boolean;
  pointsMode: PointsMode;
  responseTimeMs: number;
  timeLimitSec: number;
  speedBonus: boolean;
  streakBonus: boolean;
  currentStreak: number;
}

/** Desglose transparente de puntos obtenidos en una respuesta */
export interface ScoreBreakdown {
  basePoints: number;
  speedBonusPoints: number;
  streakBonusPoints: number;
  totalPoints: number;
  /** Proporción de tiempo restante (0.0 a 1.0) según tiempo de reacción */
  reactionRatio: number;
}

/** Registro de respuesta de un jugador en la ronda actual */
export interface PlayerAnswerRecord {
  optionIndex: number;
  responseTimeMs: number;
  isCorrect: boolean;
  pointsEarned: number;
  breakdown?: ScoreBreakdown;
}
export type RespuestaJugador = PlayerAnswerRecord;

/** Representación pública de un Jugador dentro de una sala/partida */
export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  teamName?: string | null;
  score: number;
  lastRoundPoints: number;
  streak: number;
  rank: number;
  previousRank: number;
  connected: boolean;
  answeredCurrent: boolean;
  correctCount: number;
  totalResponseMs: number;
}
export type PlayerPublic = Player;
export type Jugador = Player;

/** Clasificación agregada de un equipo en Modo Equipos */
export interface TeamStanding {
  teamName: string;
  rank: number;
  previousRank: number;
  score: number;
  lastRoundPoints: number;
  correctCount: number;
  memberCount: number;
  connectedCount: number;
  answeredCount: number;
  totalResponseMs: number;
  memberNicknames: string[];
}
export type ClasificacionEquipo = TeamStanding;

/** Entrada compacta del ranking en tiempo real */
export interface RankingEntry {
  playerId: string;
  nickname: string;
  avatar: string;
  teamName?: string | null;
  rank: number;
  previousRank: number;
  score: number;
  lastRoundPoints: number;
  streak: number;
  correctCount: number;
  totalResponseMs: number;
  connected: boolean;
}

/** Estado privado enviado al jugador individual tras responder o finalizar ronda */
export interface PlayerPrivateFeedback {
  answered: boolean;
  selectedIndex: number | null;
  isCorrect: boolean | null;
  pointsEarned: number;
  streak: number;
  rank: number;
  totalScore: number;
  teamName?: string | null;
  teamScore?: number;
  teamRank?: number;
}
export type FeedbackJugador = PlayerPrivateFeedback;

/** Resumen estadístico de cada pregunta para el presentador e informes CSV/JSON */
export interface QuestionSummaryStat {
  questionIndex: number;
  prompt: string;
  correctIndex: number;
  counts: [number, number, number, number];
  correctCount: number;
  totalAnswers: number;
  avgResponseMs: number;
}
export type EstadisticaPregunta = QuestionSummaryStat;

/** Snapshot del estado de juego de una partida activa */
export interface GameState {
  stage: GameLifecycleStage;
  phase: RoomPhase;
  questionIndex: number;
  totalQuestions: number;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  currentQuestion: {
    id: string;
    prompt: string;
    options: [string, string, string, string];
    timeLimitSec: number;
    pointsMode: PointsMode;
  } | null;
  revealData: {
    correctIndex: number;
    counts: [number, number, number, number];
    totalAnswers: number;
  } | null;
}

/** Estado público completo de una Sala / Partida (incluye PIN, estado de juego, jugadores, equipos y ranking en vivo) */
export interface Room {
  pin: string;
  quizId: string;
  quizTitle: string;
  gameState: GameLifecycleStage;
  phase: RoomPhase;
  settings: RoomSettings;
  questionIndex: number;
  totalQuestions: number;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  currentQuestion: GameState['currentQuestion'];
  revealData: GameState['revealData'];
  players: Player[];
  teams: TeamStanding[];
  ranking: RankingEntry[];
  questionStats: QuestionSummaryStat[];
  serverTime: number;
}
export type RoomPublicState = Room;
export type Partida = Room;

/** Convierte una fase detallada del servidor al estado de ciclo de vida ('espera' | 'preguntando' | 'podio') */
export function mapPhaseToLifecycleStage(phase: RoomPhase): GameLifecycleStage {
  if (phase === 'LOBBY') return 'espera';
  if (phase === 'PODIUM') return 'podio';
  return 'preguntando';
}

/**
 * Calcula la puntuación detallada combinando precisión (acierto/error),
 * tiempo de reacción respecto al límite y multiplicador por racha.
 */
export function calculateScoreBreakdown(
  input: ScoreCalculationInput
): ScoreBreakdown {
  const totalMs = Math.max(1000, input.timeLimitSec * 1000);
  const clampedElapsed = Math.min(Math.max(0, input.responseTimeMs), totalMs);
  const reactionRatio = (totalMs - clampedElapsed) / totalMs;

  if (!input.isCorrect || input.pointsMode === 'none') {
    return {
      basePoints: 0,
      speedBonusPoints: 0,
      streakBonusPoints: 0,
      totalPoints: 0,
      reactionRatio,
    };
  }

  const maxBase = input.pointsMode === 'double' ? 2000 : 1000;
  // Precisión garantizada: mínimo 55% de los puntos base al acertar, más hasta 45% por rapidez
  const totalTimedPoints = input.speedBonus
    ? Math.round(maxBase * (0.55 + 0.45 * reactionRatio))
    : maxBase;
  const basePoints = input.speedBonus ? Math.round(maxBase * 0.55) : maxBase;
  const speedBonusPoints = Math.max(0, totalTimedPoints - basePoints);

  let streakBonusPoints = 0;
  if (input.streakBonus && input.currentStreak >= 2) {
    const extraStreak = Math.min(input.currentStreak - 1, 5) * 100;
    streakBonusPoints =
      input.pointsMode === 'double' ? extraStreak * 2 : extraStreak;
  }

  return {
    basePoints,
    speedBonusPoints,
    streakBonusPoints,
    totalPoints: basePoints + speedBonusPoints + streakBonusPoints,
    reactionRatio,
  };
}

/** Devuelve el total de puntos ganados según precisión y tiempo de reacción */
export function calculatePoints(input: ScoreCalculationInput): number {
  return calculateScoreBreakdown(input).totalPoints;
}

/**
 * Ordena a los jugadores por puntuación descendente, luego mayor cantidad de aciertos
 * y menor tiempo de reacción acumulado (desempate por rapidez).
 */
export function computeRankings(players: Player[]): Player[] {
  const sorted = [...players].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (a.totalResponseMs !== b.totalResponseMs) {
      return a.totalResponseMs - b.totalResponseMs;
    }
    return a.nickname.localeCompare(b.nickname, 'es');
  });

  return sorted.map((player, idx) => ({
    ...player,
    rank: idx + 1,
  }));
}

/** Construye la lista ordenada del ranking en tiempo real para emitir por Socket.IO */
export function buildLiveRanking(players: Player[]): RankingEntry[] {
  return computeRankings(players).map((p) => ({
    playerId: p.id,
    nickname: p.nickname,
    avatar: p.avatar,
    teamName: p.teamName ?? null,
    rank: p.rank,
    previousRank: p.previousRank,
    score: p.score,
    lastRoundPoints: p.lastRoundPoints,
    streak: p.streak,
    correctCount: p.correctCount,
    totalResponseMs: p.totalResponseMs,
    connected: p.connected,
  }));
}

/**
 * Agrega puntuación, aciertos y métricas colaborativas por equipo (case-insensitive)
 * y ordena el ranking de equipos por puntos desc, aciertos desc y rapidez acumulada.
 */
export function computeTeamStandings(
  players: Player[],
  previousRanks?: Map<string, number>
): TeamStanding[] {
  const buckets = new Map<
    string,
    {
      teamName: string;
      score: number;
      lastRoundPoints: number;
      correctCount: number;
      memberCount: number;
      connectedCount: number;
      answeredCount: number;
      totalResponseMs: number;
      memberNicknames: string[];
    }
  >();

  for (const player of players) {
    const rawTeam = (player.teamName ?? '').trim();
    const displayTeam = rawTeam || 'Sin equipo';
    const key = displayTeam.toLowerCase();
    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        teamName: displayTeam,
        score: player.score,
        lastRoundPoints: player.lastRoundPoints,
        correctCount: player.correctCount,
        memberCount: 1,
        connectedCount: player.connected ? 1 : 0,
        answeredCount: player.answeredCurrent ? 1 : 0,
        totalResponseMs: player.totalResponseMs,
        memberNicknames: [player.nickname],
      });
    } else {
      existing.score += player.score;
      existing.lastRoundPoints += player.lastRoundPoints;
      existing.correctCount += player.correctCount;
      existing.memberCount += 1;
      if (player.connected) existing.connectedCount += 1;
      if (player.answeredCurrent) existing.answeredCount += 1;
      existing.totalResponseMs += player.totalResponseMs;
      existing.memberNicknames.push(player.nickname);
    }
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    if (a.totalResponseMs !== b.totalResponseMs) {
      return a.totalResponseMs - b.totalResponseMs;
    }
    return a.teamName.localeCompare(b.teamName, 'es');
  });

  return sorted.map((team, idx) => {
    const rank = idx + 1;
    const prev = previousRanks?.get(team.teamName.toLowerCase()) ?? rank;
    return {
      ...team,
      rank,
      previousRank: prev,
    };
  });
}

/** Registro histórico persistente de una partida finalizada para el dashboard del presentador */
export interface FinishedMatchRecord {
  id: string;
  pin: string;
  quizId: string;
  quizTitle: string;
  finishedAt: string;
  totalQuestions: number;
  playerCount: number;
  teamMode?: boolean;
  winnerNickname: string | null;
  winnerAvatar: string | null;
  winnerScore: number;
  players: Player[];
  teams?: TeamStanding[];
  questionStats: QuestionSummaryStat[];
}
export type HistorialPartida = FinishedMatchRecord;

/** Construye un registro histórico inmutable al finalizar una partida en el podio */
export function buildFinishedMatchRecord(params: {
  id: string;
  pin: string;
  quizId: string;
  quizTitle: string;
  finishedAt: string;
  totalQuestions: number;
  teamMode?: boolean;
  players: Player[];
  questionStats: QuestionSummaryStat[];
}): FinishedMatchRecord {
  const ranked = computeRankings(params.players);
  const teamMode = Boolean(params.teamMode);
  const teams = teamMode ? computeTeamStandings(ranked) : [];
  const winner = ranked[0] ?? null;
  const winningTeam = teams[0] ?? null;

  return {
    id: params.id,
    pin: params.pin,
    quizId: params.quizId,
    quizTitle: params.quizTitle,
    finishedAt: params.finishedAt,
    totalQuestions: params.totalQuestions,
    playerCount: ranked.length,
    teamMode,
    winnerNickname: teamMode && winningTeam
      ? `${winningTeam.teamName} (Equipo)`
      : winner
        ? winner.nickname
        : null,
    winnerAvatar: teamMode && winningTeam
      ? '🤝'
      : winner
        ? winner.avatar
        : null,
    winnerScore: teamMode && winningTeam ? winningTeam.score : winner ? winner.score : 0,
    players: ranked,
    teams,
    questionStats: params.questionStats.map((qs) => ({
      ...qs,
      counts: [...qs.counts] as [number, number, number, number],
    })),
  };
}

/** Evento efímero de reacción en vivo enviado por los jugadores al presentador */
export interface ReactionEventPayload {
  id: string;
  nickname: string;
  emoji: string;
}

/** Metadatos asociados a cada conexión Socket.IO */
export interface SocketClientMeta {
  role: 'host' | 'player' | null;
  pin: string | null;
  playerId: string | null;
}

/** Mensajes emitidos por los clientes hacia el servidor Socket.IO */
export type WsClientMessage =
  | { type: 'host:create'; quizId: string; settings?: Partial<RoomSettings> }
  | { type: 'host:reconnect'; pin: string; hostToken: string }
  | { type: 'host:updateSettings'; pin: string; settings: Partial<RoomSettings> }
  | { type: 'host:startGame'; pin: string }
  | { type: 'host:endQuestionNow'; pin: string }
  | { type: 'host:nextPhase'; pin: string }
  | { type: 'host:setStage'; pin: string; stage: GameLifecycleStage }
  | { type: 'host:restartRoom'; pin: string }
  | { type: 'host:closeRoom'; pin: string }
  | { type: 'player:join'; pin: string; nickname: string; avatar?: string; sessionToken?: string; teamName?: string }
  | { type: 'player:answer'; pin: string; optionIndex: number }
  | { type: 'player:reaction'; pin: string; emoji: string };

/** Mensajes emitidos por el servidor Socket.IO hacia los clientes */
export type WsServerMessage =
  | { type: 'room:created'; pin: string; hostToken: string; state: Room }
  | { type: 'player:joined'; playerId: string; sessionToken: string; state: Room; me: PlayerPrivateFeedback }
  | { type: 'room:state'; state: Room; me?: PlayerPrivateFeedback }
  | { type: 'room:ranking'; pin: string; ranking: RankingEntry[] }
  | { type: 'room:reaction'; reaction: ReactionEventPayload }
  | { type: 'room:closed'; reason: string }
  | { type: 'error'; code: string; message: string };

/** Mapa tipado de eventos Socket.IO Cliente -> Servidor */
export interface ClientToServerEvents {
  'host:create': (payload: { quizId: string; settings?: Partial<RoomSettings> }) => void;
  'host:reconnect': (payload: { pin: string; hostToken: string }) => void;
  'host:updateSettings': (payload: { pin: string; settings: Partial<RoomSettings> }) => void;
  'host:startGame': (payload: { pin: string }) => void;
  'host:endQuestionNow': (payload: { pin: string }) => void;
  'host:nextPhase': (payload: { pin: string }) => void;
  'host:setStage': (payload: { pin: string; stage: GameLifecycleStage }) => void;
  'host:restartRoom': (payload: { pin: string }) => void;
  'host:closeRoom': (payload: { pin: string }) => void;
  'player:join': (payload: {
    pin: string;
    nickname: string;
    avatar?: string;
    sessionToken?: string;
    teamName?: string;
  }) => void;
  'player:answer': (payload: { pin: string; optionIndex: number }) => void;
  'player:reaction': (payload: { pin: string; emoji: string }) => void;
}

/** Mapa tipado de eventos Socket.IO Servidor -> Cliente */
export interface ServerToClientEvents {
  'room:created': (payload: { pin: string; hostToken: string; state: Room }) => void;
  'player:joined': (payload: {
    playerId: string;
    sessionToken: string;
    state: Room;
    me: PlayerPrivateFeedback;
  }) => void;
  'room:state': (payload: { state: Room; me?: PlayerPrivateFeedback }) => void;
  'room:ranking': (payload: { pin: string; ranking: RankingEntry[] }) => void;
  'room:reaction': (payload: { reaction: ReactionEventPayload }) => void;
  'room:closed': (payload: { reason: string }) => void;
  error: (payload: { code: string; message: string }) => void;
}

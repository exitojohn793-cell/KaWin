import crypto from 'node:crypto';
import {
  type FinishedMatchRecord,
  type GameLifecycleStage,
  type Player,
  type PlayerAnswerRecord,
  type PlayerPrivateFeedback,
  type QuestionSummaryStat,
  type Quiz,
  type RankingEntry,
  type ReactionEventPayload,
  type Room,
  type RoomPhase,
  type RoomSettings,
  buildFinishedMatchRecord,
  buildLiveRanking,
  calculateScoreBreakdown,
  computeRankings,
  computeTeamStandings,
  mapPhaseToLifecycleStage,
} from '../models.ts';
import {
  AVATAR_OPTIONS,
  generatePin,
} from '../src/shared/scoring.ts';

interface InternalPlayer {
  id: string;
  sessionToken: string;
  nickname: string;
  avatar: string;
  teamName: string | null;
  score: number;
  lastRoundPoints: number;
  streak: number;
  rank: number;
  previousRank: number;
  connected: boolean;
  correctCount: number;
  totalResponseMs: number;
  currentAnswer: PlayerAnswerRecord | null;
}

interface InternalRoom {
  pin: string;
  hostToken: string;
  quiz: Quiz;
  phase: RoomPhase;
  settings: RoomSettings;
  questionIndex: number;
  questionStartedAt: number | null;
  questionEndsAt: number | null;
  questionStats: QuestionSummaryStat[];
  players: Map<string, InternalPlayer>;
  previousTeamRanks: Map<string, number>;
  timerHandle: ReturnType<typeof setTimeout> | null;
  lastActivityAt: number;
  historySaved: boolean;
}

export interface RoomBroadcaster {
  onStateChange: (pin: string) => void;
  onRankingUpdate?: (pin: string, ranking: RankingEntry[]) => void;
  onReaction: (pin: string, reaction: ReactionEventPayload) => void;
  onRoomClosed: (pin: string, reason: string) => void;
  onMatchFinished?: (record: FinishedMatchRecord) => void;
}

export class GameManager {
  private readonly rooms = new Map<string, InternalRoom>();
  private readonly broadcaster: RoomBroadcaster;

  constructor(broadcaster: RoomBroadcaster) {
    this.broadcaster = broadcaster;
  }

  createRoom(quiz: Quiz, settings?: Partial<RoomSettings>): {
    pin: string;
    hostToken: string;
    state: Room;
  } {
    const existingPins = new Set(this.rooms.keys());
    const pin = generatePin(existingPins);
    const hostToken = crypto.randomBytes(16).toString('hex');

    const room: InternalRoom = {
      pin,
      hostToken,
      quiz: structuredClone(quiz),
      phase: 'LOBBY',
      settings: {
        speedBonus: settings?.speedBonus ?? true,
        streakBonus: settings?.streakBonus ?? true,
        teamMode: settings?.teamMode ?? false,
      },
      questionIndex: 0,
      questionStartedAt: null,
      questionEndsAt: null,
      questionStats: [],
      players: new Map(),
      previousTeamRanks: new Map(),
      timerHandle: null,
      lastActivityAt: Date.now(),
      historySaved: false,
    };

    this.rooms.set(pin, room);
    return {
      pin,
      hostToken,
      state: this.toPublicState(room),
    };
  }

  hasRoom(pin: string): boolean {
    return this.rooms.has(pin);
  }

  getRoomSummary(pin: string): {
    exists: boolean;
    teamMode: boolean;
    teams: string[];
    quizTitle?: string;
  } {
    const room = this.rooms.get(pin);
    if (!room) {
      return { exists: false, teamMode: false, teams: [] };
    }
    const seen = new Map<string, string>();
    for (const p of room.players.values()) {
      const clean = (p.teamName ?? '').trim();
      if (clean && !seen.has(clean.toLowerCase())) {
        seen.set(clean.toLowerCase(), clean);
      }
    }
    return {
      exists: true,
      teamMode: room.settings.teamMode,
      teams: Array.from(seen.values()),
      quizTitle: room.quiz.title,
    };
  }

  verifyHost(pin: string, hostToken: string): boolean {
    const room = this.rooms.get(pin);
    return Boolean(room && room.hostToken === hostToken);
  }

  updateSettings(pin: string, settings: Partial<RoomSettings>): Room {
    const room = this.requireRoom(pin);
    if (typeof settings.speedBonus === 'boolean') {
      room.settings.speedBonus = settings.speedBonus;
    }
    if (typeof settings.streakBonus === 'boolean') {
      room.settings.streakBonus = settings.streakBonus;
    }
    if (typeof settings.teamMode === 'boolean' && room.phase === 'LOBBY') {
      room.settings.teamMode = settings.teamMode;
    }
    room.lastActivityAt = Date.now();
    this.broadcaster.onStateChange(pin);
    return this.toPublicState(room);
  }

  joinPlayer(
    pin: string,
    rawNickname: string,
    rawAvatar?: string,
    sessionToken?: string,
    rawTeamName?: string
  ): {
    playerId: string;
    sessionToken: string;
    state: Room;
    me: PlayerPrivateFeedback;
  } {
    const room = this.requireRoom(pin);
    room.lastActivityAt = Date.now();

    const canonicalizeTeamName = (input?: string): string | null => {
      const cleaned = (input ?? '').trim().slice(0, 24);
      if (!cleaned) return null;
      for (const existing of room.players.values()) {
        if (
          existing.teamName &&
          existing.teamName.toLowerCase() === cleaned.toLowerCase()
        ) {
          return existing.teamName;
        }
      }
      return cleaned;
    };

    if (sessionToken) {
      for (const existing of room.players.values()) {
        if (existing.sessionToken === sessionToken) {
          existing.connected = true;
          if (room.phase === 'LOBBY') {
            const nextTeam = canonicalizeTeamName(rawTeamName);
            if (nextTeam) existing.teamName = nextTeam;
          }
          this.recomputeRanks(room);
          this.broadcaster.onStateChange(pin);
          return {
            playerId: existing.id,
            sessionToken: existing.sessionToken,
            state: this.toPublicState(room),
            me: this.getPlayerPrivateFeedback(room, existing.id),
          };
        }
      }
    }

    const nickname = rawNickname.trim().slice(0, 20);
    if (nickname.length < 1) {
      throw new Error('El apodo no puede estar vacío.');
    }

    const duplicate = Array.from(room.players.values()).some(
      (p) => p.nickname.toLowerCase() === nickname.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`El apodo "${nickname}" ya está en uso en esta sala.`);
    }

    const teamName = canonicalizeTeamName(rawTeamName);
    if (room.settings.teamMode && !teamName) {
      throw new Error(
        'Esta sala está en Modo Equipos: elige o escribe el nombre de tu equipo.'
      );
    }

    const avatar =
      rawAvatar && (AVATAR_OPTIONS as readonly string[]).includes(rawAvatar)
        ? rawAvatar
        : AVATAR_OPTIONS[room.players.size % AVATAR_OPTIONS.length];

    const playerId = `pl_${crypto.randomBytes(8).toString('hex')}`;
    const newSessionToken = crypto.randomBytes(16).toString('hex');

    const player: InternalPlayer = {
      id: playerId,
      sessionToken: newSessionToken,
      nickname,
      avatar,
      teamName,
      score: 0,
      lastRoundPoints: 0,
      streak: 0,
      rank: room.players.size + 1,
      previousRank: room.players.size + 1,
      connected: true,
      correctCount: 0,
      totalResponseMs: 0,
      currentAnswer: null,
    };

    room.players.set(playerId, player);
    this.recomputeRanks(room);
    this.broadcaster.onStateChange(pin);

    return {
      playerId,
      sessionToken: newSessionToken,
      state: this.toPublicState(room),
      me: this.getPlayerPrivateFeedback(room, playerId),
    };
  }

  setPlayerDisconnected(pin: string, playerId: string): void {
    const room = this.rooms.get(pin);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;
    player.connected = false;
    this.broadcaster.onStateChange(pin);
  }

  startGame(pin: string): Room {
    const room = this.requireRoom(pin);
    if (room.quiz.questions.length === 0) {
      throw new Error('El cuestionario no tiene preguntas.');
    }
    room.questionIndex = 0;
    room.questionStats = [];
    room.previousTeamRanks = new Map();
    room.historySaved = false;
    for (const player of room.players.values()) {
      player.score = 0;
      player.lastRoundPoints = 0;
      player.streak = 0;
      player.correctCount = 0;
      player.totalResponseMs = 0;
      player.previousRank = 1;
      player.rank = 1;
      player.currentAnswer = null;
    }
    this.startQuestion(room);
    return this.toPublicState(room);
  }

  restartRoom(pin: string): Room {
    const room = this.requireRoom(pin);
    this.clearRoomTimer(room);
    room.phase = 'LOBBY';
    room.questionIndex = 0;
    room.questionStartedAt = null;
    room.questionEndsAt = null;
    room.questionStats = [];
    room.previousTeamRanks = new Map();
    room.historySaved = false;
    for (const player of room.players.values()) {
      player.score = 0;
      player.lastRoundPoints = 0;
      player.streak = 0;
      player.correctCount = 0;
      player.totalResponseMs = 0;
      player.previousRank = 1;
      player.rank = 1;
      player.currentAnswer = null;
    }
    room.lastActivityAt = Date.now();
    this.broadcaster.onStateChange(pin);
    return this.toPublicState(room);
  }

  submitAnswer(
    pin: string,
    playerId: string,
    optionIndex: number,
    nowMs = Date.now()
  ): Room {
    const room = this.requireRoom(pin);
    if (room.phase !== 'QUESTION') {
      throw new Error('No hay una pregunta activa en este momento.');
    }
    const player = room.players.get(playerId);
    if (!player) {
      throw new Error('Jugador no encontrado en la sala.');
    }
    if (player.currentAnswer !== null) {
      return this.toPublicState(room);
    }
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
      throw new Error('Opción inválida.');
    }

    const question = room.quiz.questions[room.questionIndex];
    const startedAt = room.questionStartedAt ?? nowMs;
    const responseTimeMs = Math.max(0, nowMs - startedAt);
    const isCorrect = optionIndex === question.correctIndex;
    const nextStreak = isCorrect ? player.streak + 1 : 0;

    const breakdown = calculateScoreBreakdown({
      isCorrect,
      pointsMode: question.pointsMode,
      responseTimeMs,
      timeLimitSec: question.timeLimitSec,
      speedBonus: room.settings.speedBonus,
      streakBonus: room.settings.streakBonus,
      currentStreak: nextStreak,
    });

    player.currentAnswer = {
      optionIndex,
      responseTimeMs,
      isCorrect,
      pointsEarned: breakdown.totalPoints,
      breakdown,
    };

    room.lastActivityAt = nowMs;

    const connectedPlayers = Array.from(room.players.values()).filter(
      (p) => p.connected
    );
    const allAnswered =
      connectedPlayers.length > 0 &&
      connectedPlayers.every((p) => p.currentAnswer !== null);

    if (allAnswered) {
      this.revealCurrentQuestion(room);
    } else {
      this.broadcaster.onStateChange(pin);
      this.broadcaster.onRankingUpdate?.(pin, this.computeLiveRanking(room));
    }

    return this.toPublicState(room);
  }

  endQuestionNow(pin: string): Room {
    const room = this.requireRoom(pin);
    if (room.phase === 'QUESTION') {
      this.revealCurrentQuestion(room);
    }
    return this.toPublicState(room);
  }

  nextPhase(pin: string): Room {
    const room = this.requireRoom(pin);
    const total = room.quiz.questions.length;

    if (room.phase === 'QUESTION') {
      this.revealCurrentQuestion(room);
      return this.toPublicState(room);
    }

    if (room.phase === 'REVEAL') {
      const isLast = room.questionIndex >= total - 1;
      room.phase = isLast ? 'PODIUM' : 'LEADERBOARD';
      room.lastActivityAt = Date.now();
      if (room.phase === 'PODIUM') {
        this.recordFinishedMatch(room);
      }
      this.broadcaster.onStateChange(pin);
      return this.toPublicState(room);
    }

    if (room.phase === 'LEADERBOARD') {
      if (room.questionIndex + 1 < total) {
        room.questionIndex += 1;
        this.startQuestion(room);
      } else {
        room.phase = 'PODIUM';
        this.recordFinishedMatch(room);
        this.broadcaster.onStateChange(pin);
      }
      return this.toPublicState(room);
    }

    return this.toPublicState(room);
  }

  /** Permite transicionar explícitamente entre los estados del ciclo de vida ('espera' | 'preguntando' | 'podio'). */
  setLifecycleStage(pin: string, stage: GameLifecycleStage): Room {
    const room = this.requireRoom(pin);
    if (stage === 'espera') {
      return this.restartRoom(pin);
    }
    if (stage === 'preguntando') {
      if (room.phase === 'LOBBY') {
        return this.startGame(pin);
      }
      return this.nextPhase(pin);
    }
    this.clearRoomTimer(room);
    room.phase = 'PODIUM';
    room.questionStartedAt = null;
    room.questionEndsAt = null;
    room.lastActivityAt = Date.now();
    this.recordFinishedMatch(room);
    this.broadcaster.onStateChange(pin);
    return this.toPublicState(room);
  }

  sendReaction(pin: string, playerId: string, emoji: string): void {
    const room = this.rooms.get(pin);
    if (!room) return;
    const player = room.players.get(playerId);
    if (!player) return;
    const allowed = new Set(['👏', '🔥', '⚡', '🎉', '🤯']);
    if (!allowed.has(emoji)) return;

    this.broadcaster.onReaction(pin, {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nickname: player.nickname,
      emoji,
    });
  }

  closeRoom(pin: string, reason = 'El presentador cerró la sala.'): void {
    const room = this.rooms.get(pin);
    if (!room) return;
    this.clearRoomTimer(room);
    this.rooms.delete(pin);
    this.broadcaster.onRoomClosed(pin, reason);
  }

  getPublicState(pin: string): Room | null {
    const room = this.rooms.get(pin);
    return room ? this.toPublicState(room) : null;
  }

  getLiveRanking(pin: string): RankingEntry[] {
    const room = this.rooms.get(pin);
    return room ? this.computeLiveRanking(room) : [];
  }

  getPlayerPrivateFeedback(
    roomOrPin: InternalRoom | string,
    playerId: string
  ): PlayerPrivateFeedback {
    const room =
      typeof roomOrPin === 'string' ? this.rooms.get(roomOrPin) : roomOrPin;
    if (!room) {
      return {
        answered: false,
        selectedIndex: null,
        isCorrect: null,
        pointsEarned: 0,
        streak: 0,
        rank: 0,
        totalScore: 0,
      };
    }
    const player = room.players.get(playerId);
    if (!player) {
      return {
        answered: false,
        selectedIndex: null,
        isCorrect: null,
        pointsEarned: 0,
        streak: 0,
        rank: 0,
        totalScore: 0,
      };
    }

    const showResult = room.phase !== 'QUESTION' && room.phase !== 'LOBBY';
    const teamStandings = room.settings.teamMode
      ? computeTeamStandings(this.toPublicPlayers(room), room.previousTeamRanks)
      : [];
    const myTeam = player.teamName
      ? teamStandings.find(
          (t) => t.teamName.toLowerCase() === player.teamName?.toLowerCase()
        )
      : undefined;

    return {
      answered: player.currentAnswer !== null,
      selectedIndex: player.currentAnswer?.optionIndex ?? null,
      isCorrect: showResult
        ? (player.currentAnswer?.isCorrect ?? false)
        : null,
      pointsEarned: showResult
        ? (player.currentAnswer?.pointsEarned ?? 0)
        : 0,
      streak: player.streak,
      rank: player.rank,
      totalScore: player.score,
      teamName: player.teamName,
      teamScore: myTeam?.score ?? player.score,
      teamRank: myTeam?.rank ?? player.rank,
    };
  }

  cleanupStaleRooms(maxIdleMs = 2 * 60 * 60 * 1000): void {
    const now = Date.now();
    for (const [pin, room] of this.rooms.entries()) {
      if (now - room.lastActivityAt > maxIdleMs) {
        this.closeRoom(pin, 'La sala expiró por inactividad.');
      }
    }
  }

  private startQuestion(room: InternalRoom): void {
    this.clearRoomTimer(room);
    const question = room.quiz.questions[room.questionIndex];
    const now = Date.now();
    const durationMs = question.timeLimitSec * 1000;

    if (room.settings.teamMode) {
      const currentTeams = computeTeamStandings(this.toPublicPlayers(room));
      room.previousTeamRanks = new Map(
        currentTeams.map((t) => [t.teamName.toLowerCase(), t.rank])
      );
    }

    room.phase = 'QUESTION';
    room.questionStartedAt = now;
    room.questionEndsAt = now + durationMs;
    room.lastActivityAt = now;

    for (const player of room.players.values()) {
      player.previousRank = player.rank;
      player.lastRoundPoints = 0;
      player.currentAnswer = null;
    }

    room.timerHandle = setTimeout(() => {
      if (this.rooms.has(room.pin) && room.phase === 'QUESTION') {
        this.revealCurrentQuestion(room);
      }
    }, durationMs);

    this.broadcaster.onStateChange(room.pin);
  }

  private revealCurrentQuestion(room: InternalRoom): void {
    this.clearRoomTimer(room);
    if (room.phase !== 'QUESTION') return;

    const question = room.quiz.questions[room.questionIndex];
    const counts: [number, number, number, number] = [0, 0, 0, 0];
    let totalAnswers = 0;
    let correctCount = 0;
    let totalResponseMs = 0;

    for (const player of room.players.values()) {
      player.previousRank = player.rank;
      if (player.currentAnswer) {
        totalAnswers += 1;
        counts[player.currentAnswer.optionIndex] += 1;
        totalResponseMs += player.currentAnswer.responseTimeMs;

        if (player.currentAnswer.isCorrect) {
          correctCount += 1;
          player.streak += 1;
          player.correctCount += 1;
          player.lastRoundPoints = player.currentAnswer.pointsEarned;
          player.score += player.currentAnswer.pointsEarned;
          player.totalResponseMs += player.currentAnswer.responseTimeMs;
        } else {
          player.streak = 0;
          player.lastRoundPoints = 0;
        }
      } else {
        player.streak = 0;
        player.lastRoundPoints = 0;
      }
    }

    this.recomputeRanks(room);

    room.questionStats.push({
      questionIndex: room.questionIndex,
      prompt: question.prompt,
      correctIndex: question.correctIndex,
      counts,
      correctCount,
      totalAnswers,
      avgResponseMs: totalAnswers > 0 ? totalResponseMs / totalAnswers : 0,
    });

    room.phase = 'REVEAL';
    room.lastActivityAt = Date.now();
    this.broadcaster.onStateChange(room.pin);
    this.broadcaster.onRankingUpdate?.(room.pin, this.computeLiveRanking(room));
  }

  private computeLiveRanking(room: InternalRoom): RankingEntry[] {
    const snapshot: Player[] = [];
    for (const player of room.players.values()) {
      const pending =
        room.phase === 'QUESTION' ? player.currentAnswer : null;
      snapshot.push({
        id: player.id,
        nickname: player.nickname,
        avatar: player.avatar,
        teamName: player.teamName,
        score: player.score + (pending?.pointsEarned ?? 0),
        lastRoundPoints: pending
          ? pending.pointsEarned
          : player.lastRoundPoints,
        streak: pending
          ? pending.isCorrect
            ? player.streak + 1
            : 0
          : player.streak,
        rank: player.rank,
        previousRank: player.previousRank,
        connected: player.connected,
        answeredCurrent: player.currentAnswer !== null,
        correctCount:
          player.correctCount + (pending?.isCorrect ? 1 : 0),
        totalResponseMs:
          player.totalResponseMs +
          (pending?.isCorrect ? pending.responseTimeMs : 0),
      });
    }
    return buildLiveRanking(snapshot);
  }

  private recomputeRanks(room: InternalRoom): void {
    const publicList = this.toPublicPlayers(room);
    const ranked = computeRankings(publicList);
    for (const item of ranked) {
      const player = room.players.get(item.id);
      if (player) {
        player.rank = item.rank;
      }
    }
  }

  private toPublicPlayers(room: InternalRoom): Player[] {
    const raw: Player[] = [];
    for (const player of room.players.values()) {
      raw.push({
        id: player.id,
        nickname: player.nickname,
        avatar: player.avatar,
        teamName: player.teamName,
        score: player.score,
        lastRoundPoints: player.lastRoundPoints,
        streak: player.streak,
        rank: player.rank,
        previousRank: player.previousRank,
        connected: player.connected,
        answeredCurrent: player.currentAnswer !== null,
        correctCount: player.correctCount,
        totalResponseMs: player.totalResponseMs,
      });
    }
    return computeRankings(raw);
  }

  private toPublicState(room: InternalRoom): Room {
    const q = room.quiz.questions[room.questionIndex] ?? null;
    const latestStat =
      room.phase === 'REVEAL' ||
      room.phase === 'LEADERBOARD' ||
      room.phase === 'PODIUM'
        ? room.questionStats[room.questionIndex] ?? null
        : null;
    const publicPlayers = this.toPublicPlayers(room);
    const teams = room.settings.teamMode
      ? computeTeamStandings(publicPlayers, room.previousTeamRanks)
      : [];

    return {
      pin: room.pin,
      quizId: room.quiz.id,
      quizTitle: room.quiz.title,
      gameState: mapPhaseToLifecycleStage(room.phase),
      phase: room.phase,
      settings: { ...room.settings },
      questionIndex: room.questionIndex,
      totalQuestions: room.quiz.questions.length,
      questionStartedAt: room.questionStartedAt,
      questionEndsAt: room.questionEndsAt,
      currentQuestion: q
        ? {
            id: q.id,
            prompt: q.prompt,
            options: [...q.options] as [string, string, string, string],
            timeLimitSec: q.timeLimitSec,
            pointsMode: q.pointsMode,
          }
        : null,
      revealData: latestStat
        ? {
            correctIndex: latestStat.correctIndex,
            counts: latestStat.counts,
            totalAnswers: latestStat.totalAnswers,
          }
        : null,
      players: publicPlayers,
      teams,
      ranking: this.computeLiveRanking(room),
      questionStats: [...room.questionStats],
      serverTime: Date.now(),
    };
  }

  private requireRoom(pin: string): InternalRoom {
    const room = this.rooms.get(pin);
    if (!room) {
      throw new Error(`No existe ninguna partida activa con el PIN ${pin}.`);
    }
    return room;
  }

  private clearRoomTimer(room: InternalRoom): void {
    if (room.timerHandle) {
      clearTimeout(room.timerHandle);
      room.timerHandle = null;
    }
  }

  private recordFinishedMatch(room: InternalRoom): void {
    if (room.historySaved) return;
    room.historySaved = true;
    const record = buildFinishedMatchRecord({
      id: `match_${Date.now().toString(36)}_${room.pin}_${crypto.randomBytes(3).toString('hex')}`,
      pin: room.pin,
      quizId: room.quiz.id,
      quizTitle: room.quiz.title,
      finishedAt: new Date().toISOString(),
      totalQuestions: room.quiz.questions.length,
      teamMode: room.settings.teamMode,
      players: this.toPublicPlayers(room),
      questionStats: room.questionStats,
    });
    this.broadcaster.onMatchFinished?.(record);
  }
}

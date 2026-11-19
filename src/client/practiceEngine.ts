import {
  type ScoreBreakdown,
  calculateScoreBreakdown,
} from '../shared/scoring.ts';
import type { Quiz } from '../shared/types.ts';

export type PracticePhase = 'PLAYING' | 'FEEDBACK' | 'SUMMARY';

export interface PracticeQuestionResult {
  questionIndex: number;
  prompt: string;
  options: [string, string, string, string];
  correctIndex: number;
  selectedIndex: number | null;
  timedOut: boolean;
  isCorrect: boolean;
  responseTimeMs: number;
  pointsEarned: number;
  breakdown: ScoreBreakdown;
}

export interface PracticeSessionState {
  quiz: Quiz;
  phase: PracticePhase;
  questionIndex: number;
  questionStartedAt: number;
  questionEndsAt: number;
  selectedIndex: number | null;
  totalScore: number;
  streak: number;
  bestStreak: number;
  correctCount: number;
  records: PracticeQuestionResult[];
}

export function startPracticeSession(
  quiz: Quiz,
  nowMs = Date.now()
): PracticeSessionState {
  if (!quiz.questions || quiz.questions.length === 0) {
    throw new Error('El cuestionario no tiene preguntas para practicar.');
  }
  const first = quiz.questions[0];
  return {
    quiz,
    phase: 'PLAYING',
    questionIndex: 0,
    questionStartedAt: nowMs,
    questionEndsAt: nowMs + first.timeLimitSec * 1000,
    selectedIndex: null,
    totalScore: 0,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    records: [],
  };
}

export function answerPracticeQuestion(
  session: PracticeSessionState,
  optionIndex: number,
  nowMs = Date.now()
): PracticeSessionState {
  if (session.phase !== 'PLAYING') return session;
  const question = session.quiz.questions[session.questionIndex];
  if (!question) return session;

  const responseTimeMs = Math.max(0, nowMs - session.questionStartedAt);
  const isCorrect = optionIndex === question.correctIndex;
  const nextStreak = isCorrect ? session.streak + 1 : 0;

  const breakdown = calculateScoreBreakdown({
    isCorrect,
    pointsMode: question.pointsMode,
    responseTimeMs,
    timeLimitSec: question.timeLimitSec,
    speedBonus: true,
    streakBonus: true,
    currentStreak: nextStreak,
  });

  const record: PracticeQuestionResult = {
    questionIndex: session.questionIndex,
    prompt: question.prompt,
    options: [...question.options] as [string, string, string, string],
    correctIndex: question.correctIndex,
    selectedIndex: optionIndex,
    timedOut: false,
    isCorrect,
    responseTimeMs,
    pointsEarned: breakdown.totalPoints,
    breakdown,
  };

  return {
    ...session,
    phase: 'FEEDBACK',
    selectedIndex: optionIndex,
    totalScore: session.totalScore + breakdown.totalPoints,
    streak: nextStreak,
    bestStreak: Math.max(session.bestStreak, nextStreak),
    correctCount: session.correctCount + (isCorrect ? 1 : 0),
    records: [...session.records, record],
  };
}

export function timeoutPracticeQuestion(
  session: PracticeSessionState
): PracticeSessionState {
  if (session.phase !== 'PLAYING') return session;
  const question = session.quiz.questions[session.questionIndex];
  if (!question) return session;

  const breakdown = calculateScoreBreakdown({
    isCorrect: false,
    pointsMode: question.pointsMode,
    responseTimeMs: question.timeLimitSec * 1000,
    timeLimitSec: question.timeLimitSec,
    speedBonus: true,
    streakBonus: true,
    currentStreak: 0,
  });

  const record: PracticeQuestionResult = {
    questionIndex: session.questionIndex,
    prompt: question.prompt,
    options: [...question.options] as [string, string, string, string],
    correctIndex: question.correctIndex,
    selectedIndex: null,
    timedOut: true,
    isCorrect: false,
    responseTimeMs: question.timeLimitSec * 1000,
    pointsEarned: 0,
    breakdown,
  };

  return {
    ...session,
    phase: 'FEEDBACK',
    selectedIndex: null,
    streak: 0,
    records: [...session.records, record],
  };
}

export function advancePracticeSession(
  session: PracticeSessionState,
  nowMs = Date.now()
): PracticeSessionState {
  if (session.phase !== 'FEEDBACK') return session;
  const nextIndex = session.questionIndex + 1;
  if (nextIndex >= session.quiz.questions.length) {
    return {
      ...session,
      phase: 'SUMMARY',
    };
  }

  const nextQ = session.quiz.questions[nextIndex];
  return {
    ...session,
    phase: 'PLAYING',
    questionIndex: nextIndex,
    questionStartedAt: nowMs,
    questionEndsAt: nowMs + nextQ.timeLimitSec * 1000,
    selectedIndex: null,
  };
}

import {
  buildLiveRanking,
  calculatePoints,
  calculateScoreBreakdown,
  computeRankings,
  type RankingEntry,
  type ScoreBreakdown,
  type ScoreCalculationInput,
} from '../../models.ts';
import type {
  PlayerPublic,
  PointsMode,
  QuestionSummaryStat,
  Quiz,
  QuizCategory,
  QuizQuestion,
} from './types.ts';

export {
  buildLiveRanking,
  calculatePoints,
  calculateScoreBreakdown,
  computeRankings,
  type RankingEntry,
  type ScoreBreakdown,
  type ScoreCalculationInput,
};

export const VISITOR_BASE_COUNT = 1000;

export const OPTION_META = [
  {
    index: 0,
    letter: 'A',
    label: 'Triángulo',
    bg: '#E11D48',
    hoverBg: '#BE123C',
    ring: '#FB7185',
  },
  {
    index: 1,
    letter: 'B',
    label: 'Rombo',
    bg: '#2563EB',
    hoverBg: '#1D4ED8',
    ring: '#60A5FA',
  },
  {
    index: 2,
    letter: 'C',
    label: 'Círculo',
    bg: '#D97706',
    hoverBg: '#B45309',
    ring: '#FBBF24',
  },
  {
    index: 3,
    letter: 'D',
    label: 'Cuadrado',
    bg: '#059669',
    hoverBg: '#047857',
    ring: '#34D399',
  },
] as const;

export const AVATAR_OPTIONS = [
  '⚡',
  '🦊',
  '🦁',
  '🚀',
  '💎',
  '🎯',
  '🔥',
  '🦉',
  '🐉',
  '🎧',
  '🌟',
  '🏆',
] as const;

export function formatVisitorCount(count: number): string {
  const safe = Math.max(VISITOR_BASE_COUNT, Math.floor(count));
  return String(safe).padStart(7, '0');
}

export function generatePin(existingPins: Set<string>): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    if (!existingPins.has(pin)) return pin;
  }
  return String(Date.now()).slice(-6);
}



function escapeCsvCell(value: string | number): string {
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildResultsCsv(
  quizTitle: string,
  pin: string,
  players: PlayerPublic[],
  questionStats: QuestionSummaryStat[]
): string {
  const lines: string[] = [];
  lines.push(
    ['KaWin - Informe Oficial de Partida', quizTitle, `PIN ${pin}`]
      .map(escapeCsvCell)
      .join(',')
  );
  lines.push('');
  lines.push(
    [
      'Puesto',
      'Jugador',
      'Puntuación Total',
      'Aciertos',
      'Racha Actual',
      'Tiempo Respuesta Acumulado (ms)',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  for (const p of computeRankings(players)) {
    lines.push(
      [
        p.rank,
        p.nickname,
        p.score,
        p.correctCount,
        p.streak,
        p.totalResponseMs,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  lines.push('');
  lines.push(
    [
      'Pregunta #',
      'Enunciado',
      'Opción Correcta',
      'Respuestas Totales',
      'Aciertos',
      '% Acierto',
      'Tiempo Medio (ms)',
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  for (const q of questionStats) {
    const accuracy =
      q.totalAnswers > 0
        ? Math.round((q.correctCount / q.totalAnswers) * 100)
        : 0;
    const letter = OPTION_META[q.correctIndex]?.letter ?? '?';
    lines.push(
      [
        q.questionIndex + 1,
        q.prompt,
        letter,
        q.totalAnswers,
        q.correctCount,
        `${accuracy}%`,
        Math.round(q.avgResponseMs),
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }

  return lines.join('\r\n');
}

const VALID_CATEGORIES = new Set<QuizCategory>([
  'Educación',
  'Empresas',
  'Eventos',
  'General',
]);

const VALID_POINTS_MODES = new Set<PointsMode>(['standard', 'double', 'none']);

export function validateQuizInput(raw: Partial<Quiz>): {
  valid: boolean;
  errors: string[];
  sanitized?: {
    title: string;
    description: string;
    category: QuizCategory;
    questions: QuizQuestion[];
  };
} {
  const errors: string[] = [];
  const title = (raw.title ?? '').trim();
  const description = (raw.description ?? '').trim();
  const category: QuizCategory = VALID_CATEGORIES.has(
    raw.category as QuizCategory
  )
    ? (raw.category as QuizCategory)
    : 'General';

  if (title.length < 2) {
    errors.push('El título del cuestionario debe tener al menos 2 caracteres.');
  }

  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  if (rawQuestions.length === 0) {
    errors.push('Agrega al menos 1 pregunta al cuestionario.');
  }

  const questions: QuizQuestion[] = [];
  rawQuestions.forEach((q, index) => {
    const prompt = (q?.prompt ?? '').trim();
    if (!prompt) {
      errors.push(`La pregunta ${index + 1} necesita un enunciado.`);
    }
    const opts = Array.isArray(q?.options) ? q.options : ['', '', '', ''];
    const normalizedOpts: [string, string, string, string] = [
      String(opts[0] ?? '').trim(),
      String(opts[1] ?? '').trim(),
      String(opts[2] ?? '').trim(),
      String(opts[3] ?? '').trim(),
    ];
    if (normalizedOpts.some((opt) => opt.length === 0)) {
      errors.push(`La pregunta ${index + 1} debe tener las 4 opciones completas.`);
    }
    const correctIndex = Number(q?.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) {
      errors.push(
        `La pregunta ${index + 1} debe indicar una opción correcta (A, B, C o D).`
      );
    }
    const timeLimitSec = Math.min(
      120,
      Math.max(5, Number(q?.timeLimitSec) || 20)
    );
    const pointsMode: PointsMode = VALID_POINTS_MODES.has(
      q?.pointsMode as PointsMode
    )
      ? (q.pointsMode as PointsMode)
      : 'standard';

    questions.push({
      id: typeof q?.id === 'string' && q.id.trim() ? q.id.trim() : `q_${index + 1}_${Date.now()}`,
      prompt,
      options: normalizedOpts,
      correctIndex: Number.isInteger(correctIndex) ? correctIndex : 0,
      timeLimitSec,
      pointsMode,
    });
  });

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    sanitized: {
      title,
      description,
      category,
      questions,
    },
  };
}

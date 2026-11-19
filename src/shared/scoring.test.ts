import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildResultsCsv,
  calculatePoints,
  calculateScoreBreakdown,
  computeRankings,
  formatVisitorCount,
  generatePin,
  validateQuizInput,
} from './scoring.ts';
import type { PlayerPublic } from './types.ts';

test('formatVisitorCount starts at 0001000 and pads to 7 digits', () => {
  assert.equal(formatVisitorCount(0), '0001000');
  assert.equal(formatVisitorCount(1000), '0001000');
  assert.equal(formatVisitorCount(1042), '0001042');
  assert.equal(formatVisitorCount(1234567), '1234567');
});

test('calculatePoints awards 0 for wrong answers or none pointsMode', () => {
  assert.equal(
    calculatePoints({
      isCorrect: false,
      pointsMode: 'standard',
      responseTimeMs: 500,
      timeLimitSec: 20,
      speedBonus: true,
      streakBonus: true,
      currentStreak: 3,
    }),
    0
  );

  assert.equal(
    calculatePoints({
      isCorrect: true,
      pointsMode: 'none',
      responseTimeMs: 500,
      timeLimitSec: 20,
      speedBonus: true,
      streakBonus: true,
      currentStreak: 3,
    }),
    0
  );
});

test('calculatePoints rewards faster responses and streaks', () => {
  const fast = calculatePoints({
    isCorrect: true,
    pointsMode: 'standard',
    responseTimeMs: 1000,
    timeLimitSec: 20,
    speedBonus: true,
    streakBonus: false,
    currentStreak: 1,
  });
  const slow = calculatePoints({
    isCorrect: true,
    pointsMode: 'standard',
    responseTimeMs: 18000,
    timeLimitSec: 20,
    speedBonus: true,
    streakBonus: false,
    currentStreak: 1,
  });
  assert.ok(fast > slow, `expected fast (${fast}) > slow (${slow})`);
  assert.ok(fast <= 1000 && fast >= 900);
  assert.ok(slow >= 550 && slow < 700);

  const withStreak = calculatePoints({
    isCorrect: true,
    pointsMode: 'double',
    responseTimeMs: 0,
    timeLimitSec: 20,
    speedBonus: true,
    streakBonus: true,
    currentStreak: 3,
  });
  assert.equal(withStreak, 2400);

  const breakdown = calculateScoreBreakdown({
    isCorrect: true,
    pointsMode: 'standard',
    responseTimeMs: 5000,
    timeLimitSec: 20,
    speedBonus: true,
    streakBonus: true,
    currentStreak: 2,
  });
  assert.equal(breakdown.basePoints, 550);
  assert.equal(breakdown.speedBonusPoints, 338);
  assert.equal(breakdown.streakBonusPoints, 100);
  assert.equal(breakdown.totalPoints, 988);
  assert.equal(breakdown.reactionRatio, 0.75);
});

test('computeRankings sorts by score desc, then correctCount, then faster response time', () => {
  const sample: PlayerPublic[] = [
    {
      id: 'p1',
      nickname: 'Carlos',
      avatar: '⚡',
      score: 1800,
      lastRoundPoints: 800,
      streak: 1,
      rank: 0,
      previousRank: 0,
      connected: true,
      answeredCurrent: true,
      correctCount: 2,
      totalResponseMs: 6000,
    },
    {
      id: 'p2',
      nickname: 'Ana',
      avatar: '🦊',
      score: 1800,
      lastRoundPoints: 900,
      streak: 2,
      rank: 0,
      previousRank: 0,
      connected: true,
      answeredCurrent: true,
      correctCount: 2,
      totalResponseMs: 3200,
    },
    {
      id: 'p3',
      nickname: 'Luis',
      avatar: '🚀',
      score: 2100,
      lastRoundPoints: 950,
      streak: 3,
      rank: 0,
      previousRank: 0,
      connected: true,
      answeredCurrent: true,
      correctCount: 3,
      totalResponseMs: 4100,
    },
  ];

  const ranked = computeRankings(sample);
  assert.deepEqual(
    ranked.map((p) => [p.nickname, p.rank]),
    [
      ['Luis', 1],
      ['Ana', 2],
      ['Carlos', 3],
    ]
  );
});

test('generatePin produces unique 6-digit string', () => {
  const existing = new Set(['123456', '654321']);
  const pin = generatePin(existing);
  assert.match(pin, /^\d{6}$/);
  assert.equal(existing.has(pin), false);
});

test('validateQuizInput rejects incomplete quiz and accepts valid quiz', () => {
  const bad = validateQuizInput({ title: '', questions: [] });
  assert.equal(bad.valid, false);
  assert.ok(bad.errors.length >= 2);

  const good = validateQuizInput({
    title: 'Cultura Tech',
    description: 'Preguntas rápidas',
    category: 'Empresas',
    questions: [
      {
        id: 'q1',
        prompt: '¿Qué protocolo permite comunicación bidireccional en vivo?',
        options: ['HTTP 1.0', 'WebSocket', 'FTP', 'SMTP'],
        correctIndex: 1,
        timeLimitSec: 20,
        pointsMode: 'standard',
      },
    ],
  });
  assert.equal(good.valid, true);
  assert.equal(good.sanitized?.title, 'Cultura Tech');
});

test('buildResultsCsv includes player ranking and question accuracy rows', () => {
  const csv = buildResultsCsv(
    'Quiz Demo',
    '482915',
    [
      {
        id: '1',
        nickname: 'Elena',
        avatar: '💎',
        score: 980,
        lastRoundPoints: 980,
        streak: 1,
        rank: 1,
        previousRank: 1,
        connected: true,
        answeredCurrent: true,
        correctCount: 1,
        totalResponseMs: 1200,
      },
    ],
    [
      {
        questionIndex: 0,
        prompt: '¿Capital de Japón?',
        correctIndex: 2,
        counts: [0, 0, 1, 0],
        correctCount: 1,
        totalAnswers: 1,
        avgResponseMs: 1200,
      },
    ]
  );

  assert.match(csv, /KaWin - Informe Oficial de Partida/);
  assert.match(csv, /Elena/);
  assert.match(csv, /100%/);
});

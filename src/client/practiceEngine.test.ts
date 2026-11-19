import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFinishedMatchRecord } from '../../models.ts';
import type { Quiz } from '../shared/types.ts';
import {
  advancePracticeSession,
  answerPracticeQuestion,
  startPracticeSession,
  timeoutPracticeQuestion,
} from './practiceEngine.ts';

const SAMPLE_QUIZ: Quiz = {
  id: 'practice-test-1',
  title: 'Práctica Demo',
  description: 'Test',
  category: 'General',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  questions: [
    {
      id: 'q1',
      prompt: 'P1',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 1,
      timeLimitSec: 20,
      pointsMode: 'standard',
    },
    {
      id: 'q2',
      prompt: 'P2',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 0,
      timeLimitSec: 15,
      pointsMode: 'double',
    },
    {
      id: 'q3',
      prompt: 'P3',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
      timeLimitSec: 10,
      pointsMode: 'standard',
    },
  ],
};

test('PracticeEngine handles correct streak, wrong answer, timeout, and final summary', () => {
  const t0 = 1_000_000;
  let session = startPracticeSession(SAMPLE_QUIZ, t0);
  assert.equal(session.phase, 'PLAYING');
  assert.equal(session.questionEndsAt, t0 + 20_000);

  // Q1 answered correctly in 2s
  session = answerPracticeQuestion(session, 1, t0 + 2_000);
  assert.equal(session.phase, 'FEEDBACK');
  assert.equal(session.correctCount, 1);
  assert.equal(session.streak, 1);
  assert.ok(session.totalScore > 900);

  // Q2 answered correctly in 1s (double + streak 2)
  session = advancePracticeSession(session, t0 + 3_000);
  assert.equal(session.phase, 'PLAYING');
  assert.equal(session.questionIndex, 1);
  session = answerPracticeQuestion(session, 0, t0 + 4_000);
  assert.equal(session.correctCount, 2);
  assert.equal(session.streak, 2);
  assert.equal(session.bestStreak, 2);

  // Q3 times out
  session = advancePracticeSession(session, t0 + 5_000);
  assert.equal(session.questionIndex, 2);
  session = timeoutPracticeQuestion(session);
  assert.equal(session.phase, 'FEEDBACK');
  assert.equal(session.streak, 0);
  assert.equal(session.bestStreak, 2);
  assert.equal(session.records[2].timedOut, true);
  assert.equal(session.records[2].pointsEarned, 0);

  // Final summary
  session = advancePracticeSession(session, t0 + 6_000);
  assert.equal(session.phase, 'SUMMARY');
  assert.equal(session.records.length, 3);
});

test('buildFinishedMatchRecord ranks players and identifies champion', () => {
  const record = buildFinishedMatchRecord({
    id: 'm1',
    pin: '123456',
    quizId: 'q1',
    quizTitle: 'Trivia',
    finishedAt: '2026-02-01T12:00:00.000Z',
    totalQuestions: 2,
    players: [
      {
        id: 'p1',
        nickname: 'Mateo',
        avatar: '🚀',
        score: 900,
        lastRoundPoints: 0,
        streak: 0,
        rank: 2,
        previousRank: 1,
        connected: true,
        answeredCurrent: false,
        correctCount: 1,
        totalResponseMs: 3000,
      },
      {
        id: 'p2',
        nickname: 'Sofía',
        avatar: '💎',
        score: 1850,
        lastRoundPoints: 950,
        streak: 2,
        rank: 1,
        previousRank: 2,
        connected: true,
        answeredCurrent: false,
        correctCount: 2,
        totalResponseMs: 2400,
      },
    ],
    questionStats: [],
  });

  assert.equal(record.winnerNickname, 'Sofía');
  assert.equal(record.winnerScore, 1850);
  assert.equal(record.playerCount, 2);
  assert.equal(record.players[0].rank, 1);
});

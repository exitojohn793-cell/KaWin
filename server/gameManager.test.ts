import test from 'node:test';
import assert from 'node:assert/strict';
import { GameManager } from './gameManager.ts';
import type { Quiz } from '../src/shared/types.ts';

const SAMPLE_QUIZ: Quiz = {
  id: 'q-test',
  title: 'Test Show',
  description: 'Prueba',
  category: 'General',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  questions: [
    {
      id: 'q1',
      prompt: '2 + 2 = ?',
      options: ['3', '4', '5', '6'],
      correctIndex: 1,
      timeLimitSec: 20,
      pointsMode: 'standard',
    },
    {
      id: 'q2',
      prompt: 'Color del cielo despejado',
      options: ['Rojo', 'Azul', 'Verde', 'Negro'],
      correctIndex: 1,
      timeLimitSec: 20,
      pointsMode: 'double',
    },
  ],
};

test('GameManager full multiplayer lifecycle: lobby -> question -> reveal -> leaderboard -> podium', () => {
  const broadcasts: string[] = [];
  const rankingSnapshots: Array<Array<{ nickname: string; score: number; rank: number }>> = [];
  const manager = new GameManager({
    onStateChange: (pin) => broadcasts.push(`state:${pin}`),
    onRankingUpdate: (_pin, ranking) =>
      rankingSnapshots.push(
        ranking.map((r) => ({ nickname: r.nickname, score: r.score, rank: r.rank }))
      ),
    onReaction: (pin) => broadcasts.push(`reaction:${pin}`),
    onRoomClosed: (pin) => broadcasts.push(`closed:${pin}`),
  });

  const { pin, hostToken, state } = manager.createRoom(SAMPLE_QUIZ);
  assert.equal(state.phase, 'LOBBY');
  assert.equal(state.gameState, 'espera');
  assert.equal(manager.verifyHost(pin, hostToken), true);

  const p1 = manager.joinPlayer(pin, 'Sofía');
  const p2 = manager.joinPlayer(pin, 'Mateo');
  assert.equal(p1.state.players.length, 1);
  assert.equal(p2.state.players.length, 2);

  // Duplicate nickname rejected
  assert.throws(() => manager.joinPlayer(pin, 'sofía'));

  const q1State = manager.startGame(pin);
  assert.equal(q1State.phase, 'QUESTION');
  assert.equal(q1State.gameState, 'preguntando');
  assert.equal(q1State.questionIndex, 0);

  // First player answers -> real-time ranking updates immediately before reveal
  const startedAt = q1State.questionStartedAt ?? Date.now();
  const afterP1 = manager.submitAnswer(pin, p1.playerId, 1, startedAt + 1000);
  assert.equal(afterP1.phase, 'QUESTION');
  assert.equal(afterP1.ranking[0].nickname, 'Sofía');
  assert.ok(afterP1.ranking[0].score > 0);
  assert.ok(rankingSnapshots.length >= 1);

  // Second player answers -> auto-advances to REVEAL
  const afterP2 = manager.submitAnswer(pin, p2.playerId, 0, startedAt + 2000);
  assert.equal(afterP2.phase, 'REVEAL');
  assert.equal(afterP2.gameState, 'preguntando');
  assert.equal(afterP2.revealData?.correctIndex, 1);
  assert.deepEqual(afterP2.revealData?.counts, [1, 1, 0, 0]);

  const lbState = manager.nextPhase(pin);
  assert.equal(lbState.phase, 'LEADERBOARD');
  assert.equal(lbState.players[0].nickname, 'Sofía');
  assert.ok(lbState.players[0].score > 0);
  assert.equal(lbState.players[1].score, 0);

  const q2State = manager.nextPhase(pin);
  assert.equal(q2State.phase, 'QUESTION');
  assert.equal(q2State.questionIndex, 1);

  const startedAt2 = q2State.questionStartedAt ?? Date.now();
  manager.submitAnswer(pin, p1.playerId, 1, startedAt2 + 500);
  manager.submitAnswer(pin, p2.playerId, 1, startedAt2 + 1500);

  const podiumState = manager.nextPhase(pin);
  assert.equal(podiumState.phase, 'PODIUM');
  assert.equal(podiumState.gameState, 'podio');
  assert.equal(podiumState.players[0].nickname, 'Sofía');
  assert.equal(podiumState.players[0].correctCount, 2);
  assert.equal(podiumState.players[1].correctCount, 1);

  const backToLobby = manager.setLifecycleStage(pin, 'espera');
  assert.equal(backToLobby.gameState, 'espera');
  assert.equal(backToLobby.players[0].score, 0);

  manager.closeRoom(pin);
  assert.equal(manager.hasRoom(pin), false);
});

import http from 'node:http';
import path from 'node:path';
import express from 'express';
import QRCode from 'qrcode';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketClientMeta,
} from './models.ts';
import { GameManager } from './server/gameManager.ts';
import { JsonStorage } from './server/storage.ts';
import { validateQuizInput } from './src/shared/scoring.ts';

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const isProd = process.env.NODE_ENV === 'production';

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketClientMeta
>;

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  const storage = new JsonStorage();
  const server = http.createServer(app);
  const io = new SocketIOServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketClientMeta
  >(server, {
    path: '/socket.io',
    cors: {
      origin: true,
      credentials: true,
    },
  });

  const gameManager = new GameManager({
    onStateChange: (pin) => {
      const state = gameManager.getPublicState(pin);
      if (!state) return;
      const roomSockets = io.sockets.adapter.rooms.get(pin);
      if (!roomSockets) return;

      for (const socketId of roomSockets) {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (!clientSocket) continue;
        if (clientSocket.data.role === 'player' && clientSocket.data.playerId) {
          clientSocket.emit('room:state', {
            state,
            me: gameManager.getPlayerPrivateFeedback(pin, clientSocket.data.playerId),
          });
        } else {
          clientSocket.emit('room:state', { state });
        }
      }
    },
    onRankingUpdate: (pin, ranking) => {
      io.to(pin).emit('room:ranking', { pin, ranking });
    },
    onReaction: (pin, reaction) => {
      io.to(pin).emit('room:reaction', { reaction });
    },
    onRoomClosed: (pin, reason) => {
      io.to(pin).emit('room:closed', { reason });
      const roomSockets = io.sockets.adapter.rooms.get(pin);
      if (!roomSockets) return;

      for (const socketId of Array.from(roomSockets)) {
        const clientSocket = io.sockets.sockets.get(socketId);
        if (clientSocket) {
          clientSocket.data.pin = null;
          clientSocket.data.role = null;
          clientSocket.data.playerId = null;
          void clientSocket.leave(pin);
        }
      }
    },
    onMatchFinished: (record) => {
      storage.saveFinishedMatch(record);
    },
  });

  setInterval(() => gameManager.cleanupStaleRooms(), 5 * 60 * 1000).unref();

  const leavePreviousRoom = (socket: TypedSocket): void => {
    if (socket.data.pin) {
      void socket.leave(socket.data.pin);
    }
  };

  const handleAction = (socket: TypedSocket, action: () => void): void => {
    try {
      action();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Error procesando acción.';
      socket.emit('error', { code: 'ACTION_ERROR', message });
    }
  };

  io.on('connection', (socket: TypedSocket) => {
    socket.data = { role: null, pin: null, playerId: null };

    socket.on('host:create', ({ quizId, settings }) => {
      handleAction(socket, () => {
        const quiz = storage.getQuiz(quizId);
        if (!quiz) {
          socket.emit('error', {
            code: 'QUIZ_NOT_FOUND',
            message: 'No se encontró el cuestionario seleccionado.',
          });
          return;
        }
        leavePreviousRoom(socket);
        const created = gameManager.createRoom(quiz, settings);
        socket.data = { role: 'host', pin: created.pin, playerId: null };
        void socket.join(created.pin);
        socket.emit('room:created', {
          pin: created.pin,
          hostToken: created.hostToken,
          state: created.state,
        });
      });
    });

    socket.on('host:reconnect', ({ pin, hostToken }) => {
      handleAction(socket, () => {
        if (!gameManager.verifyHost(pin, hostToken)) {
          socket.emit('error', {
            code: 'HOST_AUTH_FAILED',
            message: 'La sala ya no está activa o expiró.',
          });
          return;
        }
        const state = gameManager.getPublicState(pin);
        if (!state) return;
        leavePreviousRoom(socket);
        socket.data = { role: 'host', pin, playerId: null };
        void socket.join(pin);
        socket.emit('room:state', { state });
      });
    });

    socket.on('host:updateSettings', ({ pin, settings }) => {
      handleAction(socket, () => {
        if (socket.data.role !== 'host' || socket.data.pin !== pin) return;
        gameManager.updateSettings(pin, settings);
      });
    });

    /**
     * Ciclo de vida de la partida:
     * 1) 'espera' (LOBBY): creación de sala con PIN único e ingreso de jugadores
     * 2) 'preguntando' (QUESTION -> REVEAL -> LEADERBOARD): rondas cronometradas y respuestas
     * 3) 'podio' (PODIUM): ranking final y cierre o reinicio de sala
     */
    socket.on('host:startGame', ({ pin }) => {
      handleAction(socket, () => {
        if (socket.data.role !== 'host' || socket.data.pin !== pin) return;
        gameManager.startGame(pin);
      });
    });

    socket.on('host:endQuestionNow', ({ pin }) => {
      handleAction(socket, () => {
        if (socket.data.role !== 'host' || socket.data.pin !== pin) return;
        gameManager.endQuestionNow(pin);
      });
    });

    socket.on('host:nextPhase', ({ pin }) => {
      handleAction(socket, () => {
        if (socket.data.role !== 'host' || socket.data.pin !== pin) return;
        gameManager.nextPhase(pin);
      });
    });

    socket.on('host:setStage', ({ pin, stage }) => {
      handleAction(socket, () => {
        if (socket.data.role !== 'host' || socket.data.pin !== pin) return;
        gameManager.setLifecycleStage(pin, stage);
      });
    });

    socket.on('host:restartRoom', ({ pin }) => {
      handleAction(socket, () => {
        if (socket.data.role !== 'host' || socket.data.pin !== pin) return;
        gameManager.restartRoom(pin);
      });
    });

    socket.on('host:closeRoom', ({ pin }) => {
      handleAction(socket, () => {
        if (socket.data.role !== 'host' || socket.data.pin !== pin) return;
        gameManager.closeRoom(pin);
      });
    });

    socket.on('player:join', ({ pin, nickname, avatar, sessionToken }) => {
      handleAction(socket, () => {
        const cleanPin = String(pin ?? '').trim();
        leavePreviousRoom(socket);
        const joined = gameManager.joinPlayer(
          cleanPin,
          nickname,
          avatar,
          sessionToken
        );
        socket.data = {
          role: 'player',
          pin: cleanPin,
          playerId: joined.playerId,
        };
        void socket.join(cleanPin);
        socket.emit('player:joined', {
          playerId: joined.playerId,
          sessionToken: joined.sessionToken,
          state: joined.state,
          me: joined.me,
        });
      });
    });

    socket.on('player:answer', ({ pin, optionIndex }) => {
      handleAction(socket, () => {
        if (
          socket.data.role !== 'player' ||
          socket.data.pin !== pin ||
          !socket.data.playerId
        ) {
          return;
        }
        gameManager.submitAnswer(pin, socket.data.playerId, optionIndex);
      });
    });

    socket.on('player:reaction', ({ pin, emoji }) => {
      handleAction(socket, () => {
        if (
          socket.data.role !== 'player' ||
          socket.data.pin !== pin ||
          !socket.data.playerId
        ) {
          return;
        }
        gameManager.sendReaction(pin, socket.data.playerId, emoji);
      });
    });

    socket.on('disconnect', () => {
      if (
        socket.data.role === 'player' &&
        socket.data.pin &&
        socket.data.playerId
      ) {
        gameManager.setPlayerDisconnected(socket.data.pin, socket.data.playerId);
      }
    });
  });

  // REST API routes
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'KaWin', realtime: 'socket.io' });
  });

  app.get('/api/visitors', (_req, res) => {
    res.json(storage.getVisitorStats());
  });

  app.post('/api/visitors/hit', (_req, res) => {
    res.json(storage.incrementVisitor());
  });

  app.get('/api/rooms/:pin', (req, res) => {
    const exists = gameManager.hasRoom(req.params.pin);
    res.json({ exists });
  });

  app.get('/api/rooms/:pin/ranking', (req, res) => {
    const pin = req.params.pin;
    if (!gameManager.hasRoom(pin)) {
      res.status(404).json({ error: 'Partida no encontrada' });
      return;
    }
    res.json({ pin, ranking: gameManager.getLiveRanking(pin) });
  });

  app.get('/api/qr', async (req, res) => {
    const text = String(req.query.text ?? '').trim();
    if (!text) {
      res.status(400).send('Missing text');
      return;
    }
    try {
      const svg = await QRCode.toString(text, {
        type: 'svg',
        margin: 1,
        width: 260,
        color: {
          dark: '#0B1020',
          light: '#FFFFFF',
        },
      });
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
    } catch {
      res.status(500).send('Error generating QR');
    }
  });

  app.get('/api/quizzes', (_req, res) => {
    res.json(storage.listQuizzes());
  });

  app.get('/api/quizzes/:id', (req, res) => {
    const quiz = storage.getQuiz(req.params.id);
    if (!quiz) {
      res.status(404).json({ error: 'Cuestionario no encontrado' });
      return;
    }
    res.json(quiz);
  });

  app.post('/api/quizzes', (req, res) => {
    const check = validateQuizInput(req.body ?? {});
    if (!check.valid || !check.sanitized) {
      res.status(400).json({ error: check.errors[0], errors: check.errors });
      return;
    }
    const created = storage.createQuiz(check.sanitized);
    res.status(201).json(created);
  });

  app.put('/api/quizzes/:id', (req, res) => {
    const check = validateQuizInput(req.body ?? {});
    if (!check.valid || !check.sanitized) {
      res.status(400).json({ error: check.errors[0], errors: check.errors });
      return;
    }
    const updated = storage.updateQuiz(req.params.id, check.sanitized);
    if (!updated) {
      res.status(404).json({ error: 'Cuestionario no encontrado' });
      return;
    }
    res.json(updated);
  });

  app.delete('/api/quizzes/:id', (req, res) => {
    const deleted = storage.deleteQuiz(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Cuestionario no encontrado' });
      return;
    }
    res.json({ ok: true });
  });

  app.get('/api/history', (_req, res) => {
    res.json(storage.listMatchHistory());
  });

  app.delete('/api/history/:id', (req, res) => {
    const deleted = storage.deleteFinishedMatch(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Registro histórico no encontrado' });
      return;
    }
    res.json({ ok: true });
  });

  if (isProd) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.use((_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(PORT, HOST, () => {
    console.log(`KaWin Live Studio (Express + Socket.IO) running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start KaWin server:', err);
  process.exit(1);
});

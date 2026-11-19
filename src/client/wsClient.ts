import { io, type Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  WsClientMessage,
  WsServerMessage,
} from '../../models.ts';

export type WsListener = (msg: WsServerMessage) => void;
export type ConnectionListener = (connected: boolean) => void;

export class KaWinSocketClient {
  private socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;
  private listeners = new Set<WsListener>();
  private connListeners = new Set<ConnectionListener>();
  private queue: WsClientMessage[] = [];
  private connected = false;

  connect(): void {
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }

    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
      window.location.origin,
      {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 800,
        reconnectionDelayMax: 3000,
      }
    );

    this.socket = socket;

    socket.on('connect', () => {
      this.connected = true;
      this.emitConnection(true);
      while (this.queue.length > 0 && socket.connected) {
        const next = this.queue.shift();
        if (next) this.dispatch(socket, next);
      }
    });

    socket.on('disconnect', () => {
      this.connected = false;
      this.emitConnection(false);
    });

    socket.on('room:created', (payload) => {
      this.emitMessage({ type: 'room:created', ...payload });
    });

    socket.on('player:joined', (payload) => {
      this.emitMessage({ type: 'player:joined', ...payload });
    });

    socket.on('room:state', (payload) => {
      this.emitMessage({ type: 'room:state', ...payload });
    });

    socket.on('room:ranking', (payload) => {
      this.emitMessage({ type: 'room:ranking', ...payload });
    });

    socket.on('room:reaction', (payload) => {
      this.emitMessage({ type: 'room:reaction', ...payload });
    });

    socket.on('room:closed', (payload) => {
      this.emitMessage({ type: 'room:closed', ...payload });
    });

    socket.on('error', (payload) => {
      this.emitMessage({ type: 'error', ...payload });
    });
  }

  isConnected(): boolean {
    return this.connected;
  }

  send(msg: WsClientMessage): void {
    if (!this.socket || !this.socket.connected) {
      this.queue.push(msg);
      this.connect();
      return;
    }
    this.dispatch(this.socket, msg);
  }

  subscribe(fn: WsListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  subscribeConnection(fn: ConnectionListener): () => void {
    this.connListeners.add(fn);
    fn(this.connected);
    return () => this.connListeners.delete(fn);
  }

  private dispatch(
    socket: Socket<ServerToClientEvents, ClientToServerEvents>,
    msg: WsClientMessage
  ): void {
    switch (msg.type) {
      case 'host:create':
        socket.emit('host:create', { quizId: msg.quizId, settings: msg.settings });
        break;
      case 'host:reconnect':
        socket.emit('host:reconnect', { pin: msg.pin, hostToken: msg.hostToken });
        break;
      case 'host:updateSettings':
        socket.emit('host:updateSettings', { pin: msg.pin, settings: msg.settings });
        break;
      case 'host:startGame':
        socket.emit('host:startGame', { pin: msg.pin });
        break;
      case 'host:endQuestionNow':
        socket.emit('host:endQuestionNow', { pin: msg.pin });
        break;
      case 'host:nextPhase':
        socket.emit('host:nextPhase', { pin: msg.pin });
        break;
      case 'host:setStage':
        socket.emit('host:setStage', { pin: msg.pin, stage: msg.stage });
        break;
      case 'host:restartRoom':
        socket.emit('host:restartRoom', { pin: msg.pin });
        break;
      case 'host:closeRoom':
        socket.emit('host:closeRoom', { pin: msg.pin });
        break;
      case 'player:join':
        socket.emit('player:join', {
          pin: msg.pin,
          nickname: msg.nickname,
          avatar: msg.avatar,
          sessionToken: msg.sessionToken,
        });
        break;
      case 'player:answer':
        socket.emit('player:answer', { pin: msg.pin, optionIndex: msg.optionIndex });
        break;
      case 'player:reaction':
        socket.emit('player:reaction', { pin: msg.pin, emoji: msg.emoji });
        break;
    }
  }

  private emitMessage(msg: WsServerMessage): void {
    for (const fn of this.listeners) {
      fn(msg);
    }
  }

  private emitConnection(status: boolean): void {
    for (const fn of this.connListeners) {
      fn(status);
    }
  }
}

export const wsClient = new KaWinSocketClient();

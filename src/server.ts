import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { MatchRooms } from './game';

export function createGameServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000', methods: ['GET', 'POST'] },
  });
  app.use(cors());
  app.get('/health', (_req, res) => res.json({ status: 'OK' }));
  const game = new MatchRooms((id, state) => io.to(id).emit('roomUpdate', state));
  io.on('connection', socket => {
    for (const event of ['joinRoom', 'leaveRoom', 'updateSettings', 'switchTeam', 'startGame', 'resetGame', 'guessWord', 'correctWord', 'skipWord']) {
      socket.on(event, (payload: unknown, acknowledge?: unknown) => {
        const result = game.handle(event, socket.id, payload);
        if (typeof acknowledge === 'function') acknowledge(result);
        else if (!result.ok) socket.emit('actionRejected', { reason: result.error });
      });
    }
    socket.on('webrtc-signal', payload => {
      if (!payload || typeof payload.target !== 'string' || !payload.signal) return;
      const room = game.roomFor(socket.id);
      if (!room || game.roomFor(payload.target) !== room) return;
      io.to(payload.target).emit('webrtc-signal', { signal: payload.signal, callerId: socket.id });
    });
    socket.on('disconnect', () => game.leave(socket.id));
  });
  return { app, httpServer, io, game, close: () => {
    game.dispose();
    return new Promise<void>(resolve => io.close(() => resolve()));
  } };
}

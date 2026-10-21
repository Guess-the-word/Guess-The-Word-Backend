"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGameServer = void 0;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const game_1 = require("./game");
function createGameServer() {
    const app = (0, express_1.default)();
    const httpServer = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(httpServer, {
        cors: { origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000', methods: ['GET', 'POST'] },
    });
    app.use((0, cors_1.default)());
    app.get('/health', (_req, res) => res.json({ status: 'OK' }));
    const game = new game_1.MatchRooms((id, state) => io.to(id).emit('roomUpdate', state));
    io.on('connection', socket => {
        for (const event of ['joinRoom', 'leaveRoom', 'updateSettings', 'switchTeam', 'startGame', 'resetGame', 'guessWord', 'correctWord', 'skipWord']) {
            socket.on(event, (payload, acknowledge) => {
                const result = game.handle(event, socket.id, payload);
                if (typeof acknowledge === 'function')
                    acknowledge(result);
                else if (!result.ok)
                    socket.emit('actionRejected', { reason: result.error });
            });
        }
        socket.on('webrtc-signal', payload => {
            if (!payload || typeof payload.target !== 'string' || !payload.signal)
                return;
            const room = game.roomFor(socket.id);
            if (!room || game.roomFor(payload.target) !== room)
                return;
            io.to(payload.target).emit('webrtc-signal', { signal: payload.signal, callerId: socket.id });
        });
        socket.on('disconnect', () => game.leave(socket.id));
    });
    return { app, httpServer, io, game, close: () => {
            game.dispose();
            return new Promise(resolve => io.close(() => resolve()));
        } };
}
exports.createGameServer = createGameServer;
//# sourceMappingURL=server.js.map
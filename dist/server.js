"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const roomManager_1 = require("./roomManager");
// Create Express app
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Create HTTP server
const server = http_1.default.createServer(app);
// Create Socket.IO server
const io = new socket_io_1.Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});
// Basic route
app.get('/', (req, res) => {
    res.send('Guess The Word Game Server');
});
// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    // Join Room
    socket.on('joinRoom', (payload) => {
        const { roomName } = payload;
        // Join the Socket.IO room
        socket.join(roomName);
        // Add player to the room
        (0, roomManager_1.addPlayerToRoom)(roomName, socket.id);
        // Broadcast room update to all clients in the room
        io.to(roomName).emit('roomUpdate', roomManager_1.rooms[roomName]);
        console.log(`User ${socket.id} joined room: ${roomName}`);
    });
    // Start Game
    socket.on('startGame', (payload) => {
        const { roomName } = payload;
        const room = roomManager_1.rooms[roomName];
        if (!room)
            return;
        // Start the game
        (0, roomManager_1.startGame)(roomName);
        // Broadcast game started event to all clients in the room
        io.to(roomName).emit('gameStarted', {
            currentTeam: room.currentTeam,
            describer: room.describer,
            timeLeft: room.timeLeft
        });
        // Send the secret word only to the describer
        io.to(room.describer).emit('yourWord', { word: room.word });
        console.log(`Game started in room: ${roomName}`);
        // Start the timer
        const timerId = setInterval(() => {
            // If room no longer exists or game is not playing, clear the interval
            if (!roomManager_1.rooms[roomName] || roomManager_1.rooms[roomName].status !== 'playing') {
                clearInterval(timerId);
                return;
            }
            // Decrement the timer
            const timeUp = (0, roomManager_1.decrementTimer)(roomName);
            // Broadcast the updated time
            io.to(roomName).emit('timerUpdate', { timeLeft: roomManager_1.rooms[roomName].timeLeft });
            // If time is up, broadcast timeUp event
            if (timeUp) {
                io.to(roomName).emit('timeUp');
                // Broadcast next turn
                io.to(roomName).emit('nextTurn', {
                    currentTeam: roomManager_1.rooms[roomName].currentTeam,
                    describer: roomManager_1.rooms[roomName].describer,
                    timeLeft: roomManager_1.rooms[roomName].timeLeft
                });
                // Send the new secret word to the new describer
                io.to(roomManager_1.rooms[roomName].describer).emit('yourWord', { word: roomManager_1.rooms[roomName].word });
            }
        }, 1000);
    });
    // Guess Word
    socket.on('guessWord', (payload) => {
        const { roomName, guess } = payload;
        const room = roomManager_1.rooms[roomName];
        if (!room || room.status !== 'playing')
            return;
        // Check if the guess is correct
        const isCorrect = (0, roomManager_1.checkGuess)(roomName, socket.id, guess);
        // Broadcast guess result to all clients in the room
        io.to(roomName).emit('guessResult', {
            player: socket.id,
            guess,
            correct: isCorrect
        });
        // If correct, broadcast next turn
        if (isCorrect) {
            io.to(roomName).emit('nextTurn', {
                currentTeam: room.currentTeam,
                describer: room.describer,
                timeLeft: room.timeLeft
            });
            // Send the new secret word to the new describer
            io.to(room.describer).emit('yourWord', { word: room.word });
        }
    });
    // Reset Game
    socket.on('resetGame', (payload) => {
        const { roomName } = payload;
        // Reset the game
        (0, roomManager_1.resetGame)(roomName);
        // Broadcast room update to all clients in the room
        io.to(roomName).emit('roomUpdate', roomManager_1.rooms[roomName]);
        console.log(`Game reset in room: ${roomName}`);
    });
    // WebRTC Signaling (for optional video chat)
    socket.on('webrtc-signal', (payload) => {
        const { roomName, to, signal } = payload;
        // Forward the signal to the target client
        io.to(to).emit('webrtc-signal', {
            from: socket.id,
            signal
        });
    });
    // Disconnect
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // Find all rooms the user is in and remove them
        Object.keys(roomManager_1.rooms).forEach(roomName => {
            if (roomManager_1.rooms[roomName].players.includes(socket.id)) {
                (0, roomManager_1.removePlayerFromRoom)(roomName, socket.id);
                // If room still exists, broadcast update
                if (roomManager_1.rooms[roomName]) {
                    io.to(roomName).emit('roomUpdate', roomManager_1.rooms[roomName]);
                }
            }
        });
    });
});
// Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
exports.default = server;
//# sourceMappingURL=server.js.map
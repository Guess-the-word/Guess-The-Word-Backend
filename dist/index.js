"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const helpers_1 = require("./helpers");
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const rooms = {};
const GAME_DURATION = 60;
const TEAM_IDS = ['1', '2'];
function removePlayerFromRoom(socketId, roomName) {
    const room = rooms[roomName];
    if (!room)
        return false;
    const playerIndex = room.players.indexOf(socketId);
    if (playerIndex === -1)
        return false;
    room.players.splice(playerIndex, 1);
    delete room.nicknames[socketId];
    for (const arr of Object.values(room.teams)) {
        const idx = arr.indexOf(socketId);
        if (idx >= 0)
            arr.splice(idx, 1);
    }
    if (room.describer === socketId) {
        clearGameTimer(room);
        if (isGameReady(room).ready) {
            nextTurn(roomName);
        }
        else {
            resetGameState(room);
        }
    }
    if (room.status === 'playing' && !isGameReady(room).ready) {
        resetGameState(room);
        io.to(roomName).emit('gamePaused', {
            reason: 'Waiting for players on both teams.',
        });
    }
    if (room.players.length === 0) {
        clearGameTimer(room);
        delete rooms[roomName];
        return true;
    }
    return true;
}
function clearGameTimer(room) {
    if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
    }
}
function resetGameState(room) {
    room.status = 'waiting';
    room.describer = null;
    room.word = null;
    room.timeLeft = 0;
    room.usedWords = [];
    room.describerIndexes = {};
}
function initializeRoom(roomName) {
    return {
        players: [],
        status: 'waiting',
        teams: {},
        currentTeam: 1,
        describer: null,
        describerIndexes: {},
        word: null,
        usedWords: [],
        score: {},
        timer: null,
        timeLeft: 0,
        nicknames: {},
    };
}
function ensureTeamsExist(room) {
    TEAM_IDS.forEach((teamId) => {
        if (!room.teams[teamId]) {
            room.teams[teamId] = [];
        }
        if (room.score[teamId] === undefined) {
            room.score[teamId] = 0;
        }
        if (room.describerIndexes[teamId] === undefined) {
            room.describerIndexes[teamId] = 0;
        }
    });
}
function sanitizeNickname(nickname) {
    const trimmed = nickname?.trim();
    if (!trimmed) {
        return undefined;
    }
    return trimmed.slice(0, 24);
}
function getPlayerTeam(room, socketId) {
    const entry = Object.entries(room.teams).find(([, players]) => players.includes(socketId));
    return entry?.[0] || null;
}
function addPlayerToRoom(socketId, room, nickname) {
    if (!room.players.includes(socketId)) {
        room.players.push(socketId);
        room.nicknames[socketId] = sanitizeNickname(nickname) || (0, helpers_1.generateFunnyName)();
    }
    else if (nickname) {
        room.nicknames[socketId] = sanitizeNickname(nickname) || room.nicknames[socketId];
    }
    ensureTeamsExist(room);
    if (!getPlayerTeam(room, socketId)) {
        const targetTeam = room.teams['1'].length <= room.teams['2'].length ? '1' : '2';
        room.teams[targetTeam].push(socketId);
    }
}
function isGameReady(room) {
    ensureTeamsExist(room);
    if (room.players.length < 2) {
        return { ready: false, reason: 'At least two players are needed.' };
    }
    if (room.teams['1'].length === 0 || room.teams['2'].length === 0) {
        return { ready: false, reason: 'Each team needs at least one player.' };
    }
    return { ready: true };
}
function pickRoomWord(room) {
    const word = (0, helpers_1.pickRandomWord)(room.usedWords);
    room.usedWords.push(word);
    return word;
}
function normalizeGuess(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ');
}
function selectNextDescriber(room, teamId) {
    const members = room.teams[teamId] || [];
    if (members.length === 0) {
        return null;
    }
    const nextIndex = room.describerIndexes[teamId] % members.length;
    const describer = members[nextIndex];
    room.describerIndexes[teamId] = (nextIndex + 1) % members.length;
    return describer;
}
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('webrtc-signal', (payload) => {
        io.to(payload.target).emit('webrtc-signal', {
            signal: payload.signal,
            callerId: payload.callerId,
        });
    });
    socket.on('joinRoom', ({ roomName, nickname }) => {
        if (!rooms[roomName]) {
            rooms[roomName] = initializeRoom(roomName);
        }
        const room = rooms[roomName];
        addPlayerToRoom(socket.id, room, nickname);
        socket.join(roomName);
        broadcastRoomUpdate(roomName);
    });
    socket.on('leaveRoom', ({ roomName }) => {
        console.log(`Player ${socket.id} is leaving room ${roomName}`);
        socket.leave(roomName);
        const roomExists = removePlayerFromRoom(socket.id, roomName);
        if (roomExists && rooms[roomName]) {
            broadcastRoomUpdate(roomName);
        }
    });
    socket.on('switchTeam', ({ roomName, newTeam }) => {
        const room = rooms[roomName];
        if (!room)
            return;
        if (room.status === 'playing') {
            socket.emit('actionRejected', { reason: 'Teams are locked during a round.' });
            return;
        }
        if (!TEAM_IDS.includes(String(newTeam))) {
            socket.emit('actionRejected', { reason: 'That team is not available.' });
            return;
        }
        for (const [teamId, arr] of Object.entries(room.teams)) {
            const i = arr.indexOf(socket.id);
            if (i >= 0)
                arr.splice(i, 1);
        }
        ensureTeamsExist(room);
        room.teams[String(newTeam)].push(socket.id);
        broadcastRoomUpdate(roomName);
    });
    socket.on('startGame', ({ roomName }) => {
        const room = rooms[roomName];
        if (!room)
            return;
        ensureTeamsExist(room);
        const readiness = isGameReady(room);
        if (!readiness.ready) {
            socket.emit('startRejected', { reason: readiness.reason });
            return;
        }
        clearGameTimer(room);
        room.status = 'playing';
        room.currentTeam = room.teams['1'].length > 0 ? 1 : 2;
        room.describer = selectNextDescriber(room, String(room.currentTeam));
        room.word = pickRoomWord(room);
        room.timeLeft = GAME_DURATION;
        startTimer(roomName, GAME_DURATION);
        io.to(roomName).emit('gameStarted', {
            status: room.status,
            currentTeam: room.currentTeam,
            describer: room.describer,
            score: room.score,
            timeLeft: room.timeLeft,
        });
        if (room.describer) {
            io.to(room.describer).emit('yourWord', { word: room.word });
        }
    });
    socket.on('guessWord', ({ roomName, guess }) => {
        const room = rooms[roomName];
        if (!room || !room.word)
            return;
        const isCorrect = normalizeGuess(guess) === normalizeGuess(room.word);
        if (isCorrect) {
            room.score[room.currentTeam] = (room.score[room.currentTeam] || 0) + 1;
            io.to(roomName).emit('guessResult', {
                guess,
                correct: true,
                team: room.currentTeam,
                word: room.word,
                score: room.score,
            });
            clearGameTimer(room);
            nextTurn(roomName);
        }
        else {
            io.to(roomName).emit('guessResult', {
                guess,
                correct: false,
            });
        }
    });
    socket.on('correctWord', ({ roomName }) => {
        const room = rooms[roomName];
        if (!room || !room.word || room.describer !== socket.id)
            return;
        room.score[room.currentTeam] = (room.score[room.currentTeam] || 0) + 1;
        io.to(roomName).emit('guessResult', {
            guess: room.word,
            correct: true,
            team: room.currentTeam,
            word: room.word,
            score: room.score,
        });
        clearGameTimer(room);
        nextTurn(roomName);
    });
    socket.on('skipWord', ({ roomName }) => {
        const room = rooms[roomName];
        if (!room || !room.word || room.describer !== socket.id)
            return;
        io.to(roomName).emit('wordPassed', {
            team: room.currentTeam,
            word: room.word,
        });
        clearGameTimer(room);
        nextTurn(roomName);
    });
    socket.on('resetGame', ({ roomName }) => {
        const room = rooms[roomName];
        if (!room)
            return;
        resetGameState(room);
        clearGameTimer(room);
        room.timeLeft = 0;
        Object.keys(room.score).forEach((key) => {
            room.score[key] = 0;
        });
        broadcastRoomUpdate(roomName);
    });
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        Object.entries(rooms).forEach(([roomName, room]) => {
            if (room.players.includes(socket.id)) {
                console.log(`Removing ${socket.id} from room ${roomName} due to disconnect`);
                removePlayerFromRoom(socket.id, roomName);
                if (rooms[roomName]) {
                    broadcastRoomUpdate(roomName);
                }
            }
        });
    });
});
function broadcastRoomUpdate(roomName) {
    const room = rooms[roomName];
    if (!room)
        return;
    ensureTeamsExist(room);
    console.log(`Broadcasting room update for ${roomName}. Players: ${room.players.length}`);
    io.to(roomName).emit('roomUpdate', {
        roomName,
        players: room.players,
        status: room.status,
        teams: room.teams,
        score: room.score,
        currentTeam: room.currentTeam,
        describer: room.describer,
        timeLeft: room.timeLeft,
        nicknames: room.nicknames,
    });
}
function startTimer(roomName, duration) {
    const room = rooms[roomName];
    if (!room)
        return;
    clearGameTimer(room);
    room.timeLeft = duration;
    io.to(roomName).emit('timerUpdate', { timeLeft: room.timeLeft });
    room.timer = setInterval(() => {
        room.timeLeft -= 1;
        io.to(roomName).emit('timerUpdate', { timeLeft: room.timeLeft });
        if (room.timeLeft <= 0) {
            clearGameTimer(room);
            io.to(roomName).emit('timeUp', {});
            nextTurn(roomName);
        }
    }, 1000);
}
function nextTurn(roomName) {
    const room = rooms[roomName];
    if (!room)
        return;
    ensureTeamsExist(room);
    const readiness = isGameReady(room);
    if (!readiness.ready) {
        resetGameState(room);
        io.to(roomName).emit('gamePaused', { reason: readiness.reason });
        broadcastRoomUpdate(roomName);
        return;
    }
    const proposedTeam = room.currentTeam === 1 ? 2 : 1;
    if (room.teams[proposedTeam] && room.teams[proposedTeam].length > 0) {
        room.currentTeam = proposedTeam;
    }
    else if (room.teams[room.currentTeam].length === 0) {
        return;
    }
    if (room.teams[room.currentTeam].length === 0)
        return;
    room.describer = selectNextDescriber(room, String(room.currentTeam));
    room.word = pickRoomWord(room);
    room.timeLeft = GAME_DURATION;
    startTimer(roomName, GAME_DURATION);
    io.to(roomName).emit('nextTurn', {
        currentTeam: room.currentTeam,
        describer: room.describer,
        score: room.score,
        timeLeft: room.timeLeft,
    });
    if (room.describer) {
        io.to(room.describer).emit('yourWord', { word: room.word });
    }
}
app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
});
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map
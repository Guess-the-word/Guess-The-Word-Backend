"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrementTimer = exports.resetGame = exports.nextTurn = exports.checkGuess = exports.startGame = exports.removePlayerFromRoom = exports.addPlayerToRoom = exports.getOrCreateRoom = exports.rooms = void 0;
const utils_1 = require("./utils");
// In-memory storage for rooms
exports.rooms = {};
// Create a new room or get existing one
function getOrCreateRoom(roomName) {
    if (!exports.rooms[roomName]) {
        exports.rooms[roomName] = {
            players: [],
            teams: {
                '1': [],
                '2': []
            },
            score: {
                '1': 0,
                '2': 0
            },
            status: 'waiting',
            currentTeam: '1',
            describer: '',
            word: '',
            timeLeft: 60,
            nicknames: {},
            guessConsole: []
        };
    }
    return exports.rooms[roomName];
}
exports.getOrCreateRoom = getOrCreateRoom;
// Add a player to a room
function addPlayerToRoom(roomName, socketId) {
    const room = getOrCreateRoom(roomName);
    // Add player if not already in the room
    if (!room.players.includes(socketId)) {
        room.players.push(socketId);
        // Assign a nickname
        room.nicknames[socketId] = (0, utils_1.generateNickname)();
        // Assign to a team (alternating between teams for balance)
        const teamWithFewerPlayers = room.teams['1'].length <= room.teams['2'].length ? '1' : '2';
        room.teams[teamWithFewerPlayers].push(socketId);
    }
}
exports.addPlayerToRoom = addPlayerToRoom;
// Remove a player from a room
function removePlayerFromRoom(roomName, socketId) {
    const room = exports.rooms[roomName];
    if (!room)
        return;
    // Remove from players array
    room.players = room.players.filter(id => id !== socketId);
    // Remove from teams
    Object.keys(room.teams).forEach(teamId => {
        room.teams[teamId] = room.teams[teamId].filter(id => id !== socketId);
    });
    // Remove nickname
    delete room.nicknames[socketId];
    // If room is empty, delete it
    if (room.players.length === 0) {
        delete exports.rooms[roomName];
        return;
    }
    // If the describer left during a game, move to next turn
    if (room.status === 'playing' && room.describer === socketId) {
        nextTurn(roomName);
    }
}
exports.removePlayerFromRoom = removePlayerFromRoom;
// Start the game
function startGame(roomName) {
    const room = exports.rooms[roomName];
    if (!room)
        return;
    room.status = 'playing';
    room.score = { '1': 0, '2': 0 };
    room.currentTeam = '1';
    room.timeLeft = 60;
    // Select first describer from team 1
    if (room.teams['1'].length > 0) {
        room.describer = room.teams['1'][0];
    }
    else if (room.teams['2'].length > 0) {
        // If team 1 is empty, use team 2
        room.currentTeam = '2';
        room.describer = room.teams['2'][0];
    }
    else {
        // No players in teams, can't start
        room.status = 'waiting';
        return;
    }
    // Select a random word
    room.word = (0, utils_1.getRandomWord)();
    // Clear guess console
    room.guessConsole = [];
}
exports.startGame = startGame;
// Check if a guess is correct
function checkGuess(roomName, socketId, guess) {
    const room = exports.rooms[roomName];
    if (!room || room.status !== 'playing')
        return false;
    // Convert both to lowercase for case-insensitive comparison
    const normalizedGuess = guess.toLowerCase().trim();
    const normalizedWord = room.word.toLowerCase().trim();
    const isCorrect = normalizedGuess === normalizedWord;
    // Add to guess console
    room.guessConsole.push({
        player: socketId,
        guess,
        correct: isCorrect,
        timestamp: Date.now()
    });
    // If correct, update score and move to next turn
    if (isCorrect) {
        room.score[room.currentTeam]++;
        nextTurn(roomName);
    }
    return isCorrect;
}
exports.checkGuess = checkGuess;
// Move to the next turn
function nextTurn(roomName) {
    const room = exports.rooms[roomName];
    if (!room || room.status !== 'playing')
        return;
    // Switch teams
    room.currentTeam = room.currentTeam === '1' ? '2' : '1';
    // Reset timer
    room.timeLeft = 60;
    // Select next describer from current team
    const currentTeam = room.teams[room.currentTeam];
    if (currentTeam.length > 0) {
        // If the team has players, select the first one
        room.describer = currentTeam[0];
        // Rotate the team array to give everyone a chance to describe
        room.teams[room.currentTeam] = [
            ...currentTeam.slice(1),
            currentTeam[0]
        ];
    }
    else {
        // If current team is empty, switch back to the other team
        room.currentTeam = room.currentTeam === '1' ? '2' : '1';
        const otherTeam = room.teams[room.currentTeam];
        if (otherTeam.length > 0) {
            room.describer = otherTeam[0];
            // Rotate the team array
            room.teams[room.currentTeam] = [
                ...otherTeam.slice(1),
                otherTeam[0]
            ];
        }
        else {
            // No players in either team, reset to waiting
            resetGame(roomName);
            return;
        }
    }
    // Select a new random word
    room.word = (0, utils_1.getRandomWord)();
}
exports.nextTurn = nextTurn;
// Reset the game
function resetGame(roomName) {
    const room = exports.rooms[roomName];
    if (!room)
        return;
    room.status = 'waiting';
    room.score = { '1': 0, '2': 0 };
    room.currentTeam = '1';
    room.describer = '';
    room.word = '';
    room.timeLeft = 60;
    room.guessConsole = [];
}
exports.resetGame = resetGame;
// Decrement the timer
function decrementTimer(roomName) {
    const room = exports.rooms[roomName];
    if (!room || room.status !== 'playing')
        return false;
    room.timeLeft--;
    // If timer reaches 0, move to next turn
    if (room.timeLeft <= 0) {
        nextTurn(roomName);
        return true;
    }
    return false;
}
exports.decrementTimer = decrementTimer;
//# sourceMappingURL=roomManager.js.map
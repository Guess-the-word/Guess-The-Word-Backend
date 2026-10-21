"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchRooms = void 0;
const crypto_1 = require("crypto");
const helpers_1 = require("./helpers");
const COUNTDOWN_MS = 3000;
const REVEAL_MS = 2500;
const success = { ok: true };
const fail = (error) => ({ ok: false, error });
const normalizeGuess = (value) => value.trim().toLowerCase()
    .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ');
const dataObject = (payload) => payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    ? payload : {};
/** Owns room lifecycle and match rules. Private words never enter a shared snapshot. */
class MatchRooms {
    constructor(publish, now = () => Date.now()) {
        this.publish = publish;
        this.now = now;
        this.rooms = new Map();
        this.memberships = new Map();
    }
    roomFor(playerId) { return this.memberships.get(playerId); }
    handle(event, playerId, payload) {
        const data = dataObject(payload);
        if (event === 'joinRoom')
            return this.join(playerId, data);
        const roomName = this.memberships.get(playerId);
        const room = roomName ? this.rooms.get(roomName) : undefined;
        if (!room || data.roomName !== room.name)
            return fail('You are not a member of this room.');
        if (event === 'leaveRoom') {
            this.leave(playerId);
            return success;
        }
        if (['updateSettings', 'startGame', 'resetGame'].includes(event) && this.host(room) !== playerId) {
            return fail('Only the host can do that.');
        }
        if (['updateSettings', 'startGame', 'switchTeam'].includes(event)) {
            if (room.status !== 'waiting' || data.lobbyId !== room.lobbyId)
                return fail('This lobby is no longer open.');
        }
        switch (event) {
            case 'updateSettings': {
                if (typeof data.rounds !== 'number' || ![3, 5, 7].includes(data.rounds) ||
                    typeof data.turnSeconds !== 'number' || ![30, 60, 90].includes(data.turnSeconds)) {
                    return fail('Choose 3, 5, or 7 rounds and 30, 60, or 90 seconds.');
                }
                room.settings = { rounds: data.rounds, turnSeconds: data.turnSeconds };
                this.broadcast(room);
                return success;
            }
            case 'switchTeam': {
                if (data.newTeam !== '1' && data.newTeam !== '2')
                    return fail('Choose Team 1 or Team 2.');
                this.removeFromTeams(room, playerId);
                room.teams[data.newTeam].push(playerId);
                this.broadcast(room);
                return success;
            }
            case 'startGame': {
                if (!room.teams['1'].length || !room.teams['2'].length)
                    return fail('Each team needs at least one player.');
                room.status = 'playing';
                room.matchId = (0, crypto_1.randomUUID)();
                room.participants = new Set(room.players.keys());
                room.notice = '';
                this.beginTurn(room);
                return success;
            }
            case 'resetGame': {
                if (room.status !== 'finished' || data.matchId !== room.matchId)
                    return fail('Play Again is available after this match finishes.');
                this.returnToLobby(room, 'Ready for a rematch. Choose your teams, then the host can start.');
                return success;
            }
            case 'guessWord':
            case 'correctWord':
            case 'skipWord': return this.play(room, playerId, event, data);
            default: return fail('Unknown action.');
        }
    }
    join(playerId, data) {
        if (typeof data.roomName !== 'string' || !/^[a-zA-Z0-9]{4,10}$/.test(data.roomName))
            return fail('Room names must be 4–10 letters or numbers.');
        if (data.nickname !== undefined && (typeof data.nickname !== 'string' || data.nickname.trim().length > 24))
            return fail('Display names must be 24 characters or fewer.');
        if (this.memberships.has(playerId) && this.memberships.get(playerId) !== data.roomName)
            this.leave(playerId);
        let room = this.rooms.get(data.roomName);
        if (!room) {
            room = {
                name: data.roomName, players: new Map(), teams: { '1': [], '2': [] }, participants: new Set(),
                status: 'waiting', phase: 'active', settings: { rounds: 3, turnSeconds: 60 }, lobbyId: (0, crypto_1.randomUUID)(),
                matchId: null, turnId: 0, currentTeam: '1', describer: null,
                describerIndexes: { '1': 0, '2': 0 }, word: null, usedWords: [], deadline: 0,
                timer: null, score: { '1': 0, '2': 0 }, history: [], guesses: [], seenActions: new Set(), notice: '',
            };
            this.rooms.set(room.name, room);
        }
        // Repeated joins from one connection cannot duplicate players or change roles.
        if (!room.players.has(playerId)) {
            const nickname = typeof data.nickname === 'string' ? data.nickname.trim() : '';
            room.players.set(playerId, nickname || (0, helpers_1.generateFunnyName)());
            this.memberships.set(playerId, room.name);
            if (room.status === 'waiting')
                this.assignTeam(room, playerId);
        }
        this.broadcast(room);
        return success;
    }
    leave(playerId) {
        const name = this.memberships.get(playerId);
        const room = name ? this.rooms.get(name) : undefined;
        this.memberships.delete(playerId);
        if (!room)
            return;
        const nickname = room.players.get(playerId);
        const cancel = room.status === 'playing' && room.participants.has(playerId);
        room.players.delete(playerId);
        this.removeFromTeams(room, playerId);
        if (!room.players.size) {
            this.clearTimer(room);
            this.rooms.delete(room.name);
        }
        else if (cancel) {
            this.returnToLobby(room, `Match canceled: ${nickname} left or disconnected. Everyone is back in the lobby.`);
        }
        else
            this.broadcast(room);
    }
    play(room, playerId, event, data) {
        if (room.status !== 'playing' || data.matchId !== room.matchId || data.turnId !== room.turnId)
            return fail('That turn has already ended.');
        if (room.phase !== 'active')
            return fail('Wait for the next word.');
        if (!room.participants.has(playerId))
            return fail('You are waiting for the next match.');
        if (event !== 'guessWord' && room.describer !== playerId)
            return fail('Only the current describer can mark Correct or Pass.');
        if (event === 'guessWord' && room.describer === playerId)
            return fail('Use Correct to confirm a spoken answer.');
        if (this.now() >= room.deadline) {
            this.resolveTurn(room, 'expired');
            return fail('Time expired before that action arrived.');
        }
        if (typeof data.actionId !== 'string' || !data.actionId || data.actionId.length > 100)
            return fail('A valid action identifier is required.');
        const actionKey = `${playerId}:${data.actionId}`;
        if (room.seenActions.has(actionKey))
            return success;
        if (event === 'guessWord') {
            if (typeof data.guess !== 'string' || !data.guess.trim() || data.guess.length > 120)
                return fail('Enter a guess of 1–120 characters.');
            room.seenActions.add(actionKey);
            if (normalizeGuess(data.guess) !== normalizeGuess(room.word || '')) {
                room.guesses.push({ name: room.players.get(playerId), guess: data.guess.trim(), round: this.round(room), team: room.currentTeam });
                room.guesses = room.guesses.slice(-100);
                this.broadcast(room);
                return success;
            }
        }
        room.seenActions.add(actionKey);
        this.resolveTurn(room, event === 'skipWord' ? 'passed' : 'correct');
        return success;
    }
    beginTurn(room) {
        room.currentTeam = room.turnId % 2 === 0 ? '1' : '2';
        const team = room.teams[room.currentTeam];
        room.describer = team[room.describerIndexes[room.currentTeam] % team.length];
        room.describerIndexes[room.currentTeam]++;
        room.word = (0, helpers_1.pickRandomWord)(room.usedWords);
        room.usedWords.push(room.word);
        room.seenActions.clear();
        this.setPhase(room, 'countdown', COUNTDOWN_MS);
    }
    setPhase(room, phase, duration) {
        this.clearTimer(room);
        room.phase = phase;
        room.deadline = this.now() + duration;
        const matchId = room.matchId;
        const turnId = room.turnId;
        let previousSeconds = this.phaseSeconds(room);
        room.timer = setInterval(() => {
            // Ignore callbacks queued before a phase, match, or room was replaced.
            if (this.rooms.get(room.name) !== room || room.status !== 'playing' ||
                room.matchId !== matchId || room.turnId !== turnId || room.phase !== phase)
                return;
            if (this.now() >= room.deadline) {
                if (phase === 'countdown')
                    this.setPhase(room, 'active', room.settings.turnSeconds * 1000);
                else if (phase === 'active')
                    this.resolveTurn(room, 'expired');
                else
                    this.advanceTurn(room);
            }
            else {
                const seconds = this.phaseSeconds(room);
                if (seconds !== previousSeconds) {
                    previousSeconds = seconds;
                    this.broadcast(room);
                }
            }
        }, 250);
        this.broadcast(room);
    }
    resolveTurn(room, outcome) {
        if (room.status !== 'playing' || room.phase !== 'active' || room.word === null)
            return;
        this.clearTimer(room);
        const points = outcome === 'correct' ? 1 : 0;
        room.score[room.currentTeam] += points;
        room.history.push({ round: this.round(room), team: room.currentTeam, outcome, points,
            word: room.word, describerName: room.players.get(room.describer) });
        room.word = null;
        this.setPhase(room, 'reveal', REVEAL_MS);
    }
    advanceTurn(room) {
        this.clearTimer(room);
        room.turnId++;
        if (room.turnId === room.settings.rounds * 2) {
            room.status = 'finished';
            room.describer = null;
            room.deadline = 0;
            this.broadcast(room);
        }
        else
            this.beginTurn(room);
    }
    returnToLobby(room, notice) {
        this.clearTimer(room);
        room.status = 'waiting';
        room.phase = 'active';
        room.lobbyId = (0, crypto_1.randomUUID)();
        room.matchId = null;
        room.turnId = 0;
        room.currentTeam = '1';
        room.describer = null;
        room.describerIndexes = { '1': 0, '2': 0 };
        room.word = null;
        room.usedWords = [];
        room.deadline = 0;
        room.score = { '1': 0, '2': 0 };
        room.history = [];
        room.guesses = [];
        room.participants.clear();
        room.seenActions.clear();
        room.notice = notice;
        for (const id of room.players.keys()) {
            if (!room.teams['1'].includes(id) && !room.teams['2'].includes(id))
                this.assignTeam(room, id);
        }
        this.broadcast(room);
    }
    assignTeam(room, id) {
        room.teams[room.teams['1'].length <= room.teams['2'].length ? '1' : '2'].push(id);
    }
    removeFromTeams(room, id) {
        for (const team of ['1', '2'])
            room.teams[team] = room.teams[team].filter(member => member !== id);
    }
    host(room) { return room.players.keys().next().value; }
    round(room) { return Math.min(Math.floor(room.turnId / 2) + 1, room.settings.rounds); }
    phaseSeconds(room) { return room.status === 'playing' ? Math.max(0, Math.ceil((room.deadline - this.now()) / 1000)) : 0; }
    timeLeft(room) {
        if (room.status !== 'playing')
            return 0;
        return room.phase === 'countdown' ? room.settings.turnSeconds : room.phase === 'active' ? this.phaseSeconds(room) : 0;
    }
    clearTimer(room) { if (room.timer)
        clearInterval(room.timer); room.timer = null; }
    snapshot(playerId) {
        const name = this.memberships.get(playerId);
        const room = name ? this.rooms.get(name) : undefined;
        if (!room)
            return undefined;
        return {
            roomName: room.name, players: [...room.players.keys()], nicknames: Object.fromEntries(room.players),
            hostId: this.host(room), teams: { '1': [...room.teams['1']], '2': [...room.teams['2']] },
            waitingPlayers: [...room.players.keys()].filter(id => !room.teams['1'].includes(id) && !room.teams['2'].includes(id)),
            status: room.status, phase: room.phase, phaseSeconds: this.phaseSeconds(room), settings: { ...room.settings }, lobbyId: room.lobbyId, matchId: room.matchId,
            turnId: room.turnId, round: this.round(room), currentTeam: room.currentTeam, describer: room.describer,
            yourWord: room.status === 'playing' && room.phase === 'active' && room.describer === playerId ? room.word : null,
            timeLeft: this.timeLeft(room), score: { ...room.score }, history: room.history.map(turn => ({ ...turn })),
            guesses: room.guesses.map(guess => ({ ...guess })), notice: room.notice,
            winner: room.status !== 'finished' ? null : room.score['1'] === room.score['2'] ? 'draw' : room.score['1'] > room.score['2'] ? '1' : '2',
        };
    }
    broadcast(room) {
        for (const id of room.players.keys())
            this.publish(id, this.snapshot(id));
    }
    dispose() {
        for (const room of this.rooms.values())
            this.clearTimer(room);
        this.rooms.clear();
        this.memberships.clear();
    }
}
exports.MatchRooms = MatchRooms;
//# sourceMappingURL=game.js.map
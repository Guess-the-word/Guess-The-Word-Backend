import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { pickRandomWord, generateFunnyName } from './helpers';

interface RoomState {
  players: string[];
  status: 'waiting' | 'playing';
  teams: { [teamId: string]: string[] };
  currentTeam: number;
  describer: string | null;
  word: string | null;
  score: { [teamId: string]: number };
  timer: NodeJS.Timeout | null;
  timeLeft: number;
  nicknames: Record<string, string>;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const rooms: Record<string, RoomState> = {};
const GAME_DURATION = 60;

function removePlayerFromRoom(socketId: string, roomName: string): boolean {
  const room = rooms[roomName];
  if (!room) return false;

  const playerIndex = room.players.indexOf(socketId);
  if (playerIndex === -1) return false;

  room.players.splice(playerIndex, 1);
  delete room.nicknames[socketId];

  for (const arr of Object.values(room.teams)) {
    const idx = arr.indexOf(socketId);
    if (idx >= 0) arr.splice(idx, 1);
  }

  if (room.describer === socketId) {
    clearGameTimer(room);
    if (room.players.length > 0) {
      nextTurn(roomName);
    } else {
      resetGameState(room);
    }
  }

  if (room.players.length === 0) {
    clearGameTimer(room);
    delete rooms[roomName];
    return true;
  }

  return true;
}

function clearGameTimer(room: RoomState): void {
  if (room.timer) {
    clearInterval(room.timer);
    room.timer = null;
  }
}

function resetGameState(room: RoomState): void {
  room.status = 'waiting';
  room.describer = null;
  room.word = null;
}

function initializeRoom(roomName: string): RoomState {
  return {
    players: [],
    status: 'waiting',
    teams: {},
    currentTeam: 1,
    describer: null,
    word: null,
    score: {},
    timer: null,
    timeLeft: 0,
    nicknames: {},
  };
}

function ensureTeamsExist(room: RoomState): void {
  if (Object.keys(room.teams).length === 0) {
    room.teams['1'] = [];
    room.teams['2'] = [];
    room.score['1'] = 0;
    room.score['2'] = 0;
  }
}

function addPlayerToRoom(socketId: string, room: RoomState): void {
  if (!room.players.includes(socketId)) {
    room.players.push(socketId);
    room.nicknames[socketId] = generateFunnyName();
  }

  ensureTeamsExist(room);
  
  if (!room.teams['1'].includes(socketId) && !room.teams['2'].includes(socketId)) {
    room.teams['1'].push(socketId);
  }
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('webrtc-signal', (payload) => {
    io.to(payload.target).emit('webrtc-signal', {
      signal: payload.signal,
      callerId: payload.callerId,
    });
  });

  socket.on('joinRoom', ({ roomName }) => {
    if (!rooms[roomName]) {
      rooms[roomName] = initializeRoom(roomName);
    }
    
    const room = rooms[roomName];
    addPlayerToRoom(socket.id, room);
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
    if (!room) return;

    for (const [teamId, arr] of Object.entries(room.teams)) {
      const i = arr.indexOf(socket.id);
      if (i >= 0) arr.splice(i, 1);
    }

    if (!room.teams[newTeam]) {
      room.teams[newTeam] = [];
      room.score[newTeam] = 0;
    }
    room.teams[newTeam].push(socket.id);
    broadcastRoomUpdate(roomName);
  });

  socket.on('startGame', ({ roomName }) => {
    const room = rooms[roomName];
    if (!room) return;
    
    const availableTeam = room.teams['1'].length > 0 ? 1 : 
                         room.teams['2'].length > 0 ? 2 : null;
    
    if (!availableTeam) return;
    
    room.status = 'playing';
    room.currentTeam = availableTeam;
    room.describer = room.teams[room.currentTeam][0] || null;
    room.word = pickRandomWord();
    
    startTimer(roomName, GAME_DURATION);

    io.to(roomName).emit('gameStarted', {
      status: room.status,
      currentTeam: room.currentTeam,
      describer: room.describer,
      score: room.score,
    });
    
    if (room.describer) {
      io.to(room.describer).emit('yourWord', { word: room.word });
    }
  });

  socket.on('guessWord', ({ roomName, guess }) => {
    const room = rooms[roomName];
    if (!room || !room.word) return;

    const isCorrect = guess.toLowerCase() === room.word.toLowerCase();
    
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
    } else {
      io.to(roomName).emit('guessResult', {
        guess,
        correct: false,
      });
    }
  });

  socket.on('resetGame', ({ roomName }) => {
    const room = rooms[roomName];
    if (!room) return;

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

function broadcastRoomUpdate(roomName: string): void {
  const room = rooms[roomName];
  if (!room) return;

  console.log(`Broadcasting room update for ${roomName}. Players: ${room.players.length}`);

  io.to(roomName).emit('roomUpdate', {
    roomName,
    players: room.players,
    status: room.status,
    teams: room.teams,
    score: room.score,
    currentTeam: room.currentTeam,
    nicknames: room.nicknames,
  });
}

function startTimer(roomName: string, duration: number): void {
  const room = rooms[roomName];
  if (!room) return;

  room.timeLeft = duration;
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

function nextTurn(roomName: string): void {
  const room = rooms[roomName];
  if (!room) return;

  const proposedTeam = room.currentTeam === 1 ? 2 : 1;
  
  if (room.teams[proposedTeam] && room.teams[proposedTeam].length > 0) {
    room.currentTeam = proposedTeam;
  } else if (room.teams[room.currentTeam].length === 0) {
    return;
  }

  if (room.teams[room.currentTeam].length === 0) return;

  room.describer = room.teams[room.currentTeam][0];
  room.word = pickRandomWord();
  startTimer(roomName, GAME_DURATION);

  io.to(roomName).emit('nextTurn', {
    currentTeam: room.currentTeam,
    describer: room.describer,
    score: room.score,
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

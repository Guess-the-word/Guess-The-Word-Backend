import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { pickRandomWord, generateFunnyName } from './helpers';

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

// --------------------------------
// Types & In-Memory State
// --------------------------------
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
  nicknames: Record<string, string>; // NEW: to map socket.id -> funny name
}

const rooms: Record<string, RoomState> = {};

// helper functions are in a separate module

// Helper function to remove a player from a room
function removePlayerFromRoom(socketId: string, roomName: string) {
  const room = rooms[roomName];
  if (!room) return false;

  // Remove from players list
  const playerIndex = room.players.indexOf(socketId);
  if (playerIndex === -1) return false; // Player wasn't in this room

  room.players.splice(playerIndex, 1);
  delete room.nicknames[socketId];

  // Remove from teams
  for (const arr of Object.values(room.teams)) {
    const idx = arr.indexOf(socketId);
    if (idx >= 0) arr.splice(idx, 1);
  }

  // If this was the describer, we need to handle the game state
  if (room.describer === socketId) {
    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }
    // Move to next turn or stop the game if no players left
    if (room.players.length > 0) {
      nextTurn(roomName);
    } else {
      room.status = 'waiting';
      room.describer = null;
      room.word = null;
    }
  }

  // If room is empty, delete it
  if (room.players.length === 0) {
    if (room.timer) clearInterval(room.timer);
    delete rooms[roomName];
    return true; // Room was deleted
  }

  return true; // Player was removed successfully
}

// --------------------------------
// Socket Events
// --------------------------------
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Minimal WebRTC relay
  socket.on('webrtc-signal', (payload) => {
    io.to(payload.target).emit('webrtc-signal', {
      signal: payload.signal,
      callerId: payload.callerId,
    });
  });

  // 1. Join or Create a Room
  socket.on('joinRoom', ({ roomName }) => {
    if (!rooms[roomName]) {
      rooms[roomName] = {
        players: [],
        status: 'waiting',
        teams: {},
        currentTeam: 1,
        describer: null,
        word: null,
        score: {},
        timer: null,
        timeLeft: 0,
        nicknames: {}, // initialize
      };
    }
    const room = rooms[roomName];

    // If the user hasn't joined yet
    if (!room.players.includes(socket.id)) {
      room.players.push(socket.id);
      // Generate a name for them
      room.nicknames[socket.id] = generateFunnyName();
    }
    socket.join(roomName);

    // If no teams exist, create them
    if (Object.keys(room.teams).length === 0) {
      room.teams['1'] = [];
      room.teams['2'] = [];
      room.score['1'] = 0;
      room.score['2'] = 0;
    }
    // For simplicity, put all new players in Team 1
    if (!room.teams['1'].includes(socket.id) && !room.teams['2'].includes(socket.id)) {
      room.teams['1'].push(socket.id);
    }

    broadcastRoomUpdate(roomName);
  });

  // NEW: Handle explicit leave room requests
  socket.on('leaveRoom', ({ roomName }) => {
    console.log(`Player ${socket.id} is leaving room ${roomName}`);
    
    // Leave the socket room
    socket.leave(roomName);
    
    // Remove player from room state
    const roomExists = removePlayerFromRoom(socket.id, roomName);
    
    // Broadcast update to remaining players
    if (roomExists && rooms[roomName]) {
      broadcastRoomUpdate(roomName);
    }
  });

  // 2. Switch Team
  socket.on('switchTeam', ({ roomName, newTeam }) => {
    const room = rooms[roomName];
    if (!room) return;

    // remove from old team
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

  // 3. Start Game
  socket.on('startGame', ({ roomName }) => {
    const room = rooms[roomName];
    if (!room) return;
    room.status = 'playing';

    // pick the first team that has players
    if (room.teams['1'].length > 0) {
      room.currentTeam = 1;
    } else if (room.teams['2'].length > 0) {
      room.currentTeam = 2;
    } else {
      // no players to start the game
      return;
    }

    room.describer = room.teams[room.currentTeam][0] || null;
    room.word = pickRandomWord();
    startTimer(roomName, 60);

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

  // 4. Guess Word => correct or not
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

      if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
      }
      nextTurn(roomName);
    } else {
      io.to(roomName).emit('guessResult', {
        guess,
        correct: false,
      });
    }
  });

  // 5. Reset Game => resets status, word, timer, and scores
  socket.on('resetGame', ({ roomName }) => {
    const room = rooms[roomName];
    if (!room) return;

    room.status = 'waiting';
    room.word = null;
    room.describer = null;
    if (room.timer) {
      clearInterval(room.timer);
      room.timer = null;
    }
    room.timeLeft = 0;
    Object.keys(room.score).forEach((key) => {
      room.score[key] = 0;
    });

    broadcastRoomUpdate(roomName);
  });

  // 6. Disconnect => clean up (fallback for unexpected disconnections)
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
    
    // Check all rooms for this player
    Object.entries(rooms).forEach(([roomName, room]) => {
      if (room.players.includes(socket.id)) {
        console.log(`Removing ${socket.id} from room ${roomName} due to disconnect`);
        removePlayerFromRoom(socket.id, roomName);
        
        // Broadcast update to remaining players if room still exists
        if (rooms[roomName]) {
          broadcastRoomUpdate(roomName);
        }
      }
    });
  });
});

// Helper to broadcast updated room info
function broadcastRoomUpdate(roomName: string) {
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
    nicknames: room.nicknames, // <--- pass the names
  });
}

// Timer & Next Turn
function startTimer(roomName: string, duration: number) {
  const room = rooms[roomName];
  if (!room) return;

  room.timeLeft = duration;
  room.timer = setInterval(() => {
    room.timeLeft -= 1;
    io.to(roomName).emit('timerUpdate', { timeLeft: room.timeLeft });
    if (room.timeLeft <= 0) {
      clearInterval(room.timer!);
      room.timer = null;
      io.to(roomName).emit('timeUp', {});
      nextTurn(roomName);
    }
  }, 1000);
}

function nextTurn(roomName: string) {
  const room = rooms[roomName];
  if (!room) return;

  const proposedTeam = room.currentTeam === 1 ? 2 : 1;
  if (room.teams[proposedTeam] && room.teams[proposedTeam].length > 0) {
    room.currentTeam = proposedTeam;
  } else if (room.teams[room.currentTeam].length === 0) {
    // both teams empty, nothing to do
    return;
  }

  if (room.teams[room.currentTeam].length === 0) return;

  room.describer = room.teams[room.currentTeam][0];
  room.word = pickRandomWord();
  startTimer(roomName, 60);

  io.to(roomName).emit('nextTurn', {
    currentTeam: room.currentTeam,
    describer: room.describer,
    score: room.score,
  });
  if (room.describer) {
    io.to(room.describer).emit('yourWord', { word: room.word });
  }
}

// Express
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

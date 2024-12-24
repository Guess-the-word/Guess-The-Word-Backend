import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// --------------------------------
// In-Memory Data (same as before)
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
}

const rooms: Record<string, RoomState> = {};

const WORDS = [
  "apple", "banana", "table", "soccer", "javascript", "elephant", "kangaroo",
  "avocado", "spaceship", "submarine", "lighthouse", "telescope", "catch phrase",
];

// Utility to pick random word
function pickRandomWord() {
  const idx = Math.floor(Math.random() * WORDS.length);
  return WORDS[idx];
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // ------------------------------------------------------
  // 1. WebRTC Signaling Relay
  // ------------------------------------------------------
  socket.on('webrtc-signal', (payload) => {
    // payload: { target, signal, callerId }
    // We'll forward this to the target
    io.to(payload.target).emit('webrtc-signal', {
      signal: payload.signal,
      callerId: payload.callerId,
    });
  });

  // ------------------------------------------------------
  // 2. Join or Create a Room
  // ------------------------------------------------------
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
      };
    }

    const room = rooms[roomName];
    if (!room.players.includes(socket.id)) {
      room.players.push(socket.id);
    }
    socket.join(roomName);

    if (Object.keys(room.teams).length === 0) {
      room.teams['1'] = [];
      room.teams['2'] = [];
      room.score['1'] = 0;
      room.score['2'] = 0;
    }
    // For simplicity, push all new players to team 1
    if (!room.teams['1'].includes(socket.id) && !room.teams['2'].includes(socket.id)) {
      room.teams['1'].push(socket.id);
    }

    io.to(roomName).emit('roomUpdate', {
      roomName,
      players: room.players,
      status: room.status,
      teams: room.teams,
      score: room.score,
      currentTeam: room.currentTeam,
    });
  });

  // ------------------------------------------------------
  // 3. Switch Team
  // ------------------------------------------------------
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

    io.to(roomName).emit('roomUpdate', {
      roomName,
      players: room.players,
      status: room.status,
      teams: room.teams,
      score: room.score,
      currentTeam: room.currentTeam,
    });
  });

  // ------------------------------------------------------
  // 4. Start Game
  // ------------------------------------------------------
  socket.on('startGame', ({ roomName }) => {
    const room = rooms[roomName];
    if (!room) return;
    room.status = 'playing';
    room.currentTeam = 1;
    if (room.teams[room.currentTeam].length === 0) {
      room.currentTeam = 2;
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

  // ------------------------------------------------------
  // 5. Guess a Word
  // ------------------------------------------------------
  socket.on('guessWord', ({ roomName, guess }) => {
    const room = rooms[roomName];
    if (!room || !room.word) return;

    if (guess.toLowerCase() === room.word.toLowerCase()) {
      room.score[room.currentTeam] = (room.score[room.currentTeam] || 0) + 1;

      io.to(roomName).emit('correctGuess', {
        team: room.currentTeam,
        word: room.word,
        score: room.score,
      });

      if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
      }

      nextTurn(roomName);
    }
  });

  // ------------------------------------------------------
  // 6. Disconnect Cleanup
  // ------------------------------------------------------
  socket.on('disconnect', () => {
    Object.entries(rooms).forEach(([roomName, room]) => {
      const i = room.players.indexOf(socket.id);
      if (i >= 0) {
        room.players.splice(i, 1);

        // remove from teams
        for (const [teamId, arr] of Object.entries(room.teams)) {
          const idx = arr.indexOf(socket.id);
          if (idx >= 0) arr.splice(idx, 1);
        }

        if (room.players.length === 0) {
          if (room.timer) clearInterval(room.timer);
          delete rooms[roomName];
        } else {
          io.to(roomName).emit('roomUpdate', {
            roomName,
            players: room.players,
            status: room.status,
            teams: room.teams,
            score: room.score,
            currentTeam: room.currentTeam,
          });
        }
      }
    });
  });
});

// ------------------------------------------------------
// Helper Functions
// ------------------------------------------------------
function startTimer(roomName: string, duration: number) {
  const room = rooms[roomName];
  if (!room) return;
  room.timeLeft = duration;

  const tick = () => {
    room.timeLeft -= 1;
    io.to(roomName).emit('timerUpdate', { timeLeft: room.timeLeft });
    if (room.timeLeft <= 0) {
      clearInterval(room.timer!);
      room.timer = null;
      io.to(roomName).emit('timeUp', {});
      nextTurn(roomName);
    }
  };

  room.timer = setInterval(tick, 1000);
}

function nextTurn(roomName: string) {
  const room = rooms[roomName];
  if (!room) return;

  if (room.currentTeam === 1) {
    room.currentTeam = 2;
  } else {
    room.currentTeam = 1;
  }
  if (room.teams[room.currentTeam].length === 0) return;
  room.describer = room.teams[room.currentTeam][0] || null;
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

// Express route
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Start server
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
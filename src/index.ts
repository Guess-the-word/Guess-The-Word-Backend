import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

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

// ------------------
// In-Memory Data
// ------------------
interface RoomState {
  players: string[];
  status: 'waiting' | 'playing';
  teams: { [teamId: number]: string[] };   // team -> array of socket IDs
  currentTeam: number;                     // which team is playing
  describer: string | null;               // socket ID who is describing
  word: string | null;                    // current word
  score: { [teamId: number]: number };    // team -> points
  timer: NodeJS.Timeout | null;           // for clearing timer
  timeLeft: number;                       // how many seconds remain
}

const rooms: Record<string, RoomState> = {};

// Example word list
const WORDS = [
  "apple",
  "banana",
  "table",
  "soccer",
  "javascript",
  "elephant",
  "kangaroo",
  "avocado",
  "spaceship",
  "submarine",
  "lighthouse",
  "telescope",
  "catch phrase",
];

// Utility: pick random word from the list
function pickRandomWord() {
  const idx = Math.floor(Math.random() * WORDS.length);
  return WORDS[idx];
}

// ------------------
// Socket Events
// ------------------
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 1. Join or Create Room
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
    // Add player if not already present
    if (!room.players.includes(socket.id)) {
      room.players.push(socket.id);
    }
    socket.join(roomName);

    // Default: if no teams exist, create 2 teams (Team 1, Team 2) as an example
    if (Object.keys(room.teams).length === 0) {
      room.teams[1] = [];
      room.teams[2] = [];
      room.score[1] = 0;
      room.score[2] = 0;
    }

    // We can, by default, push all new players to team 1, or automatically balance
    // For simplicity, let's push everyone to Team 1 initially
    if (!room.teams[1].includes(socket.id) && !room.teams[2].includes(socket.id)) {
      room.teams[1].push(socket.id);
    }

    // Notify everyone in the room
    io.to(roomName).emit('roomUpdate', {
      roomName,
      players: room.players,
      status: room.status,
      teams: room.teams,
      score: room.score,
      currentTeam: room.currentTeam
    });
  });

  // 2. Switch a player to a given team
  socket.on('switchTeam', ({ roomName, newTeam }) => {
    const room = rooms[roomName];
    if (!room) return;

    // remove from old team
    for (const [teamId, playerArr] of Object.entries(room.teams)) {
      const idx = playerArr.indexOf(socket.id);
      if (idx > -1) {
        playerArr.splice(idx, 1);
      }
    }
    // add to new team
    if (!room.teams[newTeam]) {
      room.teams[newTeam] = [];
      room.score[newTeam] = 0;
    }
    room.teams[newTeam].push(socket.id);

    // notify
    io.to(roomName).emit('roomUpdate', {
      roomName,
      players: room.players,
      status: room.status,
      teams: room.teams,
      score: room.score,
      currentTeam: room.currentTeam
    });
  });

  // 3. Start the game (and the first turn)
  socket.on('startGame', ({ roomName }) => {
    const room = rooms[roomName];
    if (!room) return;

    // set status to playing
    room.status = 'playing';
    // start with team 1 (for example)
    room.currentTeam = 1;
    // pick a describer from that team
    if (room.teams[room.currentTeam].length === 0) {
      // no one in team 1, fallback to team 2
      room.currentTeam = 2;
    }
    room.describer = room.teams[room.currentTeam][0] || null;
    // pick word
    room.word = pickRandomWord();
    // start timer
    startTimer(roomName, 60); // 60-second round

    // send event to room
    io.to(roomName).emit('gameStarted', {
      status: room.status,
      currentTeam: room.currentTeam,
      describer: room.describer,
      score: room.score,
    });

    // send secret word ONLY to the describer
    if (room.describer) {
      io.to(room.describer).emit('yourWord', { word: room.word });
    }
  });

  // 4. Handle guesses
  socket.on('guessWord', ({ roomName, guess }) => {
    const room = rooms[roomName];
    if (!room) return;

    // If guess is correct, end the round immediately
    if (room.word && guess.toLowerCase() === room.word.toLowerCase()) {
      // give a point to currentTeam
      room.score[room.currentTeam] = (room.score[room.currentTeam] || 0) + 1;

      io.to(roomName).emit('correctGuess', {
        team: room.currentTeam,
        word: room.word,
        score: room.score
      });

      // clear the timer
      if (room.timer) {
        clearInterval(room.timer);
        room.timer = null;
      }

      // next turn
      nextTurn(roomName);
    }
  });

  socket.on('disconnect', () => {
    // Clean up rooms when players leave
    Object.entries(rooms).forEach(([roomName, room]) => {
      const index = room.players.indexOf(socket.id);
      if (index > -1) {
        room.players.splice(index, 1);

        // Remove from teams
        for (const [teamId, arr] of Object.entries(room.teams)) {
          const idx = arr.indexOf(socket.id);
          if (idx > -1) arr.splice(idx, 1);
        }

        // If the room is now empty, delete it
        if (room.players.length === 0) {
          if (room.timer) {
            clearInterval(room.timer);
          }
          delete rooms[roomName];
        } else {
          // Otherwise broadcast updated room info
          io.to(roomName).emit('roomUpdate', {
            roomName,
            players: room.players,
            status: room.status,
            teams: room.teams,
            score: room.score,
            currentTeam: room.currentTeam
          });
        }
      }
    });
  });
});

// ------------------
// Helper Functions
// ------------------
function startTimer(roomName: string, duration: number) {
  const room = rooms[roomName];
  if (!room) return;

  room.timeLeft = duration;

  const tick = () => {
    room.timeLeft -= 1;
    io.to(roomName).emit('timerUpdate', { timeLeft: room.timeLeft });

    if (room.timeLeft <= 0) {
      // time is up
      clearInterval(room.timer!);
      room.timer = null;
      io.to(roomName).emit('timeUp', {});

      // move to next turn
      nextTurn(roomName);
    }
  };

  // run every second
  room.timer = setInterval(tick, 1000);
}

function nextTurn(roomName: string) {
  const room = rooms[roomName];
  if (!room) return;

  // simple approach: switch between team 1 and 2
  // you can handle more teams or cycically loop across available teams
  if (room.currentTeam === 1) {
    room.currentTeam = 2;
  } else {
    room.currentTeam = 1;
  }

  // find a new describer from that team (or same player)
  if (room.teams[room.currentTeam].length === 0) {
    // if no players in that team, skip
    // you could also end the game
    return;
  }
  room.describer = room.teams[room.currentTeam][0] || null;

  // pick new word
  room.word = pickRandomWord();

  // start a new timer
  startTimer(roomName, 60);

  // broadcast to all
  io.to(roomName).emit('nextTurn', {
    currentTeam: room.currentTeam,
    describer: room.describer,
    score: room.score,
  });

  // only to describer
  if (room.describer) {
    io.to(room.describer).emit('yourWord', { word: room.word });
  }
}

// ------------------
// Express Routes
// ------------------
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// start server
const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
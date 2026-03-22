import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import {
  getOrCreateRoom,
  addPlayerToRoom,
  removePlayerFromRoom,
  startGame,
  checkGuess,
  resetGame,
  decrementTimer,
  rooms
} from './roomManager';
import { 
  JoinRoomPayload, 
  StartGamePayload, 
  GuessWordPayload, 
  ResetGamePayload,
  WebRTCSignalPayload
} from './types';

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const server = http.createServer(app);

// Create Socket.IO server
const io = new Server(server, {
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
  socket.on('joinRoom', (payload: JoinRoomPayload) => {
    const { roomName } = payload;
    
    // Join the Socket.IO room
    socket.join(roomName);
    
    // Add player to the room
    addPlayerToRoom(roomName, socket.id);
    
    // Broadcast room update to all clients in the room
    io.to(roomName).emit('roomUpdate', rooms[roomName]);
    
    console.log(`User ${socket.id} joined room: ${roomName}`);
  });
  
  // Start Game
  socket.on('startGame', (payload: StartGamePayload) => {
    const { roomName } = payload;
    const room = rooms[roomName];
    
    if (!room) return;
    
    // Start the game
    startGame(roomName);
    
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
      if (!rooms[roomName] || rooms[roomName].status !== 'playing') {
        clearInterval(timerId);
        return;
      }
      
      // Decrement the timer
      const timeUp = decrementTimer(roomName);
      
      // Broadcast the updated time
      io.to(roomName).emit('timerUpdate', { timeLeft: rooms[roomName].timeLeft });
      
      // If time is up, broadcast timeUp event
      if (timeUp) {
        io.to(roomName).emit('timeUp');
        
        // Broadcast next turn
        io.to(roomName).emit('nextTurn', {
          currentTeam: rooms[roomName].currentTeam,
          describer: rooms[roomName].describer,
          timeLeft: rooms[roomName].timeLeft
        });
        
        // Send the new secret word to the new describer
        io.to(rooms[roomName].describer).emit('yourWord', { word: rooms[roomName].word });
      }
    }, 1000);
  });
  
  // Guess Word
  socket.on('guessWord', (payload: GuessWordPayload) => {
    const { roomName, guess } = payload;
    const room = rooms[roomName];
    
    if (!room || room.status !== 'playing') return;
    
    // Check if the guess is correct
    const isCorrect = checkGuess(roomName, socket.id, guess);
    
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
  socket.on('resetGame', (payload: ResetGamePayload) => {
    const { roomName } = payload;
    
    // Reset the game
    resetGame(roomName);
    
    // Broadcast room update to all clients in the room
    io.to(roomName).emit('roomUpdate', rooms[roomName]);
    
    console.log(`Game reset in room: ${roomName}`);
  });
  
  // WebRTC Signaling (for optional video chat)
  socket.on('webrtc-signal', (payload: WebRTCSignalPayload) => {
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
    Object.keys(rooms).forEach(roomName => {
      if (rooms[roomName].players.includes(socket.id)) {
        removePlayerFromRoom(roomName, socket.id);
        
        // If room still exists, broadcast update
        if (rooms[roomName]) {
          io.to(roomName).emit('roomUpdate', rooms[roomName]);
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

export default server;

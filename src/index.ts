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

// In-memory room storage
const rooms: Record<string, {
  players: string[];
  status: 'waiting' | 'playing';
}> = {};

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('joinRoom', ({ roomName }) => {
    // Create room if it doesn't exist
    if (!rooms[roomName]) {
      rooms[roomName] = {
        players: [],
        status: 'waiting'
      };
    }

    // Add player to room
    socket.join(roomName);
    rooms[roomName].players.push(socket.id);

    // Notify everyone in the room
    io.to(roomName).emit('roomUpdate', {
      roomName,
      players: rooms[roomName].players,
      status: rooms[roomName].status
    });
  });

  socket.on('disconnect', () => {
    // Clean up rooms when players leave
    Object.entries(rooms).forEach(([roomName, room]) => {
      const index = room.players.indexOf(socket.id);
      if (index > -1) {
        room.players.splice(index, 1);
        if (room.players.length === 0) {
          delete rooms[roomName];
        } else {
          io.to(roomName).emit('roomUpdate', {
            roomName,
            players: room.players,
            status: room.status
          });
        }
      }
    });
  });
});

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
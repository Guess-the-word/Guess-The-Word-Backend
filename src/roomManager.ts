import { Room, RoomStorage } from './types';
import { getRandomWord, generateNickname } from './utils';

// In-memory storage for rooms
export const rooms: RoomStorage = {};

// Create a new room or get existing one
export function getOrCreateRoom(roomName: string): Room {
  if (!rooms[roomName]) {
    rooms[roomName] = {
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
  return rooms[roomName];
}

// Add a player to a room
export function addPlayerToRoom(roomName: string, socketId: string): void {
  const room = getOrCreateRoom(roomName);
  
  // Add player if not already in the room
  if (!room.players.includes(socketId)) {
    room.players.push(socketId);
    
    // Assign a nickname
    room.nicknames[socketId] = generateNickname();
    
    // Assign to a team (alternating between teams for balance)
    const teamWithFewerPlayers = 
      room.teams['1'].length <= room.teams['2'].length ? '1' : '2';
    room.teams[teamWithFewerPlayers].push(socketId);
  }
}

// Remove a player from a room
export function removePlayerFromRoom(roomName: string, socketId: string): void {
  const room = rooms[roomName];
  if (!room) return;
  
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
    delete rooms[roomName];
    return;
  }
  
  // If the describer left during a game, move to next turn
  if (room.status === 'playing' && room.describer === socketId) {
    nextTurn(roomName);
  }
}

// Start the game
export function startGame(roomName: string): void {
  const room = rooms[roomName];
  if (!room) return;
  
  room.status = 'playing';
  room.score = { '1': 0, '2': 0 };
  room.currentTeam = '1';
  room.timeLeft = 60;
  
  // Select first describer from team 1
  if (room.teams['1'].length > 0) {
    room.describer = room.teams['1'][0];
  } else if (room.teams['2'].length > 0) {
    // If team 1 is empty, use team 2
    room.currentTeam = '2';
    room.describer = room.teams['2'][0];
  } else {
    // No players in teams, can't start
    room.status = 'waiting';
    return;
  }
  
  // Select a random word
  room.word = getRandomWord();
  
  // Clear guess console
  room.guessConsole = [];
}

// Check if a guess is correct
export function checkGuess(roomName: string, socketId: string, guess: string): boolean {
  const room = rooms[roomName];
  if (!room || room.status !== 'playing') return false;
  
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

// Move to the next turn
export function nextTurn(roomName: string): void {
  const room = rooms[roomName];
  if (!room || room.status !== 'playing') return;
  
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
  } else {
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
    } else {
      // No players in either team, reset to waiting
      resetGame(roomName);
      return;
    }
  }
  
  // Select a new random word
  room.word = getRandomWord();
}

// Reset the game
export function resetGame(roomName: string): void {
  const room = rooms[roomName];
  if (!room) return;
  
  room.status = 'waiting';
  room.score = { '1': 0, '2': 0 };
  room.currentTeam = '1';
  room.describer = '';
  room.word = '';
  room.timeLeft = 60;
  room.guessConsole = [];
}

// Decrement the timer
export function decrementTimer(roomName: string): boolean {
  const room = rooms[roomName];
  if (!room || room.status !== 'playing') return false;
  
  room.timeLeft--;
  
  // If timer reaches 0, move to next turn
  if (room.timeLeft <= 0) {
    nextTurn(roomName);
    return true;
  }
  
  return false;
}

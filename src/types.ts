// Define types for the Guess The Word game

// Room structure
export interface Room {
  players: string[];  // Array of socket IDs
  teams: {
    [teamId: string]: string[]  // Team ID -> Array of socket IDs
  };
  score: {
    [teamId: string]: number  // Team ID -> Score
  };
  status: "waiting" | "playing";
  currentTeam: string;  // Current team's ID
  describer: string;  // Socket ID of current describer
  word: string;  // Current secret word
  timeLeft: number;  // Seconds remaining in current turn
  nicknames: {
    [socketId: string]: string  // Socket ID -> Nickname
  };
  guessConsole: {
    player: string;
    guess: string;
    correct: boolean;
    timestamp: number;
  }[];
}

// In-memory storage type
export interface RoomStorage {
  [roomName: string]: Room;
}

// Socket.IO Event Payloads
export interface JoinRoomPayload {
  roomName: string;
}

export interface StartGamePayload {
  roomName: string;
}

export interface GuessWordPayload {
  roomName: string;
  guess: string;
}

export interface ResetGamePayload {
  roomName: string;
}

export interface WebRTCSignalPayload {
  roomName: string;
  to: string;
  signal: any;
}

// Server to Client Event Payloads
export interface GameStartedPayload {
  currentTeam: string;
  describer: string;
  timeLeft: number;
}

export interface YourWordPayload {
  word: string;
}

export interface GuessResultPayload {
  player: string;
  guess: string;
  correct: boolean;
}

export interface NextTurnPayload {
  currentTeam: string;
  describer: string;
  timeLeft: number;
}

export interface WebRTCSignalResponsePayload {
  from: string;
  signal: any;
}

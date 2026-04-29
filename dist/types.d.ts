export interface Room {
    players: string[];
    teams: {
        [teamId: string]: string[];
    };
    score: {
        [teamId: string]: number;
    };
    status: "waiting" | "playing";
    currentTeam: string;
    describer: string;
    word: string;
    timeLeft: number;
    nicknames: {
        [socketId: string]: string;
    };
    guessConsole: {
        player: string;
        guess: string;
        correct: boolean;
        timestamp: number;
    }[];
}
export interface RoomStorage {
    [roomName: string]: Room;
}
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
//# sourceMappingURL=types.d.ts.map
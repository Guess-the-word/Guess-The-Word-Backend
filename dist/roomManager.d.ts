import { Room, RoomStorage } from './types';
export declare const rooms: RoomStorage;
export declare function getOrCreateRoom(roomName: string): Room;
export declare function addPlayerToRoom(roomName: string, socketId: string): void;
export declare function removePlayerFromRoom(roomName: string, socketId: string): void;
export declare function startGame(roomName: string): void;
export declare function checkGuess(roomName: string, socketId: string, guess: string): boolean;
export declare function nextTurn(roomName: string): void;
export declare function resetGame(roomName: string): void;
export declare function decrementTimer(roomName: string): boolean;
//# sourceMappingURL=roomManager.d.ts.map
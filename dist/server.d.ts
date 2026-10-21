/// <reference types="node" />
import { Server } from 'socket.io';
import { MatchRooms } from './game';
export declare function createGameServer(): {
    app: import("express-serve-static-core").Express;
    httpServer: import("http").Server<typeof import("http").IncomingMessage, typeof import("http").ServerResponse>;
    io: Server<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
    game: MatchRooms;
    close: () => Promise<void>;
};
//# sourceMappingURL=server.d.ts.map
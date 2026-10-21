"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server");
const { httpServer } = (0, server_1.createGameServer)();
const port = Number(process.env.PORT) || 4000;
httpServer.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`Server running on port ${port}`));
//# sourceMappingURL=index.js.map
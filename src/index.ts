import { createGameServer } from './server';

const { httpServer } = createGameServer();
const port = Number(process.env.PORT) || 4000;
httpServer.listen(port, process.env.HOST || '0.0.0.0', () => console.log(`Server running on port ${port}`));

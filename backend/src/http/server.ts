import { buildContainer } from '../container.js';
import { disconnectPrisma } from '../infrastructure/db/prisma.js';
import { closeOpensearch } from '../infrastructure/opensearch/client.js';
import { createApp } from './app.js';

const container = buildContainer('api');
const app = createApp(container);

const server = app.listen(container.config.PORT, () => {
  container.logger.info(`API escuchando en http://localhost:${container.config.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  container.logger.info({ signal }, 'Cerrando API');
  server.close();
  await Promise.allSettled([container.rabbit.close(), disconnectPrisma(), closeOpensearch()]);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

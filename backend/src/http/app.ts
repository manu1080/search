import cors from 'cors';
import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import type { Container } from '../container.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { buildRoutes } from './routes/index.js';
import './types.js';

export function createApp(container: Container): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger: container.logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
  app.use(cors({ origin: container.config.CORS_ORIGIN.split(',').map((o) => o.trim()) }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', async (_req, res) => {
    const checks = await healthChecks(container);
    const healthy = Object.values(checks).every(Boolean);
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ok' : 'degraded', checks });
  });

  app.use('/api', buildRoutes(container));

  app.use(notFoundHandler);
  app.use(errorHandler(container.logger));

  return app;
}

async function healthChecks(container: Container): Promise<Record<string, boolean>> {
  const [db, search, queue] = await Promise.all([
    container.db
      .$queryRaw`SELECT 1`.then(() => true)
      .catch(() => false),
    container.searchClient
      .ping()
      .then(() => true)
      .catch(() => false),
    container.rabbit
      .channelReady()
      .then(() => true)
      .catch(() => false),
  ]);
  return { db, search, queue };
}

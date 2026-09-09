import { pino, type Logger } from 'pino';
import { env } from '../config/env.js';

export function createLogger(name: string): Logger {
  return pino({
    name,
    level: env().LOG_LEVEL,
    ...(env().NODE_ENV === 'development'
      ? { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
      : {}),
  });
}

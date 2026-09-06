import pino from 'pino';
import { loadSharedEnv } from './config.js';

const env = loadSharedEnv();

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { translateTime: 'SYS:standard' } } }
    : {}),
});

export type Logger = typeof logger;

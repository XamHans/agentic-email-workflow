// src/logger.ts
import pino from 'pino';

// Configure a "pretty" logger for development, and JSON for production
const logger = pino({
  level: 'info',
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty' }
      : undefined,
});

export default logger;

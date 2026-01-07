import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

// Log queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query' as never, (e: any) => {
    logger.debug({ query: e.query, params: e.params, duration: e.duration }, 'Prisma Query');
  });
}

prisma.$on('error' as never, (e: any) => {
  logger.error({ error: e }, 'Prisma Error');
});

prisma.$on('warn' as never, (e: any) => {
  logger.warn({ warning: e }, 'Prisma Warning');
});

export { prisma };
export default prisma;

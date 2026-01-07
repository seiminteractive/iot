import { FastifyPluginAsync } from 'fastify';
import fastifyCors from '@fastify/cors';
import { config } from '../../config/env.js';

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  // En desarrollo: permitir localhost, en producción: usar CORS_ORIGIN
  const origins = 
    config.NODE_ENV === 'development'
      ? [
          'http://localhost:8080',
          'http://localhost:5173',
          'http://127.0.0.1:8080',
          'http://127.0.0.1:5173',
          'http://192.168.1.75:8080',
        ]
      : config.CORS_ORIGIN === '*'
        ? true
        : config.CORS_ORIGIN;

  await fastify.register(fastifyCors, {
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });
};

export default corsPlugin;

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { verifyFirebaseToken } from '../../auth/firebase.js';
import { config } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  // Log ADMIN_EMAILS al iniciar para verificar que se cargó
  const adminEmails = config.ADMIN_EMAILS
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  logger.info({ adminEmails }, 'Auth plugin initialized with admin emails');

  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    const path = request.routerPath || request.raw.url || '';
    if (path === '/health' || path.startsWith('/ws')) return;
    if (path.startsWith('/tenants/') && path.endsWith('/dashboard')) return;

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    try {
      const decoded = await verifyFirebaseToken(token);

      const userEmail = decoded.email?.toLowerCase();
      const isInternal = !!userEmail && adminEmails.includes(userEmail);

      logger.debug(
        {
          userEmail,
          adminEmails,
          isInternal,
          path,
        },
        'Auth check'
      );

      // Si es admin interno, no necesita claims - solo accede al panel admin
      if (isInternal) {
        request.user = {
          uid: decoded.uid,
          email: decoded.email,
          tenantId: '__internal__',
          role: 'admin',
          plantAccess: [],
          isInternal: true,
        };
        return;
      }

      // Para usuarios normales, requerir claims de Firebase
      const tenantId = decoded.tenantId as string | undefined;
      const role = decoded.role as string | undefined;
      const plantAccess = (decoded.plantAccess as string[] | undefined) || [];

      if (!tenantId || !role) {
        logger.warn({ userEmail, tenantId, role }, 'User missing tenant or role');
        return reply.code(403).send({ error: 'Missing tenant or role. Contact admin.' });
      }

      request.user = {
        uid: decoded.uid,
        email: decoded.email,
        tenantId,
        role,
        plantAccess,
        isInternal: false,
      };
    } catch (error: any) {
      const errorCode = error?.code || error?.message || 'unknown';
      logger.error({ error: errorCode }, 'Token verification failed');
      
      if (errorCode === 'auth/id-token-expired') {
        return reply.code(401).send({ error: 'Token expired. Please login again.' });
      }
      return reply.code(401).send({ error: 'Invalid token' });
    }
  });
};

export default fp(authPlugin);

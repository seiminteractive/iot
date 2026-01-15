import { FastifyPluginAsync } from 'fastify';
import { verifyFirebaseToken } from '../../auth/firebase.js';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorateRequest('user', null);

  fastify.addHook('preHandler', async (request, reply) => {
    const path = request.routerPath || request.raw.url || '';
    if (path === '/health' || path.startsWith('/ws')) return;

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    try {
      const decoded = await verifyFirebaseToken(token);

      const tenantId = decoded.tenantId as string | undefined;
      const role = decoded.role as string | undefined;
      const plantAccess = (decoded.plantAccess as string[] | undefined) || [];

      if (!tenantId || !role) {
        return reply.code(403).send({ error: 'Missing tenant or role' });
      }

      request.user = {
        uid: decoded.uid,
        email: decoded.email,
        tenantId,
        role,
        plantAccess,
      };
    } catch (error) {
      return reply.code(401).send({ error: 'Invalid token' });
    }
  });
};

export default authPlugin;

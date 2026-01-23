import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { requireRole } from '../utils/authz.js';
import { getTenantContext } from '../utils/tenant.js';

const tenantsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/tenants/me', async (request, reply) => {
    if (!requireRole(request, 'viewer')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const tenant = await getTenantContext(request);
    if (!tenant) {
      return reply.code(403).send({ error: 'Invalid tenant' });
    }
    return reply.send({
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      iconUrl: tenant.iconUrl,
    });
  });
};

export default tenantsRoutes;

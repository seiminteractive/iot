import { FastifyRequest } from 'fastify';
import { prisma } from '../../db/prisma.js';

export async function getTenantContext(request: FastifyRequest) {
  const tenantId = request.user?.tenantId;
  if (!tenantId || tenantId === '__internal__') return null;
  return prisma.tenant.findUnique({
    where: { id: tenantId },
  });
}

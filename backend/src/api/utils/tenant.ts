import { FastifyRequest } from 'fastify';
import { prisma } from '../../db/prisma.js';

export async function getTenantContext(request: FastifyRequest) {
  const tenantSlug = request.user?.tenantId;
  if (!tenantSlug) return null;
  return prisma.tenant.findUnique({
    where: { slug: tenantSlug },
  });
}

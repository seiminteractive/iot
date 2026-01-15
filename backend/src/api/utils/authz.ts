import { FastifyRequest } from 'fastify';

const rolePriority: Record<string, number> = {
  viewer: 1,
  plant_operator: 2,
  manager: 3,
  admin: 4,
};

export function requireRole(request: FastifyRequest, minRole: keyof typeof rolePriority) {
  const user = request.user;
  if (!user) return false;
  const userRank = rolePriority[user.role] ?? 0;
  const requiredRank = rolePriority[minRole];
  return userRank >= requiredRank;
}

export function allowedPlants(request: FastifyRequest): string[] {
  const user = request.user;
  if (!user) return [];
  return user.plantAccess.length > 0 ? user.plantAccess : ['*'];
}

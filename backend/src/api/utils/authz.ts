import { FastifyRequest } from 'fastify';
import { config } from '../../config/env.js';

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

export function requireInternal(request: FastifyRequest): boolean {
  if (request.user?.isInternal) return true;
  const email = request.user?.email?.toLowerCase();
  if (!email) return false;
  const adminEmails = config.ADMIN_EMAILS
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(email);
}

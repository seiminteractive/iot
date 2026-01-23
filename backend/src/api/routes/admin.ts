import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';
import { requireInternal } from '../utils/authz.js';
import { getFirebaseAuth } from '../../auth/firebase.js';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/admin/access', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ allowed: false, adminOnly: false });
    }
    // adminOnly = true si el usuario SOLO tiene acceso admin (no tiene tenant real)
    const adminOnly = request.user?.tenantId === '__internal__';
    return reply.send({ allowed: true, adminOnly, email: request.user?.email });
  });

  // Tenants
  fastify.get('/admin/tenants', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return reply.send(tenants);
  });

  fastify.post('/admin/tenants', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const body = request.body as { slug?: string; name?: string; iconUrl?: string };
    if (!body?.slug || !body?.name) {
      return reply.code(400).send({ error: 'Missing slug or name' });
    }
    const tenant = await prisma.tenant.create({
      data: {
        slug: body.slug.trim(),
        name: body.name.trim(),
        iconUrl: body.iconUrl?.trim() || null,
      },
    });
    return reply.send(tenant);
  });

  fastify.put<{ Params: { tenantId: string } }>('/admin/tenants/:tenantId', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { tenantId } = request.params;
    const body = request.body as { name?: string; iconUrl?: string };
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Tenant not found' });
    }
    const trimmedIcon = body.iconUrl?.trim();
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: body.name?.trim() || existing.name,
        iconUrl: trimmedIcon === undefined ? (existing.iconUrl ?? null) : (trimmedIcon || null),
      },
    });
    return reply.send(tenant);
  });

  fastify.delete<{ Params: { tenantId: string } }>('/admin/tenants/:tenantId', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { tenantId } = request.params;
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Tenant not found' });
    }
    // Cascade delete handled by Prisma schema
    await prisma.tenant.delete({ where: { id: tenantId } });
    return reply.send({ success: true });
  });

  // Plants
  fastify.get('/admin/plants', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const query = request.query as { tenantId?: string };
    const plants = await prisma.plant.findMany({
      where: query?.tenantId ? { tenantId: query.tenantId } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { slug: true, name: true } },
      },
    });
    return reply.send(plants);
  });

  fastify.post('/admin/plants', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const body = request.body as {
      tenantId?: string;
      province?: string;
      plantId?: string;
      name?: string;
    };
    if (!body?.tenantId || !body?.province || !body?.plantId) {
      return reply.code(400).send({ error: 'Missing tenantId, province or plantId' });
    }

    // Verificar si ya existe una planta con el mismo plantId en la misma provincia
    const existing = await prisma.plant.findFirst({
      where: {
        tenantId: body.tenantId,
        province: body.province.trim(),
        plantId: body.plantId.trim(),
      },
    });
    if (existing) {
      return reply.code(409).send({
        error: `Ya existe una planta con ID "${body.plantId}" en la provincia "${body.province}"`,
      });
    }

    const plant = await prisma.plant.create({
      data: {
        tenantId: body.tenantId,
        province: body.province.trim(),
        plantId: body.plantId.trim(),
        name: body.name?.trim() || null,
      },
    });
    return reply.send(plant);
  });

  fastify.put<{ Params: { plantId: string } }>('/admin/plants/:plantId', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { plantId } = request.params;
    const body = request.body as {
      province?: string;
      plantId?: string;
      name?: string;
    };
    const existing = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Plant not found' });
    }

    // Si se está cambiando province o plantId, verificar que no exista duplicado
    const newProvince = body.province?.trim() || existing.province;
    const newPlantId = body.plantId?.trim() || existing.plantId;
    if (newProvince !== existing.province || newPlantId !== existing.plantId) {
      const duplicate = await prisma.plant.findFirst({
        where: {
          tenantId: existing.tenantId,
          province: newProvince,
          plantId: newPlantId,
          id: { not: plantId },
        },
      });
      if (duplicate) {
        return reply.code(409).send({
          error: `Ya existe una planta con ID "${newPlantId}" en la provincia "${newProvince}"`,
        });
      }
    }

    const plant = await prisma.plant.update({
      where: { id: plantId },
      data: {
        province: newProvince,
        plantId: newPlantId,
        name: body.name?.trim() ?? existing.name ?? null,
      },
    });
    return reply.send(plant);
  });

  fastify.delete<{ Params: { plantId: string } }>('/admin/plants/:plantId', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { plantId } = request.params;
    const existing = await prisma.plant.findUnique({ where: { id: plantId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Plant not found' });
    }
    // Cascade delete handled by Prisma schema
    await prisma.plant.delete({ where: { id: plantId } });
    return reply.send({ success: true });
  });

  // Get all PLCs with optional filters
  fastify.get('/admin/plcs', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const query = request.query as { tenantId?: string; plantId?: string };
    
    const where: { tenantId?: string; plantId?: string } = {};
    if (query.tenantId) where.tenantId = query.tenantId;
    if (query.plantId) where.plantId = query.plantId;

    const plcs = await prisma.plc.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        dashboards: { select: { id: true } },
        tenant: { select: { slug: true, name: true } },
        plant: { select: { plantId: true, name: true, province: true } },
        state: { select: { lastTs: true } },
      },
    });

    // Consider PLC online if last telemetry was within 15 seconds
    const ONLINE_THRESHOLD_MS = 15 * 1000;
    const now = Date.now();

    const result = plcs.map((plc) => {
      const lastTs = plc.state?.lastTs ? new Date(plc.state.lastTs).getTime() : 0;
      const isOnline = now - lastTs < ONLINE_THRESHOLD_MS;

      return {
        id: plc.id,
        plcThingName: plc.plcThingName,
        name: plc.name,
        gatewayId: plc.gatewayId,
        tenantId: plc.tenantId,
        plantId: plc.plantId,
        hasDashboard: plc.dashboards.length > 0,
        dashboardId: plc.dashboards[0]?.id || null,
        tenant: plc.tenant,
        plant: plc.plant,
        isOnline,
        lastSeenAt: plc.state?.lastTs || null,
      };
    });

    return reply.send(result);
  });

  // PLCs with dashboard status and online state (legacy endpoint with path params)
  fastify.get<{
    Params: { tenantId: string; plantId: string };
  }>('/admin/tenants/:tenantId/plants/:plantId/plcs', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { tenantId, plantId } = request.params;
    const plant = await prisma.plant.findFirst({
      where: { id: plantId, tenantId },
      select: { id: true },
    });
    if (!plant) {
      return reply.code(404).send({ error: 'Plant not found' });
    }
    const plcs = await prisma.plc.findMany({
      where: { tenantId, plantId },
      orderBy: { createdAt: 'desc' },
      include: {
        dashboards: { select: { id: true } },
        tenant: { select: { slug: true, name: true } },
        plant: { select: { plantId: true, name: true } },
        state: { select: { lastTs: true } },
      },
    });

    // Consider PLC online if last telemetry was within 15 seconds
    const ONLINE_THRESHOLD_MS = 15 * 1000;
    const now = Date.now();

    const result = plcs.map((plc) => {
      const lastTs = plc.state?.lastTs ? new Date(plc.state.lastTs).getTime() : 0;
      const isOnline = now - lastTs < ONLINE_THRESHOLD_MS;

      return {
        id: plc.id,
        plcThingName: plc.plcThingName,
        name: plc.name,
        gatewayId: plc.gatewayId,
        hasDashboard: plc.dashboards.length > 0,
        dashboardId: plc.dashboards[0]?.id || null,
        tenant: plc.tenant,
        plant: plc.plant,
        isOnline,
        lastSeenAt: plc.state?.lastTs || null,
      };
    });

    return reply.send(result);
  });

  fastify.get<{ Params: { plcId: string } }>('/admin/plcs/:plcId/state', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { plcId } = request.params;
    const plc = await prisma.plc.findUnique({
      where: { id: plcId },
      select: { id: true },
    });
    if (!plc) {
      return reply.code(404).send({ error: 'PLC not found' });
    }
    const state = await prisma.plcState.findUnique({
      where: { plcId: plc.id },
    });
    return reply.send(state);
  });

  fastify.delete<{ Params: { plcId: string } }>('/admin/plcs/:plcId', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { plcId } = request.params;
    const existing = await prisma.plc.findUnique({ where: { id: plcId } });
    if (!existing) {
      return reply.code(404).send({ error: 'PLC not found' });
    }
    // Cascade delete handled by Prisma schema
    await prisma.plc.delete({ where: { id: plcId } });
    return reply.send({ success: true });
  });

  // Users (Firebase)
  fastify.get('/admin/users', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const auth = getFirebaseAuth();
    const result = await auth.listUsers(1000);
    const users = result.users.map((user) => ({
      uid: user.uid,
      email: user.email,
      disabled: user.disabled,
      tenantId: (user.customClaims?.tenantId as string | undefined) || null,
      role: (user.customClaims?.role as string | undefined) || null,
      plantAccess: (user.customClaims?.plantAccess as string[] | undefined) || [],
    }));
    return reply.send(users);
  });

  fastify.post('/admin/users', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const body = request.body as {
      email?: string;
      password?: string;
      tenantId?: string;
      role?: string;
      plantAccess?: string[];
    };
    if (!body?.email || !body?.password || !body?.tenantId || !body?.role) {
      return reply.code(400).send({ error: 'Missing email, password, tenantId or role' });
    }
    const auth = getFirebaseAuth();
    const tenant = await prisma.tenant.findUnique({ where: { slug: body.tenantId } });
    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant not found' });
    }
    const userRecord = await auth.createUser({
      email: body.email.trim(),
      password: body.password,
    });
    await auth.setCustomUserClaims(userRecord.uid, {
      tenantId: body.tenantId,
      role: body.role,
      plantAccess: body.plantAccess || [],
    });
    return reply.send({ uid: userRecord.uid, email: userRecord.email });
  });

  fastify.put<{ Params: { uid: string } }>('/admin/users/:uid/claims', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { uid } = request.params;
    const body = request.body as {
      tenantId?: string;
      role?: string;
      plantAccess?: string[];
      disabled?: boolean;
    };
    const auth = getFirebaseAuth();
    if (typeof body.disabled === 'boolean') {
      await auth.updateUser(uid, { disabled: body.disabled });
    }
    const userRecord = await auth.getUser(uid);
    const claims: Record<string, any> = {
      ...(userRecord.customClaims || {}),
    };
    if (body.tenantId) claims.tenantId = body.tenantId;
    if (body.role) claims.role = body.role;
    if (body.plantAccess) claims.plantAccess = body.plantAccess;
    if (Object.keys(claims).length > 0) {
      await auth.setCustomUserClaims(uid, claims);
    }
    return reply.send({ success: true });
  });

  fastify.delete<{ Params: { uid: string } }>('/admin/users/:uid', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { uid } = request.params;
    const auth = getFirebaseAuth();
    try {
      await auth.deleteUser(uid);
      return reply.send({ success: true });
    } catch (error) {
      return reply.code(404).send({ error: 'User not found or could not be deleted' });
    }
  });

  // Dashboards
  fastify.get<{ Params: { plcId: string } }>('/admin/plcs/:plcId/dashboard', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { plcId } = request.params;
    const plc = await prisma.plc.findUnique({
      where: { id: plcId },
      select: { id: true, tenantId: true, plantId: true },
    });
    if (!plc) {
      return reply.code(404).send({ error: 'PLC not found' });
    }
    const dashboard = await prisma.plcDashboard.findFirst({
      where: { tenantId: plc.tenantId, plantId: plc.plantId, plcId: plc.id },
      include: {
        widgets: { orderBy: { sortOrder: 'asc' } },
        plc: { select: { plcThingName: true, name: true } },
        plant: { select: { plantId: true, name: true } },
        tenant: { select: { slug: true, name: true, iconUrl: true } },
      },
    });

    if (!dashboard) {
      return reply.code(404).send({ error: 'Dashboard not found' });
    }

    return reply.send(dashboard);
  });

  fastify.post<{ Params: { plcId: string } }>('/admin/plcs/:plcId/dashboard', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { plcId } = request.params;
    const body = request.body as { name?: string; iconUrl?: string };
    if (!body?.name) {
      return reply.code(400).send({ error: 'Missing name' });
    }
    const plc = await prisma.plc.findUnique({ where: { id: plcId } });
    if (!plc) {
      return reply.code(404).send({ error: 'PLC not found' });
    }
    const existing = await prisma.plcDashboard.findFirst({
      where: { tenantId: plc.tenantId, plantId: plc.plantId, plcId: plc.id },
    });
    if (existing) {
      return reply.code(409).send({ error: 'Dashboard already exists for PLC' });
    }
    const trimmedIcon = body.iconUrl?.trim();
    const dashboard = await prisma.plcDashboard.create({
      data: {
        tenantId: plc.tenantId,
        plantId: plc.plantId,
        plcId: plc.id,
        name: body.name.trim(),
        iconUrl: trimmedIcon || null,
      },
    });
    return reply.send(dashboard);
  });

  fastify.put<{ Params: { dashboardId: string } }>('/admin/dashboards/:dashboardId', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { dashboardId } = request.params;
    const body = request.body as { name?: string; iconUrl?: string; layoutVersion?: number };
    const existing = await prisma.plcDashboard.findUnique({ where: { id: dashboardId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Dashboard not found' });
    }
    const trimmedIcon = body.iconUrl?.trim();
    const dashboard = await prisma.plcDashboard.update({
      where: { id: dashboardId },
      data: {
        name: body.name?.trim() || existing.name,
        iconUrl: trimmedIcon === undefined ? (existing.iconUrl ?? null) : (trimmedIcon || null),
        layoutVersion: typeof body.layoutVersion === 'number' ? body.layoutVersion : existing.layoutVersion,
      },
    });
    return reply.send(dashboard);
  });

  fastify.delete<{ Params: { dashboardId: string } }>('/admin/dashboards/:dashboardId', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { dashboardId } = request.params;
    const existing = await prisma.plcDashboard.findUnique({ where: { id: dashboardId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Dashboard not found' });
    }
    await prisma.plcDashboard.delete({ where: { id: dashboardId } });
    return reply.send({ success: true });
  });

  fastify.post<{ Params: { dashboardId: string } }>('/admin/dashboards/:dashboardId/widgets', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { dashboardId } = request.params;
    const body = request.body as {
      widgetKey?: string;
      type?: string;
      label?: string;
      metricId?: string;
      unit?: string | null;
      dataType?: string | null;
      configJson?: Record<string, any>;
      layoutJson?: Record<string, any>;
      sortOrder?: number;
      isVisible?: boolean;
    };
    if (!body?.type || !body?.label || !body?.metricId) {
      return reply.code(400).send({ error: 'Missing widget fields' });
    }
    // Auto-generate widgetKey if not provided
    const widgetKey = body.widgetKey?.trim() || `${body.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const widget = await prisma.plcDashboardWidget.create({
      data: {
        plcDashboardId: dashboardId,
        widgetKey,
        type: body.type.trim(),
        label: body.label.trim(),
        metricId: body.metricId.trim(),
        unit: body.unit?.trim() || null,
        dataType: body.dataType?.trim() || null,
        configJson: body.configJson || {},
        layoutJson: body.layoutJson || {},
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : 0,
        isVisible: typeof body.isVisible === 'boolean' ? body.isVisible : true,
      },
    });
    return reply.send(widget);
  });

  fastify.put<{ Params: { widgetId: string } }>('/admin/widgets/:widgetId', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { widgetId } = request.params;
    const body = request.body as {
      widgetKey?: string;
      type?: string;
      label?: string;
      metricId?: string;
      unit?: string | null;
      dataType?: string | null;
      configJson?: Record<string, any>;
      layoutJson?: Record<string, any>;
      sortOrder?: number;
      isVisible?: boolean;
    };
    const existing = await prisma.plcDashboardWidget.findUnique({ where: { id: widgetId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Widget not found' });
    }
    const widget = await prisma.plcDashboardWidget.update({
      where: { id: widgetId },
      data: {
        widgetKey: body.widgetKey?.trim() || existing.widgetKey,
        type: body.type?.trim() || existing.type,
        label: body.label?.trim() || existing.label,
        metricId: body.metricId?.trim() || existing.metricId,
        unit: body.unit?.trim() ?? existing.unit ?? null,
        dataType: body.dataType?.trim() ?? existing.dataType ?? null,
        configJson: body.configJson ?? (existing.configJson as object) ?? {},
        layoutJson: body.layoutJson ?? (existing.layoutJson as object) ?? {},
        sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : existing.sortOrder,
        isVisible: typeof body.isVisible === 'boolean' ? body.isVisible : existing.isVisible,
      },
    });
    return reply.send(widget);
  });

  fastify.delete<{ Params: { widgetId: string } }>('/admin/widgets/:widgetId', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { widgetId } = request.params;
    const existing = await prisma.plcDashboardWidget.findUnique({ where: { id: widgetId } });
    if (!existing) {
      return reply.code(404).send({ error: 'Widget not found' });
    }
    await prisma.plcDashboardWidget.delete({ where: { id: widgetId } });
    return reply.send({ success: true });
  });

  fastify.post<{ Params: { dashboardId: string } }>('/admin/dashboards/:dashboardId/widgets/reorder', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { dashboardId } = request.params;
    const body = request.body as { items?: { id: string; sortOrder: number }[] };
    if (!body?.items || !Array.isArray(body.items)) {
      return reply.code(400).send({ error: 'Missing items' });
    }
    await prisma.$transaction(
      body.items.map((item) =>
        prisma.plcDashboardWidget.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        })
      )
    );
    return reply.send({ success: true });
  });

  fastify.post<{
    Params: { targetPlcId: string; sourcePlcId: string };
  }>('/admin/plcs/:targetPlcId/dashboard/clone-from/:sourcePlcId', async (request, reply) => {
    if (!requireInternal(request)) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
    const { targetPlcId, sourcePlcId } = request.params;
    const targetPlc = await prisma.plc.findUnique({ where: { id: targetPlcId } });
    const sourcePlc = await prisma.plc.findUnique({ where: { id: sourcePlcId } });
    if (!targetPlc || !sourcePlc) {
      return reply.code(404).send({ error: 'PLC not found' });
    }
    if (targetPlc.tenantId !== sourcePlc.tenantId) {
      return reply.code(403).send({ error: 'Cross-tenant clone not allowed' });
    }
    const existing = await prisma.plcDashboard.findFirst({
      where: { tenantId: targetPlc.tenantId, plantId: targetPlc.plantId, plcId: targetPlc.id },
    });
    if (existing) {
      return reply.code(409).send({ error: 'Dashboard already exists for target PLC' });
    }
    const sourceDashboard = await prisma.plcDashboard.findFirst({
      where: { tenantId: sourcePlc.tenantId, plantId: sourcePlc.plantId, plcId: sourcePlc.id },
      include: { widgets: true },
    });
    if (!sourceDashboard) {
      return reply.code(404).send({ error: 'Source dashboard not found' });
    }
    const newDashboard = await prisma.plcDashboard.create({
      data: {
        tenantId: targetPlc.tenantId,
        plantId: targetPlc.plantId,
        plcId: targetPlc.id,
        name: sourceDashboard.name,
        iconUrl: sourceDashboard.iconUrl,
        layoutVersion: sourceDashboard.layoutVersion,
        widgets: {
          create: sourceDashboard.widgets.map((widget) => ({
            widgetKey: widget.widgetKey,
            type: widget.type,
            label: widget.label,
            metricId: widget.metricId,
            unit: widget.unit,
            dataType: widget.dataType,
            configJson: (widget.configJson as object) ?? {},
            layoutJson: (widget.layoutJson as object) ?? {},
            sortOrder: widget.sortOrder,
            isVisible: widget.isVisible,
          })),
        },
      },
    });
    return reply.send(newDashboard);
  });
};

export default adminRoutes;

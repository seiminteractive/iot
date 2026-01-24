import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../db/prisma.js';

const publicDashboardsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{
    Params: { tenantSlug: string; plantId: string; plcThingName: string };
  }>('/tenants/:tenantSlug/plants/:plantId/plcs/:plcThingName/dashboard', async (request, reply) => {
    const { tenantSlug, plantId, plcThingName } = request.params;

    const tenant = await prisma.tenant.findUnique({
      where: { slug: tenantSlug },
      select: { id: true, slug: true, name: true, iconUrl: true },
    });
    if (!tenant) {
      return reply.code(404).send({ error: 'Tenant not found' });
    }

    const plant = await prisma.plant.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [
          { id: plantId }, // Buscar por UUID
          { plantId }, // Buscar por plantId técnico (backward compatibility)
        ],
      },
      select: { id: true, plantId: true, name: true },
    });
    if (!plant) {
      return reply.code(404).send({ error: 'Plant not found' });
    }

    const plc = await prisma.plc.findFirst({
      where: { tenantId: tenant.id, plantId: plant.id, plcThingName },
      select: { id: true, plcThingName: true, name: true },
    });
    if (!plc) {
      return reply.code(404).send({ error: 'PLC not found' });
    }

    const dashboard = await prisma.plcDashboard.findFirst({
      where: { tenantId: tenant.id, plantId: plant.id, plcId: plc.id },
      select: {
        id: true,
        name: true,
        iconUrl: true,
        layoutVersion: true,
        widgets: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            widgetKey: true,
            type: true,
            label: true,
            metricId: true,
            unit: true,
            dataType: true,
            configJson: true,
            layoutJson: true,
            sortOrder: true,
            isVisible: true,
          },
        },
      },
    });

    // El PLC existe pero no tiene dashboard configurado - esto no es un error
    if (!dashboard) {
      return reply.send({
        tenant: { slug: tenant.slug, name: tenant.name, icon_url: tenant.iconUrl },
        plant: { plant_id: plant.plantId, name: plant.name },
        plc: { plc_thing_name: plc.plcThingName, name: plc.name },
        dashboard: null,
        widgets: [],
      });
    }

    return reply.send({
      tenant: { slug: tenant.slug, name: tenant.name, icon_url: tenant.iconUrl },
      plant: { plant_id: plant.plantId, name: plant.name },
      plc: { plc_thing_name: plc.plcThingName, name: plc.name },
      dashboard: {
        id: dashboard.id,
        name: dashboard.name,
        icon_url: dashboard.iconUrl,
        layout_version: dashboard.layoutVersion,
      },
      widgets: dashboard.widgets.map((widget) => ({
        id: widget.id,
        widget_key: widget.widgetKey,
        type: widget.type,
        label: widget.label,
        metric_id: widget.metricId,
        unit: widget.unit,
        data_type: widget.dataType,
        config_json: widget.configJson,
        layout_json: widget.layoutJson,
        sort_order: widget.sortOrder,
        is_visible: widget.isVisible,
      })),
    });
  });
};

export default publicDashboardsRoutes;

import { ParsedTopic } from '../types/index.js';

/**
 * Parse MQTT topics to extract tenant/province/plant/machine/gateway and type
 * Telemetry: factory/{tenant}/{province}/{plant}/{machine}/telemetry
 * Gateway status: ops/{tenant}/{province}/{plant}/gateway/{thingName}/status
 */
export function parseTopic(topic: string): ParsedTopic {
  const parts = topic.split('/');

  // Telemetry: factory/{tenant}/{province}/{plant}/{machine}/telemetry
  if (parts.length >= 6 && parts[0] === 'factory') {
    const [, tenant, province, plant, machineId, typeStr] = parts;
    const type = typeStr === 'telemetry' ? 'telemetry' : 'unknown';
    return { tenant, province, plant, machineId, type, raw: topic };
  }

  // Gateway status: ops/{tenant}/{province}/{plant}/gateway/{thingName}/status
  if (parts.length >= 7 && parts[0] === 'ops' && parts[4] === 'gateway') {
    const [, tenant, province, plant, , thingName, typeStr] = parts;
    const type = typeStr === 'status' ? 'gateway_status' : 'unknown';
    return { tenant, province, plant, thingName, type, raw: topic };
  }

  return { type: 'unknown', raw: topic };
}

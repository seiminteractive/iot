import { ParsedTopic } from '../types/index.js';

/**
 * Parse MQTT topics to extract tenant/province/plant/gateway/plcThingName and type
 * Telemetry: factory/{tenant}/{province}/{plant}/{gatewayId}/{plcThingName}/telemetry
 */
export function parseTopic(topic: string): ParsedTopic {
  const parts = topic.split('/');

  // Telemetry: factory/{tenant}/{province}/{plant}/{gatewayId}/{plcThingName}/telemetry
  if (parts.length >= 7 && parts[0] === 'factory') {
    const [, tenant, province, plant, gatewayId, plcThingName, typeStr] = parts;
    const type = typeStr === 'telemetry' ? 'telemetry' : 'unknown';
    if (type !== 'telemetry') {
      return { type: 'unknown', raw: topic };
    }
    return { tenant, province, plant, gatewayId, plcThingName, type, raw: topic };
  }

  return { type: 'unknown', raw: topic };
}

import { ParsedTopic } from '../types/index.js';

/**
 * Parse MQTT topic to extract site, machineId, and type
 * Expected format: factory/{site}/{machineId}/telemetry or factory/{site}/{machineId}/status
 */
export function parseTopic(topic: string): ParsedTopic {
  const parts = topic.split('/');
  
  // Standard convention: factory/{site}/{machineId}/telemetry|status
  if (parts.length >= 4 && parts[0] === 'factory') {
    const [, site, machineId, typeStr] = parts;

    let type: 'telemetry' | 'status' | 'unknown' = 'unknown';
    if (typeStr === 'telemetry') type = 'telemetry';
    else if (typeStr === 'status') type = 'status';

    return { site, machineId, type, raw: topic };
  }

  // Fallback: topics not following the factory convention (e.g. KepServer test topic)
  // - "test1"                      -> site=default, machineId=test1, type=telemetry
  // - "home/plc-01/telemetry"      -> site=home, machineId=plc-01, type=telemetry
  // - "home/plc-01/status"         -> site=home, machineId=plc-01, type=status
  const site = parts.length >= 2 ? parts[0] : 'default';
  const machineId = parts.length >= 2 ? parts[1] : parts[0] ?? 'unknown';
  const tail = parts.length >= 3 ? parts[2] : undefined;

  let type: 'telemetry' | 'status' | 'unknown' = 'telemetry';
  if (tail === 'status') type = 'status';
  else if (tail === 'telemetry') type = 'telemetry';

  return { site, machineId, type, raw: topic };
}

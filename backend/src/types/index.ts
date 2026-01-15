export interface ParsedTopic {
  tenant?: string;
  province?: string;
  plant?: string;
  machineId?: string;
  thingName?: string;
  type: 'telemetry' | 'gateway_status' | 'unknown';
  raw: string;
}

export interface NormalizedMessage {
  schema: number;
  tenant: string;
  province: string;
  plant: string;
  machineId: string;
  ts: number;
  seq?: number;
  values: Record<string, any>;
  topic: string;
  raw: Record<string, any>;
}

export interface GatewayStatusMessage {
  tenant: string;
  province: string;
  plant: string;
  thingName: string;
  ts: number;
  state: 'online' | 'offline';
  version?: string;
  uptimeSec?: number;
  raw: Record<string, any>;
}

export interface WSMessage {
  type: 'telemetry' | 'gateway_status' | 'alarm' | 'ping';
  tenant: string;
  plant: string;
  machineId?: string;
  thingName?: string;
  ts: number;
  values?: Record<string, any>;
  message?: string;
  severity?: string;
  origin?: string;
}

export interface MetricsData {
  mqttMessagesReceived: number;
  mqttMessagesProcessed: number;
  mqttMessagesFailed: number;
  wsConnections: number;
  uptime: number;
  lastMessage: number | null;
}

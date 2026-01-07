export interface ParsedTopic {
  site: string;
  machineId: string;
  type: 'telemetry' | 'status' | 'unknown';
  raw: string;
}

export interface NormalizedMessage {
  schema: number;
  machineId: string;
  site: string;
  ts: number;
  values: Record<string, any>;
  topic: string;
  raw: Record<string, any>;
}

export interface WSMessage {
  type: 'telemetry' | 'status' | 'alarm' | 'ping';
  site: string;
  machineId: string;
  ts: number;
  values?: Record<string, any>;
  message?: string;
  severity?: string;
}

export interface MetricsData {
  mqttMessagesReceived: number;
  mqttMessagesProcessed: number;
  mqttMessagesFailed: number;
  wsConnections: number;
  uptime: number;
  lastMessage: number | null;
}

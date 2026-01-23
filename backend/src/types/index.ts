export interface ParsedTopic {
  tenant?: string;
  province?: string;
  plant?: string;
  gatewayId?: string;
  plcThingName?: string;
  type: 'telemetry' | 'unknown';
  raw: string;
}

export interface MetricValue {
  id: string;
  v: any;
  q?: boolean;
  t: number;
}

export interface NormalizedTelemetryMessage {
  tenant: string;
  province: string;
  plant: string;
  gatewayId: string;
  plcThingName: string;
  metricId: string;
  timestamp: number;
  value: number | string | boolean | null;
  quality?: boolean | number | string | null;
  values: Record<string, any>;
  topic: string;
  raw: Record<string, any>;
  metrics?: MetricValue[];
}

export interface WSMessage {
  type: 'telemetry' | 'alarm' | 'ping' | 'plc_state_changed';
  tenant?: string;
  plant?: string;
  plcThingName?: string;
  plcId?: string;
  tenantId?: string;
  plantId?: string;
  gatewayId?: string;
  ts?: number;
  values?: Record<string, any>;
  message?: string;
  severity?: string;
  origin?: string;
  isOnline?: boolean;
  lastSeenAt?: string;
}

export interface MetricsData {
  mqttMessagesReceived: number;
  mqttMessagesProcessed: number;
  mqttMessagesFailed: number;
  wsConnections: number;
  uptime: number;
  lastMessage: number | null;
}

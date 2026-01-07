import { MetricsData } from '../types/index.js';

class MetricsCollector {
  private mqttMessagesReceived = 0;
  private mqttMessagesProcessed = 0;
  private mqttMessagesFailed = 0;
  private wsConnections = 0;
  private startTime = Date.now();
  private lastMessage: number | null = null;

  incrementReceived(): void {
    this.mqttMessagesReceived++;
  }

  incrementProcessed(): void {
    this.mqttMessagesProcessed++;
  }

  incrementFailed(): void {
    this.mqttMessagesFailed++;
  }

  setWsConnections(count: number): void {
    this.wsConnections = count;
  }

  updateLastMessage(): void {
    this.lastMessage = Date.now();
  }

  getMetrics(): MetricsData {
    return {
      mqttMessagesReceived: this.mqttMessagesReceived,
      mqttMessagesProcessed: this.mqttMessagesProcessed,
      mqttMessagesFailed: this.mqttMessagesFailed,
      wsConnections: this.wsConnections,
      uptime: Date.now() - this.startTime,
      lastMessage: this.lastMessage,
    };
  }

  reset(): void {
    this.mqttMessagesReceived = 0;
    this.mqttMessagesProcessed = 0;
    this.mqttMessagesFailed = 0;
    this.lastMessage = null;
  }
}

export const metricsCollector = new MetricsCollector();

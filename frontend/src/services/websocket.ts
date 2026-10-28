import { getApiBase } from './origin';

export type MessageHandler = (data: any) => void;

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export class MarketWebSocketClient {
  private url: string = '';
  private ws: WebSocket | null = null;
  private source: EventSource | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 25;
  private reconnectInterval = 1500;
  private pingIntervalId: any = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private subscribedChannels: Set<string> = new Set();
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set();
  private currentStatus: ConnectionStatus = 'DISCONNECTED';

  constructor() {
    // URL dinámica
  }

  public getStatus(): ConnectionStatus {
    if (this.source) {
      if (this.source.readyState === EventSource.OPEN) return 'CONNECTED';
      if (this.source.readyState === EventSource.CONNECTING) return 'CONNECTING';
    }
    return this.currentStatus === 'CONNECTING' ? 'CONNECTING' : 'DISCONNECTED';
  }

  private notifyStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    this.statusListeners.forEach((fn) => {
      try {
        fn(status);
      } catch (e) {
        console.error('[WebSocket] Error en status listener:', e);
      }
    });
  }

  public addStatusListener(fn: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(fn);
    // Notificar inmediatamente el estado actual
    fn(this.getStatus());
    return () => {
      this.statusListeners.delete(fn);
    };
  }

  // Compatibilidad con asignación onStatusChange
  public set onStatusChange(fn: ((status: ConnectionStatus) => void) | undefined) {
    if (fn) {
      this.addStatusListener(fn);
    }
  }

  private dispatch(payload: any): void {
    const type = payload.type || payload.action || (payload.channel ? String(payload.channel).split(':')[0] : 'general');
    this.listeners.get(type)?.forEach((fn) => fn(payload));
    this.listeners.get('*')?.forEach((fn) => fn(payload));
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.source && this.source.readyState !== EventSource.CLOSED) {
      this.notifyStatus(this.source.readyState === EventSource.OPEN ? 'CONNECTED' : 'CONNECTING');
      return;
    }

    this.url = `${getApiBase()}/api/v1/stream/live`;
    this.notifyStatus('CONNECTING');

    try {
      this.source = new EventSource(this.url);
      this.source.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyStatus('CONNECTED');
      };
      this.source.onmessage = (event) => {
        try {
          this.dispatch(JSON.parse(event.data));
        } catch (e) {
          console.error('[Canal] Payload ilegible:', e);
        }
      };
      this.source.onerror = () => {
        this.notifyStatus('DISCONNECTED');
        this.source?.close();
        this.source = null;
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[Canal] No se pudo abrir:', err);
      this.notifyStatus('ERROR');
      this.scheduleReconnect();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalId = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'ping', timestamp: Date.now() }));
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const timeout = Math.min(this.reconnectInterval * Math.pow(1.3, this.reconnectAttempts - 1), 10000);
      setTimeout(() => this.connect(), timeout);
    }
  }

  public subscribe(channels: string | string[]): void {
    const list = Array.isArray(channels) ? channels : [channels];
    list.forEach((ch) => this.subscribedChannels.add(ch));

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        action: 'subscribe',
        channels: list,
      });
    }
  }

  public unsubscribe(channels: string | string[]): void {
    const list = Array.isArray(channels) ? channels : [channels];
    list.forEach((ch) => this.subscribedChannels.delete(ch));

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send({
        action: 'unsubscribe',
        channels: list,
      });
    }
  }

  public send(payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  public on(type: string, handler: MessageHandler): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);

    return () => {
      this.listeners.get(type)?.delete(handler);
    };
  }

  public disconnect(): void {
    this.stopHeartbeat();
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.notifyStatus('DISCONNECTED');
  }
}

export const wsClient = new MarketWebSocketClient();

export type MessageHandler = (data: any) => void;

export type ConnectionStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';

export class MarketWebSocketClient {
  private url: string = '';
  private ws: WebSocket | null = null;
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
    if (!this.ws) return 'DISCONNECTED';
    if (this.ws.readyState === WebSocket.OPEN) return 'CONNECTED';
    if (this.ws.readyState === WebSocket.CONNECTING) return 'CONNECTING';
    return 'DISCONNECTED';
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

  private resolveUrl(): string {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || '127.0.0.1';
      return `ws://${host}:8000/ws/live`;
    }
    return 'ws://127.0.0.1:8000/ws/live';
  }

  public connect(): void {
    if (typeof window === 'undefined') return;

    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.notifyStatus('CONNECTED');
        return;
      }
      if (this.ws.readyState === WebSocket.CONNECTING) {
        this.notifyStatus('CONNECTING');
        return;
      }
    }

    this.url = this.resolveUrl();
    this.notifyStatus('CONNECTING');
    console.log('[WebSocket] Conectando a Gateway:', this.url);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.notifyStatus('CONNECTED');
        console.log('[WebSocket] Conexión abierta con éxito en:', this.url);

        // Suscribir a los canales guardados
        if (this.subscribedChannels.size > 0) {
          this.send({
            action: 'subscribe',
            channels: Array.from(this.subscribedChannels),
          });
        }

        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const type = payload.type || payload.action || (payload.channel ? payload.channel.split(':')[0] : 'general');

          const typeListeners = this.listeners.get(type);
          if (typeListeners) {
            typeListeners.forEach((fn) => fn(payload));
          }

          const allListeners = this.listeners.get('*');
          if (allListeners) {
            allListeners.forEach((fn) => fn(payload));
          }
        } catch (e) {
          console.error('[WebSocket] Error al deserializar payload JSON:', e);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[WebSocket] Error de socket:', err);
        this.notifyStatus('ERROR');
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.notifyStatus('DISCONNECTED');
        console.warn('[WebSocket] Conexión cerrada. Intentando reconectar...');
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[WebSocket] Error al crear WebSocket:', err);
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
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this.notifyStatus('DISCONNECTED');
  }
}

export const wsClient = new MarketWebSocketClient();

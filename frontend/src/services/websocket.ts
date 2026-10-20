export type MessageHandler = (data: any) => void;

export class MarketWebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 20;
  private reconnectInterval = 2000;
  private pingIntervalId: any = null;
  private listeners: Map<string, Set<MessageHandler>> = new Map();
  private subscribedChannels: Set<string> = new Set();
  private isConnecting = false;
  public onStatusChange?: (status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR') => void;

  constructor(url?: string) {
    if (typeof window !== 'undefined') {
      const defaultHost = window.location.hostname || 'localhost';
      this.url = url || `ws://${defaultHost}:8000/ws/live`;
    } else {
      this.url = url || 'ws://localhost:8000/ws/live';
    }
  }

  public connect(): void {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isConnecting = true;
    this.onStatusChange?.('CONNECTING');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.onStatusChange?.('CONNECTED');
        console.log('[WebSocket] Conexión abierta con Gateway:', this.url);

        // Re-suscribir a todos los canales pendientes
        if (this.subscribedChannels.size > 0) {
          this.send({
            action: 'subscribe',
            channels: Array.from(this.subscribedChannels),
          });
        }

        // Heartbeat cada 30 segundos
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const type = payload.type || payload.action || 'general';

          // Emitir a los listeners del tipo específico
          const typeListeners = this.listeners.get(type);
          if (typeListeners) {
            typeListeners.forEach((fn) => fn(payload));
          }

          // Emitir a los listeners globales
          const allListeners = this.listeners.get('*');
          if (allListeners) {
            allListeners.forEach((fn) => fn(payload));
          }
        } catch (e) {
          console.error('[WebSocket] Error al deserializar payload JSON:', e);
        }
      };

      this.ws.onerror = (error) => {
        console.warn('[WebSocket] Error de socket:', error);
        this.onStatusChange?.('ERROR');
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.stopHeartbeat();
        this.onStatusChange?.('DISCONNECTED');
        console.warn('[WebSocket] Conexión cerrada. Intentando reconexión...');
        this.scheduleReconnect();
      };
    } catch (err) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingIntervalId = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'ping', timestamp: Date.now() }));
      }
    }, 30000);
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
      const timeout = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1), 15000);
      console.log(`[WebSocket] Reconexión intento ${this.reconnectAttempts} en ${timeout}ms`);
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

    // Retorna función para desuscribir
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
    this.onStatusChange?.('DISCONNECTED');
  }
}

export const wsClient = new MarketWebSocketClient();

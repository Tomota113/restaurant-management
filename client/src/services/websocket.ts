import { useEffect, useState, useRef, useCallback } from 'react';

type WebSocketListener = (event: string, data: any) => void;

class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private listeners: Set<WebSocketListener> = new Set();
  private reconnectTimer: any = null;
  private isConnecting: boolean = false;

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (this.isConnecting) return;
    this.isConnecting = true;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // If running with Vite proxy or direct server port
    const host = window.location.port === '5173' ? 'localhost:3001' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        console.log('⚡ Connected to real-time WebSocket bus');
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
      };

      this.ws.onmessage = (message) => {
        try {
          const parsed = JSON.parse(message.data);
          if (parsed.event) {
            this.notifyListeners(parsed.event, parsed.data);
          }
        } catch {
          // ignore malformed payloads
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        // Auto-reconnect after 3s
        if (!this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        }
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
      };
    } catch {
      this.isConnecting = false;
    }
  }

  public subscribe(listener: WebSocketListener): () => void {
    this.listeners.add(listener);
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(event: string, data: any): void {
    for (const listener of this.listeners) {
      try {
        listener(event, data);
      } catch (err) {
        console.error('Error in WS subscriber:', err);
      }
    }
  }
}

export const wsService = WebSocketService.getInstance();

export function useWebSocket(onEvent?: (event: string, data: any) => void) {
  const [connected, setConnected] = useState<boolean>(false);
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  const handleEvent = useCallback((event: string, data: any) => {
    if (callbackRef.current) {
      callbackRef.current(event, data);
    }
  }, []);

  useEffect(() => {
    wsService.connect();
    const unsubscribe = wsService.subscribe((event, data) => {
      if (event === 'connected') {
        setConnected(true);
      }
      handleEvent(event, data);
    });

    return () => {
      unsubscribe();
    };
  }, [handleEvent]);

  return { connected };
}

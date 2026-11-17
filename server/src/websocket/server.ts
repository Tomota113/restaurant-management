import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';

export interface WebSocketEvent {
  event: string;
  data: any;
}

export class WebSocketManager {
  private static instance: WebSocketManager;
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  private constructor() {}

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  public init(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Send initial welcome message
      ws.send(JSON.stringify({ event: 'connected', data: { message: 'WebSocket connection established' } }));

      ws.on('message', (message: string) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.event === 'ping') {
            ws.send(JSON.stringify({ event: 'pong', data: { timestamp: Date.now() } }));
          }
        } catch {
          // ignore malformed ws messages
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    console.log('✔ WebSocket server initialized at /ws');
  }

  public broadcast(event: string, data: any): void {
    if (this.clients.size === 0) return;
    const payload = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(payload);
        } catch (err) {
          console.error('Error broadcasting WS message:', err);
        }
      }
    }
  }
}

export const wsManager = WebSocketManager.getInstance();

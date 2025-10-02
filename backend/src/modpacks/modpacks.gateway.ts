import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface ModpackProgress {
  sessionId: string;
  step: string;
  progress: number;
  message: string;
  total?: number;
  current?: number;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'modpacks',
})
export class ModpacksGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ModpacksGateway.name);
  private sessions = new Map<string, Set<string>>(); // sessionId -> Set of client IDs

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Clean up session subscriptions
    this.sessions.forEach((clients, sessionId) => {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.sessions.delete(sessionId);
      }
    });
  }

  subscribeToSession(clientId: string, sessionId: string) {
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, new Set());
    }
    this.sessions.get(sessionId).add(clientId);
    this.logger.log(`Client ${clientId} subscribed to session ${sessionId}`);
  }

  emitProgress(progress: ModpackProgress) {
    const clients = this.sessions.get(progress.sessionId);
    if (clients && clients.size > 0) {
      this.server.emit('progress', progress);
      this.logger.log(`Emitted progress for session ${progress.sessionId}: ${progress.message} (${progress.progress}%)`);
    }
  }

  emitComplete(sessionId: string, serverId: string) {
    const clients = this.sessions.get(sessionId);
    if (clients && clients.size > 0) {
      this.server.emit('complete', { sessionId, serverId });
      this.logger.log(`Emitted completion for session ${sessionId}`);
    }
    this.sessions.delete(sessionId);
  }

  emitError(sessionId: string, error: string) {
    const clients = this.sessions.get(sessionId);
    if (clients && clients.size > 0) {
      this.server.emit('error', { sessionId, error });
      this.logger.log(`Emitted error for session ${sessionId}: ${error}`);
    }
    this.sessions.delete(sessionId);
  }
}

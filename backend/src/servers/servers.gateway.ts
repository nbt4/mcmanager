import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { AgentsService } from '../agents/agents.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/console',
})
export class ServersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ServersGateway.name);
  private serverSubscriptions = new Map<string, Set<string>>(); // serverId -> Set of socketIds

  constructor(private agentsService: AgentsService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove client from all server subscriptions
    for (const [serverId, clients] of this.serverSubscriptions.entries()) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.serverSubscriptions.delete(serverId);
      }
    }
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId: string },
  ) {
    const { serverId } = data;

    if (!this.serverSubscriptions.has(serverId)) {
      this.serverSubscriptions.set(serverId, new Set());
      // Subscribe to log events for this server
      this.agentsService.subscribeToLogs(serverId, (log: string) => {
        this.broadcastLog(serverId, log);
      });
    }

    this.serverSubscriptions.get(serverId)!.add(client.id);
    this.logger.log(`Client ${client.id} subscribed to server ${serverId}`);

    // Send existing logs
    const logs = this.agentsService.getLogs(serverId);
    client.emit('logs', { logs });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId: string },
  ) {
    const { serverId } = data;
    const clients = this.serverSubscriptions.get(serverId);

    if (clients) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.serverSubscriptions.delete(serverId);
        this.agentsService.unsubscribeFromLogs(serverId);
      }
    }

    this.logger.log(`Client ${client.id} unsubscribed from server ${serverId}`);
  }

  @SubscribeMessage('command')
  async handleCommand(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { serverId: string; command: string },
  ) {
    const { serverId, command } = data;

    try {
      await this.agentsService.sendCommand(serverId, command);
      this.logger.log(`Command sent to server ${serverId}: ${command}`);
    } catch (error) {
      client.emit('error', { message: error.message });
    }
  }

  private broadcastLog(serverId: string, log: string) {
    const clients = this.serverSubscriptions.get(serverId);
    if (clients) {
      for (const clientId of clients) {
        this.server.to(clientId).emit('log', { log });
      }
    }
  }
}

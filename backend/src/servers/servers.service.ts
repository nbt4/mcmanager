import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentsService } from '../agents/agents.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { ServerStatus } from '../common/enums';

@Injectable()
export class ServersService {
  constructor(
    private prisma: PrismaService,
    private agentsService: AgentsService,
  ) {}

  async create(createServerDto: CreateServerDto) {
    // Check if name is unique
    const existingByName = await this.prisma.server.findUnique({
      where: { name: createServerDto.name },
    });
    if (existingByName) {
      throw new ConflictException('Server name already exists');
    }

    // Check if port is unique
    const existingByPort = await this.prisma.server.findUnique({
      where: { port: createServerDto.port },
    });
    if (existingByPort) {
      throw new ConflictException('Port is already in use');
    }

    const server = await this.prisma.server.create({
      data: {
        ...createServerDto,
        containerName: `minectrl-${createServerDto.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      },
    });

    // Create default server properties
    await this.createDefaultProperties(server.id, createServerDto);

    return server;
  }

  async findAll() {
    return this.prisma.server.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const server = await this.prisma.server.findUnique({
      where: { id },
      include: {
        properties: true,
        backups: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    return server;
  }

  async update(id: string, updateServerDto: UpdateServerDto) {
    const server = await this.findOne(id);

    // Check name uniqueness if changing
    if (updateServerDto.name && updateServerDto.name !== server.name) {
      const existingByName = await this.prisma.server.findUnique({
        where: { name: updateServerDto.name },
      });
      if (existingByName) {
        throw new ConflictException('Server name already exists');
      }
    }

    // Check port uniqueness if changing
    if (updateServerDto.port && updateServerDto.port !== server.port) {
      const existingByPort = await this.prisma.server.findUnique({
        where: { port: updateServerDto.port },
      });
      if (existingByPort) {
        throw new ConflictException('Port is already in use');
      }
    }

    return this.prisma.server.update({
      where: { id },
      data: updateServerDto,
    });
  }

  async remove(id: string) {
    const server = await this.findOne(id);

    // Stop server if running
    if (server.status === ServerStatus.RUNNING) {
      await this.stop(id);
    }

    // Stop process if exists
    await this.agentsService.removeContainer(id);

    return this.prisma.server.delete({
      where: { id },
    });
  }

  async start(id: string) {
    const server = await this.findOne(id);

    if (server.status === ServerStatus.RUNNING) {
      throw new ConflictException('Server is already running');
    }

    // Update status to starting
    await this.prisma.server.update({
      where: { id },
      data: { status: ServerStatus.STARTING },
    });

    try {
      // Start container via agent
      const containerInfo = await this.agentsService.startServer(server);

      // Update server with container info
      return this.prisma.server.update({
        where: { id },
        data: {
          status: ServerStatus.RUNNING,
          containerId: containerInfo.id,
          agentUrl: containerInfo.agentUrl,
        },
      });
    } catch (error) {
      // Update status to error
      await this.prisma.server.update({
        where: { id },
        data: { status: ServerStatus.ERROR },
      });
      throw error;
    }
  }

  async stop(id: string) {
    const server = await this.findOne(id);

    if (server.status === ServerStatus.STOPPED) {
      throw new ConflictException('Server is already stopped');
    }

    // Update status to stopping
    await this.prisma.server.update({
      where: { id },
      data: { status: ServerStatus.STOPPING },
    });

    try {
      // Stop server process via agent
      await this.agentsService.stopServer(id);

      // Update status to stopped
      return this.prisma.server.update({
        where: { id },
        data: {
          status: ServerStatus.STOPPED,
          containerId: null,
          agentUrl: null,
        },
      });
    } catch (error) {
      // Update status back to running if stop failed
      await this.prisma.server.update({
        where: { id },
        data: { status: ServerStatus.RUNNING },
      });
      throw error;
    }
  }

  async restart(id: string) {
    await this.stop(id);
    // Wait a moment before starting
    await new Promise(resolve => setTimeout(resolve, 2000));
    return this.start(id);
  }

  async getLogs(id: string) {
    await this.findOne(id); // Verify server exists
    return {
      logs: this.agentsService.getLogs(id),
    };
  }

  private async createDefaultProperties(serverId: string, dto: CreateServerDto) {
    const properties = [
      { key: 'server-port', value: dto.port.toString() },
      { key: 'max-players', value: dto.maxPlayers.toString() },
      { key: 'motd', value: dto.motd },
      { key: 'difficulty', value: dto.difficulty.toLowerCase() },
      { key: 'gamemode', value: dto.gamemode.toLowerCase() },
      { key: 'pvp', value: dto.pvp.toString() },
      { key: 'white-list', value: dto.whitelist.toString() },
      { key: 'online-mode', value: dto.onlineMode.toString() },
      { key: 'level-seed', value: dto.seed || '' },
    ];

    await this.prisma.serverProperty.createMany({
      data: properties.map(prop => ({
        serverId,
        key: prop.key,
        value: prop.value,
      })),
    });
  }
}
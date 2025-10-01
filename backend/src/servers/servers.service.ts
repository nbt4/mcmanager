import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AgentsService } from '../agents/agents.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { ServerStatus } from '../common/enums';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';

@Injectable()
export class ServersService {
  private readonly serversBaseDir = process.env.SERVERS_BASE_DIR || '/data/minecraft';

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

      // Update server with container info only (status will be updated via WebSocket)
      return this.prisma.server.update({
        where: { id },
        data: {
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

      // Clear container info (status will be updated via WebSocket when process exits)
      return this.prisma.server.update({
        where: { id },
        data: {
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

  async updateStatus(id: string, status: string) {
    // Map status strings to ServerStatus enum
    const statusMap: { [key: string]: ServerStatus } = {
      'STOPPED': ServerStatus.STOPPED,
      'STARTING': ServerStatus.STARTING,
      'RUNNING': ServerStatus.RUNNING,
      'STOPPING': ServerStatus.STOPPING,
      'EXITED': ServerStatus.ERROR,
      'RESTARTING': ServerStatus.STARTING,
    };

    const mappedStatus = statusMap[status] || ServerStatus.ERROR;

    return this.prisma.server.update({
      where: { id },
      data: { status: mappedStatus },
    });
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

  private async getServerPath(serverId: string): Promise<string> {
    const server = await this.findOne(serverId);
    return path.join(this.serversBaseDir, server.storagePath);
  }

  private validatePath(requestedPath: string): void {
    // Prevent directory traversal attacks
    if (requestedPath.includes('..') || requestedPath.startsWith('/')) {
      throw new BadRequestException('Invalid path');
    }
  }

  async listFiles(serverId: string, relativePath: string) {
    this.validatePath(relativePath);
    const serverPath = await this.getServerPath(serverId);
    const fullPath = path.join(serverPath, relativePath);

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async (entry) => {
          const itemPath = path.join(fullPath, entry.name);
          const stats = await fs.stat(itemPath);
          return {
            name: entry.name,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            modifiedAt: stats.mtime,
            path: path.join(relativePath, entry.name),
          };
        }),
      );

      return {
        path: relativePath,
        items: items.sort((a, b) => {
          // Directories first, then alphabetically
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        }),
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('Directory not found');
      }
      throw error;
    }
  }

  async readFile(serverId: string, relativePath: string) {
    this.validatePath(relativePath);
    const serverPath = await this.getServerPath(serverId);
    const fullPath = path.join(serverPath, relativePath);

    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        throw new BadRequestException('Cannot read a directory');
      }

      const content = await fs.readFile(fullPath, 'utf-8');
      return {
        path: relativePath,
        content,
        size: stats.size,
        modifiedAt: stats.mtime,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }

  async downloadFile(serverId: string, relativePath: string) {
    this.validatePath(relativePath);
    const serverPath = await this.getServerPath(serverId);
    const fullPath = path.join(serverPath, relativePath);

    try {
      const buffer = await fs.readFile(fullPath);
      return {
        buffer,
        filename: path.basename(fullPath),
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('File not found');
      }
      throw error;
    }
  }

  async writeFile(serverId: string, relativePath: string, content: string) {
    this.validatePath(relativePath);
    const serverPath = await this.getServerPath(serverId);
    const fullPath = path.join(serverPath, relativePath);

    try {
      // Ensure parent directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      return { success: true, path: relativePath };
    } catch (error) {
      throw new BadRequestException(`Failed to write file: ${error.message}`);
    }
  }

  async uploadFile(serverId: string, relativePath: string, file: any) {
    this.validatePath(relativePath);
    const serverPath = await this.getServerPath(serverId);
    const fullPath = path.join(serverPath, relativePath, file.originalname);

    try {
      // Ensure directory exists
      await fs.mkdir(path.join(serverPath, relativePath), { recursive: true });
      await fs.writeFile(fullPath, file.buffer);
      return {
        success: true,
        path: path.join(relativePath, file.originalname),
        filename: file.originalname,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to upload file: ${error.message}`);
    }
  }

  async createDirectory(serverId: string, relativePath: string) {
    this.validatePath(relativePath);
    const serverPath = await this.getServerPath(serverId);
    const fullPath = path.join(serverPath, relativePath);

    try {
      await fs.mkdir(fullPath, { recursive: true });
      return { success: true, path: relativePath };
    } catch (error) {
      throw new BadRequestException(`Failed to create directory: ${error.message}`);
    }
  }

  async deleteFile(serverId: string, relativePath: string) {
    this.validatePath(relativePath);
    const serverPath = await this.getServerPath(serverId);
    const fullPath = path.join(serverPath, relativePath);

    try {
      const stats = await fs.stat(fullPath);
      if (stats.isDirectory()) {
        await fs.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.unlink(fullPath);
      }
      return { success: true, path: relativePath };
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new NotFoundException('File or directory not found');
      }
      throw new BadRequestException(`Failed to delete: ${error.message}`);
    }
  }

  async getAvailableVersions(type: string) {
    const serverType = type.toUpperCase();

    switch (serverType) {
      case 'PAPER':
        return this.getPaperVersions();
      case 'VANILLA':
        return this.getVanillaVersions();
      case 'SPIGOT':
      case 'BUKKIT':
        return this.getSpigotVersions();
      case 'FORGE':
        return this.getForgeVersions();
      case 'FABRIC':
        return this.getFabricVersions();
      case 'NEOFORGE':
        return this.getNeoForgeVersions();
      case 'PURPUR':
        return this.getPurpurVersions();
      case 'FOLIA':
        return this.getFoliaVersions();
      default:
        throw new BadRequestException(`Unsupported server type: ${type}`);
    }
  }

  private async getPaperVersions() {
    try {
      const response = await axios.get('https://api.papermc.io/v2/projects/paper');
      const versions = response.data.versions || [];

      const grouped = {
        release: [],
        beta: [],
        alpha: [],
      };

      versions.reverse().forEach((version: string) => {
        if (version.includes('pre') || version.includes('rc')) {
          grouped.beta.push(version);
        } else if (version.includes('snapshot') || version.includes('alpha')) {
          grouped.alpha.push(version);
        } else {
          grouped.release.push(version);
        }
      });

      return {
        type: 'PAPER',
        versions: grouped,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch Paper versions');
    }
  }

  private async getVanillaVersions() {
    try {
      const response = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
      const versions = response.data.versions || [];

      const grouped = {
        release: [],
        beta: [],
        alpha: [],
      };

      versions.forEach((version: any) => {
        const versionId = version.id;

        if (version.type === 'release') {
          grouped.release.push(versionId);
        } else if (version.type === 'snapshot') {
          grouped.beta.push(versionId);
        } else if (version.type === 'old_beta' || version.type === 'old_alpha') {
          grouped.alpha.push(versionId);
        }
      });

      return {
        type: 'VANILLA',
        versions: grouped,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch Vanilla versions');
    }
  }

  private async getForgeVersions() {
    try {
      const response = await axios.get('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml');
      const parsed = await parseStringPromise(response.data);
      const versions = parsed.metadata.versioning[0].versions[0].version || [];

      // Group by Minecraft version
      const grouped: { [mcVersion: string]: string[] } = {};

      // Forge versions are in format: 1.20.1-47.2.0
      versions.reverse().forEach((version: string) => {
        const match = version.match(/^(\d+\.\d+(?:\.\d+)?)-/);
        if (match) {
          const mcVersion = match[1];
          if (!grouped[mcVersion]) {
            grouped[mcVersion] = [];
          }
          grouped[mcVersion].push(version);
        }
      });

      // Convert to sorted array of MC versions (newest first)
      const sortedVersions = {};
      Object.keys(grouped)
        .sort((a, b) => {
          const partsA = a.split('.').map(Number);
          const partsB = b.split('.').map(Number);
          for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const diff = (partsB[i] || 0) - (partsA[i] || 0);
            if (diff !== 0) return diff;
          }
          return 0;
        })
        .forEach(mcVersion => {
          sortedVersions[mcVersion] = grouped[mcVersion];
        });

      return {
        type: 'FORGE',
        groupedByMinecraftVersion: true,
        versions: sortedVersions,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch Forge versions');
    }
  }

  private async getFabricVersions() {
    try {
      // Fetch both game versions and loader versions
      const [gameResponse, loaderResponse] = await Promise.all([
        axios.get('https://meta.fabricmc.net/v2/versions/game'),
        axios.get('https://meta.fabricmc.net/v2/versions/loader'),
      ]);

      const gameVersions = gameResponse.data || [];
      const loaderVersions = loaderResponse.data || [];

      // Get only stable release MC versions (not snapshots)
      const stableGameVersions = gameVersions
        .filter((game: any) => game.stable && !game.version.includes('w') && !game.version.includes('-'))
        .map((game: any) => game.version);

      // Get loader version strings
      const loaders = loaderVersions.map((loader: any) => loader.version);

      // Group loaders by MC version (all loaders work with all MC versions)
      const grouped: { [mcVersion: string]: string[] } = {};
      stableGameVersions.slice(0, 20).forEach((mcVersion: string) => {
        grouped[mcVersion] = loaders.slice(0, 10); // Top 10 loaders for each MC version
      });

      return {
        type: 'FABRIC',
        groupedByMinecraftVersion: true,
        versions: grouped,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch Fabric versions');
    }
  }

  private async getNeoForgeVersions() {
    try {
      const response = await axios.get('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
      const versions = response.data.versions || [];

      // Group by Minecraft version
      // NeoForge format: 20.2.86 (MC 1.20.2), 20.4.10 (MC 1.20.4), 21.1.50 (MC 1.21.1)
      const grouped: { [mcVersion: string]: string[] } = {};

      versions.reverse().forEach((version: string) => {
        // Parse NeoForge version to get MC version
        const match = version.match(/^(\d+)\.(\d+)\./);
        if (match) {
          const major = parseInt(match[1]);
          const minor = parseInt(match[2]);

          // Convert NeoForge version to MC version
          // 20.x → 1.20.x, 21.x → 1.21.x
          const mcVersion = major >= 21 && minor === 0
            ? `1.${major}`
            : `1.${major}.${minor}`;

          if (!grouped[mcVersion]) {
            grouped[mcVersion] = [];
          }
          grouped[mcVersion].push(version);
        }
      });

      // Sort MC versions (newest first)
      const sortedVersions = {};
      Object.keys(grouped)
        .sort((a, b) => {
          const partsA = a.split('.').map(Number);
          const partsB = b.split('.').map(Number);
          for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
            const diff = (partsB[i] || 0) - (partsA[i] || 0);
            if (diff !== 0) return diff;
          }
          return 0;
        })
        .forEach(mcVersion => {
          sortedVersions[mcVersion] = grouped[mcVersion];
        });

      return {
        type: 'NEOFORGE',
        groupedByMinecraftVersion: true,
        versions: sortedVersions,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch NeoForge versions');
    }
  }

  private async getPurpurVersions() {
    try {
      const response = await axios.get('https://api.purpurmc.org/v2/purpur');
      const versions = response.data.versions || [];

      const grouped = {
        release: versions.reverse(),
        beta: [],
        alpha: [],
      };

      return {
        type: 'PURPUR',
        versions: grouped,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch Purpur versions');
    }
  }

  private async getFoliaVersions() {
    try {
      const response = await axios.get('https://api.papermc.io/v2/projects/folia');
      const versions = response.data.versions || [];

      const grouped = {
        release: versions.reverse(),
        beta: [],
        alpha: [],
      };

      return {
        type: 'FOLIA',
        versions: grouped,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch Folia versions');
    }
  }

  private async getSpigotVersions() {
    try {
      // Spigot doesn't have an official API, so we'll use vanilla versions
      // but return them as SPIGOT type
      const vanillaResult = await this.getVanillaVersions();
      return {
        type: 'SPIGOT',
        versions: vanillaResult.versions,
      };
    } catch (error) {
      throw new BadRequestException('Failed to fetch Spigot versions');
    }
  }
}
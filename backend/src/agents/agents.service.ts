import { Injectable, Logger } from '@nestjs/common';
import { Server } from '@prisma/client';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import axios from 'axios';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);
  private processes = new Map<string, ChildProcess>();
  private readonly serversBaseDir = process.env.SERVERS_BASE_DIR || '/data/minecraft';

  async startServer(server: Server) {
    const serverDir = path.join(this.serversBaseDir, server.storagePath);

    // Ensure server directory exists
    await fs.mkdir(serverDir, { recursive: true });

    // Download server JAR if not exists
    const jarPath = await this.ensureServerJar(server, serverDir);

    // Create/update server.properties
    await this.createServerProperties(server, serverDir);

    // Accept EULA
    await fs.writeFile(path.join(serverDir, 'eula.txt'), 'eula=true\n');

    // Build Java command
    const javaArgs = [
      `-Xmx${server.memory}M`,
      `-Xms${Math.min(server.memory, 1024)}M`,
      ...(server.javaOpts ? server.javaOpts.split(' ') : []),
      '-jar',
      jarPath,
      'nogui',
    ];

    // Spawn server process
    const serverProcess = spawn('java', javaArgs, {
      cwd: serverDir,
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const processId = `${server.id}-${Date.now()}`;
    this.processes.set(server.id, serverProcess);

    // Log output
    serverProcess.stdout.on('data', (data) => {
      this.logger.log(`[${server.name}] ${data.toString()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      this.logger.error(`[${server.name}] ${data.toString()}`);
    });

    serverProcess.on('exit', (code) => {
      this.logger.log(`[${server.name}] Process exited with code ${code}`);
      this.processes.delete(server.id);
    });

    return {
      id: processId,
      name: server.name,
      agentUrl: null,
    };
  }

  async stopServer(serverId: string) {
    const process = this.processes.get(serverId);

    if (!process) {
      return;
    }

    // Send stop command to server
    process.stdin.write('stop\n');

    // Wait up to 30 seconds for graceful shutdown
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (process.pid) {
          process.kill('SIGTERM');
        }
        resolve();
      }, 30000);

      process.on('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    this.processes.delete(serverId);
  }

  async removeContainer(serverId: string) {
    // For host-based servers, just ensure process is stopped
    await this.stopServer(serverId);
  }

  async getContainerStatus(serverId: string) {
    const process = this.processes.get(serverId);

    if (!process || process.killed) {
      return null;
    }

    return {
      id: serverId,
      status: 'running',
      running: true,
      startedAt: new Date().toISOString(),
      finishedAt: null,
    };
  }

  async getContainerLogs(serverId: string, tail = 100) {
    // For now, return empty - we'd need to implement log file reading
    return '';
  }

  private async ensureServerJar(server: Server, serverDir: string): Promise<string> {
    const jarName = this.getJarName(server.type);
    const jarPath = path.join(serverDir, jarName);

    try {
      await fs.access(jarPath);
      return jarPath;
    } catch {
      // JAR doesn't exist, download it
      await this.downloadServerJar(server, jarPath);
      return jarPath;
    }
  }

  private async downloadServerJar(server: Server, jarPath: string) {
    const downloadUrl = await this.getDownloadUrl(server.type, server.version);

    this.logger.log(`Downloading ${server.type} ${server.version} from ${downloadUrl}`);

    const response = await axios.get(downloadUrl, {
      responseType: 'arraybuffer',
      maxRedirects: 5,
    });

    await fs.writeFile(jarPath, response.data);
    this.logger.log(`Downloaded ${path.basename(jarPath)}`);
  }

  private async getDownloadUrl(type: string, version: string): Promise<string> {
    switch (type.toUpperCase()) {
      case 'VANILLA':
        // Use Mojang's API to get download URL
        return this.getVanillaDownloadUrl(version);
      case 'PAPER':
        return this.getPaperDownloadUrl(version);
      case 'SPIGOT':
      case 'BUKKIT':
        // Note: Spigot requires BuildTools, this is a simplified placeholder
        throw new Error('Spigot/Bukkit requires BuildTools. Please use Paper or Vanilla.');
      case 'FABRIC':
        return `https://meta.fabricmc.net/v2/versions/loader/${version}/latest/latest/server/jar`;
      case 'FORGE':
      case 'NEOFORGE':
        throw new Error('Forge/NeoForge download requires installer. Not yet implemented.');
      default:
        return this.getVanillaDownloadUrl(version);
    }
  }

  private async getPaperDownloadUrl(version: string): Promise<string> {
    // Get latest build for version
    const versionResponse = await axios.get(`https://api.papermc.io/v2/projects/paper/versions/${version}`);
    const builds = versionResponse.data.builds;
    const latestBuild = builds[builds.length - 1];

    // Get build details
    const buildResponse = await axios.get(`https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latestBuild}`);
    const jarName = buildResponse.data.downloads.application.name;

    return `https://api.papermc.io/v2/projects/paper/versions/${version}/builds/${latestBuild}/downloads/${jarName}`;
  }

  private async getVanillaDownloadUrl(version: string): Promise<string> {
    // Get manifest
    const manifestResponse = await axios.get('https://launchermeta.mojang.com/mc/game/version_manifest.json');
    const versionData = manifestResponse.data.versions.find((v: any) => v.id === version);

    if (!versionData) {
      throw new Error(`Version ${version} not found`);
    }

    // Get version details
    const versionResponse = await axios.get(versionData.url);
    return versionResponse.data.downloads.server.url;
  }

  private getJarName(type: string): string {
    return `${type.toLowerCase()}-server.jar`;
  }

  private async createServerProperties(server: Server, serverDir: string) {
    const properties = [
      `server-port=${server.port}`,
      `max-players=${server.maxPlayers}`,
      `motd=${server.motd}`,
      `difficulty=${server.difficulty.toLowerCase()}`,
      `gamemode=${server.gamemode.toLowerCase()}`,
      `pvp=${server.pvp}`,
      `white-list=${server.whitelist}`,
      `online-mode=${server.onlineMode}`,
      ...(server.seed ? [`level-seed=${server.seed}`] : []),
      'enable-rcon=true',
      `rcon.port=${server.port + 10000}`,
      'rcon.password=minectrl',
    ];

    await fs.writeFile(
      path.join(serverDir, 'server.properties'),
      properties.join('\n') + '\n'
    );
  }
}
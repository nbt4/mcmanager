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
  private logs = new Map<string, string[]>(); // Store last 1000 lines per server
  private logCallbacks = new Map<string, Array<(log: string) => void>>(); // Real-time log callbacks
  private statusCallbacks = new Map<string, Array<(status: string) => void>>(); // Status change callbacks
  private currentStatus = new Map<string, string>(); // Track current status per server
  private readonly MAX_LOG_LINES = 1000;
  private readonly serversBaseDir = process.env.SERVERS_BASE_DIR || '/data/minecraft';
  private readonly hostServersPath = process.env.HOST_SERVERS_PATH || '/opt/dev/mcmanager/minecraft-servers';

  async startServer(server: Server) {
    const serverDir = path.join(this.serversBaseDir, server.storagePath);
    const hostServerDir = path.join(this.hostServersPath, server.storagePath);

    // Ensure server directory exists
    await fs.mkdir(serverDir, { recursive: true });

    // Download server JAR if not exists
    const jarPath = await this.ensureServerJar(server, serverDir);

    // Create/update server.properties
    await this.createServerProperties(server, serverDir);

    // Accept EULA
    await fs.writeFile(path.join(serverDir, 'eula.txt'), 'eula=true\n');

    // Convert jar path to host path for Java command
    const jarName = path.basename(jarPath);
    const hostJarPath = path.join(hostServerDir, jarName);

    // Build Java command
    const javaArgs = [
      `-Xmx${server.memory}M`,
      `-Xms${Math.min(server.memory, 1024)}M`,
      ...(server.javaOpts ? server.javaOpts.split(' ') : []),
      '-jar',
      hostJarPath,
      'nogui',
    ];

    // Spawn server process on host using nsenter
    // nsenter allows executing commands in the host's PID namespace from within a container
    // We need to cd to the directory first since cwd doesn't work across namespaces
    const serverProcess = spawn('nsenter', [
      '--target', '1',
      '--mount',
      '--uts',
      '--ipc',
      '--net',
      '--pid',
      '--',
      'sh', '-c',
      `cd "${hostServerDir}" && exec java ${javaArgs.join(' ')}`,
    ], {
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const processId = `${server.id}-${Date.now()}`;
    this.processes.set(server.id, serverProcess);

    // Initialize log buffer for this server
    if (!this.logs.has(server.id)) {
      this.logs.set(server.id, []);
    }

    // Emit STARTING status immediately
    this.emitStatus(server.id, 'STARTING');

    // Log output and store in buffer
    serverProcess.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        this.logger.log(`[${server.name}] ${line}`);
        this.addLog(server.id, line);
        this.detectStatusFromLog(server.id, line);
      });
    });

    serverProcess.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(line => line.trim());
      lines.forEach(line => {
        this.logger.error(`[${server.name}] ${line}`);
        this.addLog(server.id, `[ERROR] ${line}`);
      });
    });

    serverProcess.on('exit', (code) => {
      this.logger.log(`[${server.name}] Process exited with code ${code}`);
      this.addLog(server.id, `[INFO] Server process exited with code ${code}`);

      // Determine exit status
      const status = code === 0 ? 'STOPPED' : 'EXITED';
      this.emitStatus(server.id, status);

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

  private addLog(serverId: string, line: string) {
    const logs = this.logs.get(serverId) || [];
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${line}`;
    logs.push(logLine);

    // Keep only last MAX_LOG_LINES
    if (logs.length > this.MAX_LOG_LINES) {
      logs.shift();
    }

    this.logs.set(serverId, logs);

    // Emit to real-time subscribers
    const callbacks = this.logCallbacks.get(serverId);
    if (callbacks) {
      callbacks.forEach(callback => callback(logLine));
    }
  }

  getLogs(serverId: string): string[] {
    return this.logs.get(serverId) || [];
  }

  subscribeToLogs(serverId: string, callback: (log: string) => void) {
    if (!this.logCallbacks.has(serverId)) {
      this.logCallbacks.set(serverId, []);
    }
    this.logCallbacks.get(serverId)!.push(callback);
  }

  unsubscribeFromLogs(serverId: string) {
    this.logCallbacks.delete(serverId);
  }

  subscribeToStatus(serverId: string, callback: (status: string) => void) {
    if (!this.statusCallbacks.has(serverId)) {
      this.statusCallbacks.set(serverId, []);
    }
    this.statusCallbacks.get(serverId)!.push(callback);

    // Send current status immediately if available
    const currentStatus = this.currentStatus.get(serverId);
    if (currentStatus) {
      this.logger.log(`[Status] Sending current status ${currentStatus} to new subscriber for server ${serverId}`);
      callback(currentStatus);
    }
  }

  unsubscribeFromStatus(serverId: string) {
    this.statusCallbacks.delete(serverId);
  }

  async sendCommand(serverId: string, command: string) {
    const process = this.processes.get(serverId);

    if (!process || process.killed) {
      throw new Error('Server is not running');
    }

    // Send command to server's stdin
    process.stdin.write(`${command}\n`);
    this.addLog(serverId, `> ${command}`);
  }

  private detectStatusFromLog(serverId: string, line: string) {
    // Detect "Done" message indicating server is ready
    // Vanilla/Paper: "Done (5.123s)! For help, type "help""
    if (line.includes('Done') && (line.includes('For help') || line.includes('help'))) {
      this.logger.log(`[Status] Server ${serverId} is now RUNNING`);
      this.emitStatus(serverId, 'RUNNING');
    }
    // Detect starting messages
    // Common patterns: "Starting minecraft server", "Starting Minecraft server"
    else if (line.toLowerCase().includes('starting minecraft server') ||
             line.toLowerCase().includes('starting net.minecraft.server')) {
      this.logger.log(`[Status] Server ${serverId} is STARTING`);
      this.emitStatus(serverId, 'STARTING');
    }
    // Detect stopping messages
    else if (line.includes('Stopping server') ||
             line.includes('Stopping the server') ||
             line.includes('Saving worlds')) {
      this.logger.log(`[Status] Server ${serverId} is STOPPING`);
      this.emitStatus(serverId, 'STOPPING');
    }
  }

  private emitStatus(serverId: string, status: string) {
    this.logger.log(`[Status] Emitting status ${status} for server ${serverId}`);

    // Store current status
    this.currentStatus.set(serverId, status);

    const callbacks = this.statusCallbacks.get(serverId);
    if (callbacks && callbacks.length > 0) {
      this.logger.log(`[Status] Broadcasting to ${callbacks.length} callback(s)`);
      callbacks.forEach(callback => callback(status));
    } else {
      this.logger.log(`[Status] No callbacks registered for server ${serverId}, status stored for later`);
    }
  }
}
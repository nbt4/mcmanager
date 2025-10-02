import { Injectable, Logger } from '@nestjs/common';
import { Server } from '@prisma/client';
import { spawn, ChildProcess, execSync } from 'child_process';
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

    // Check if we're using a run script (Forge/NeoForge)
    const useRunScript = jarPath.endsWith('.sh') || jarPath.endsWith('.bat');

    let command: string;
    if (useRunScript) {
      // For Forge/NeoForge, use the run script
      const scriptName = path.basename(jarPath);
      const userJvmArgs = [
        `-Xmx${server.memory}M`,
        `-Xms${Math.min(server.memory, 1024)}M`,
        ...(server.javaOpts ? server.javaOpts.split(' ') : []),
      ].join(' ');

      // Write custom JVM args to user_jvm_args.txt
      await fs.writeFile(
        path.join(serverDir, 'user_jvm_args.txt'),
        userJvmArgs
      );

      command = `cd "${hostServerDir}" && exec sh ${scriptName} nogui`;
    } else {
      // Traditional JAR-based server
      const jarName = path.basename(jarPath);
      const hostJarPath = path.join(hostServerDir, jarName);

      const javaArgs = [
        `-Xmx${server.memory}M`,
        `-Xms${Math.min(server.memory, 1024)}M`,
        ...(server.javaOpts ? server.javaOpts.split(' ') : []),
        '-jar',
        hostJarPath,
        'nogui',
      ];

      command = `cd "${hostServerDir}" && exec java ${javaArgs.join(' ')}`;
    }

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
      command,
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
    // First, check if server is already set up
    const existingExecutable = await this.detectServerExecutable(serverDir);
    if (existingExecutable) {
      this.logger.log(`Found existing server executable: ${existingExecutable.type} - ${path.basename(existingExecutable.path)}`);
      return existingExecutable.path;
    }

    // For Forge/NeoForge, use installer approach
    if (server.type.toUpperCase() === 'FORGE' || server.type.toUpperCase() === 'NEOFORGE') {
      await this.installForgeServer(server, serverDir);
      // Re-detect after installation
      const installed = await this.detectServerExecutable(serverDir);
      if (installed) {
        return installed.path;
      }
      throw new Error(`Failed to detect executable after ${server.type} installation`);
    }

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

  /**
   * Autonomous detection of server executable (scripts or JARs)
   * Returns the best executable found with priority:
   * 1. Run scripts (run.sh, start.sh, run.bat, start.bat)
   * 2. Server JARs (any JAR that looks like a server)
   */
  private async detectServerExecutable(serverDir: string): Promise<{ path: string; type: 'script' | 'jar' } | null> {
    try {
      const files = await fs.readdir(serverDir);

      // Priority 1: Look for run scripts (modern Forge/NeoForge style)
      const runScripts = [
        'run.sh',
        'start.sh',
        'run.bat',
        'start.bat',
        'server.sh',
        'server.bat',
      ];

      for (const scriptName of runScripts) {
        if (files.includes(scriptName)) {
          const scriptPath = path.join(serverDir, scriptName);
          // Make sure it's executable
          try {
            await fs.chmod(scriptPath, 0o755);
          } catch {
            // Ignore chmod errors
          }
          this.logger.log(`Detected run script: ${scriptName}`);
          return { path: scriptPath, type: 'script' };
        }
      }

      // Priority 2: Look for server JARs
      // Exclude installer JARs and look for server-like JARs
      const jarFiles = files.filter(file =>
        file.endsWith('.jar') &&
        !file.includes('installer') &&
        !file.includes('libraries') // Exclude library JARs
      );

      if (jarFiles.length === 0) {
        return null;
      }

      // Prioritize JARs with server-related names
      const serverKeywords = [
        'server',
        'forge',
        'neoforge',
        'fabric',
        'paper',
        'spigot',
        'bukkit',
        'purpur',
        'folia',
        'minecraft',
      ];

      // First, try to find a JAR with server keywords
      for (const keyword of serverKeywords) {
        const serverJar = jarFiles.find(jar =>
          jar.toLowerCase().includes(keyword)
        );
        if (serverJar) {
          this.logger.log(`Detected server JAR (keyword match): ${serverJar}`);
          return { path: path.join(serverDir, serverJar), type: 'jar' };
        }
      }

      // Fallback: use the first JAR found
      const firstJar = jarFiles[0];
      this.logger.log(`Detected server JAR (fallback): ${firstJar}`);
      return { path: path.join(serverDir, firstJar), type: 'jar' };

    } catch (error) {
      this.logger.warn(`Failed to detect server executable: ${error.message}`);
      return null;
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
        return this.getSpigotDownloadUrl(version);
      case 'BUKKIT':
        return this.getSpigotDownloadUrl(version); // Spigot includes Bukkit API
      case 'FABRIC':
        return `https://meta.fabricmc.net/v2/versions/loader/${version}/latest/latest/server/jar`;
      case 'FORGE':
      case 'NEOFORGE':
        // These use installers, handled separately
        throw new Error('Forge/NeoForge use installers, should not call getDownloadUrl directly');
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

  private async getSpigotDownloadUrl(version: string): Promise<string> {
    // Use GetBukkit API (community-maintained mirror)
    // Format: https://download.getbukkit.org/spigot/spigot-{version}.jar
    return `https://download.getbukkit.org/spigot/spigot-${version}.jar`;
  }

  private async installForgeServer(server: Server, serverDir: string): Promise<void> {
    const type = server.type.toUpperCase();
    const version = server.version;

    this.logger.log(`Installing ${type} server ${version}...`);

    // Download installer
    const installerUrl = type === 'FORGE'
      ? await this.getForgeInstallerUrl(version)
      : await this.getNeoForgeInstallerUrl(version);

    const installerPath = path.join(serverDir, 'installer.jar');

    this.logger.log(`Downloading ${type} installer from ${installerUrl}`);
    const response = await axios.get(installerUrl, {
      responseType: 'arraybuffer',
      maxRedirects: 5,
    });
    await fs.writeFile(installerPath, response.data);

    // Run installer
    this.logger.log(`Running ${type} installer...`);
    try {
      execSync(`java -jar ${installerPath} --installServer`, {
        cwd: serverDir,
        stdio: 'pipe',
      });
    } catch (error) {
      this.logger.error(`Installer execution failed: ${error.message}`);
      throw new Error(`Failed to install ${type} server`);
    }

    // Clean up installer
    await fs.unlink(installerPath).catch(() => {});

    this.logger.log(`${type} server installation completed`);
  }

  private async getForgeInstallerUrl(version: string): Promise<string> {
    // version format: 1.20.1-47.2.0 (minecraft-forge)
    const [mcVersion, forgeVersion] = version.split('-');

    // Try to get from official Forge maven
    // Format: https://maven.minecraftforge.net/net/minecraftforge/forge/{version}/forge-{version}-installer.jar
    const fullVersion = `${mcVersion}-${forgeVersion}`;
    return `https://maven.minecraftforge.net/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-installer.jar`;
  }

  private async getNeoForgeInstallerUrl(version: string): Promise<string> {
    // version format could be just the neoforge version like "20.4.237" or "21.0.167"
    // NeoForge maven: https://maven.neoforged.net/releases/net/neoforged/neoforge/{version}/neoforge-{version}-installer.jar
    return `https://maven.neoforged.net/releases/net/neoforged/neoforge/${version}/neoforge-${version}-installer.jar`;
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
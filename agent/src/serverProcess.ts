import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export interface ServerStatus {
  running: boolean;
  pid?: number;
  uptime: number;
  cpu_usage: number;
  memory_usage: number;
  player_count: number;
  players: string[];
}

export class ServerProcessManager {
  private process: ChildProcess | null = null;
  private startTime: number = 0;
  private workingDirectory: string = '/data';

  async start(serverJar: string, javaOpts: string[] = [], properties: Record<string, string> = {}): Promise<any> {
    if (this.process && !this.process.killed) {
      throw new Error('Server is already running');
    }

    const serverJarPath = path.join(this.workingDirectory, serverJar);

    // Check if server jar exists
    if (!fs.existsSync(serverJarPath)) {
      throw new Error(`Server jar not found: ${serverJarPath}`);
    }

    // Write server.properties
    await this.writeServerProperties(properties);

    // Accept EULA
    await this.acceptEula();

    const javaArgs = [
      ...javaOpts,
      '-jar',
      serverJarPath,
      '--nogui'
    ];

    console.log('Starting Minecraft server with args:', javaArgs);

    this.process = spawn('java', javaArgs, {
      cwd: this.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    this.startTime = Date.now();

    return new Promise((resolve, reject) => {
      let hasStarted = false;

      this.process!.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('Server stdout:', output);

        // Check for successful startup
        if (output.includes('Done (') && output.includes('s)! For help, type "help"')) {
          if (!hasStarted) {
            hasStarted = true;
            resolve({
              success: true,
              message: 'Server started successfully',
              pid: this.process!.pid
            });
          }
        }
      });

      this.process!.stderr?.on('data', (data) => {
        console.error('Server stderr:', data.toString());
      });

      this.process!.on('error', (error) => {
        console.error('Server process error:', error);
        if (!hasStarted) {
          reject(error);
        }
      });

      this.process!.on('exit', (code, signal) => {
        console.log(`Server process exited with code ${code} and signal ${signal}`);
        this.process = null;
        if (!hasStarted) {
          reject(new Error(`Server failed to start, exit code: ${code}`));
        }
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        if (!hasStarted) {
          this.stop(true);
          reject(new Error('Server startup timeout'));
        }
      }, 60000);
    });
  }

  async stop(force: boolean = false, timeout: number = 30): Promise<any> {
    if (!this.process || this.process.killed) {
      return {
        success: true,
        message: 'Server is not running'
      };
    }

    if (!force) {
      // Graceful shutdown
      this.process.stdin?.write('stop\n');

      return new Promise((resolve) => {
        const killTimeout = setTimeout(() => {
          this.process?.kill('SIGTERM');
          resolve({
            success: true,
            message: 'Server stopped (forced after timeout)'
          });
        }, timeout * 1000);

        this.process?.on('exit', () => {
          clearTimeout(killTimeout);
          this.process = null;
          resolve({
            success: true,
            message: 'Server stopped gracefully'
          });
        });
      });
    } else {
      // Force kill
      this.process.kill('SIGTERM');
      this.process = null;
      return {
        success: true,
        message: 'Server stopped (forced)'
      };
    }
  }

  getStatus(): ServerStatus {
    const running = this.process !== null && !this.process.killed;
    const uptime = running ? Date.now() - this.startTime : 0;

    return {
      running,
      pid: this.process?.pid,
      uptime,
      cpu_usage: 0, // TODO: Implement CPU monitoring
      memory_usage: 0, // TODO: Implement memory monitoring
      player_count: 0, // TODO: Parse from server logs
      players: [] // TODO: Parse from server logs
    };
  }

  async executeCommand(command: string): Promise<string> {
    if (!this.process || this.process.killed) {
      throw new Error('Server is not running');
    }

    return new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 10000);

      const dataHandler = (data: Buffer) => {
        output += data.toString();
      };

      this.process!.stdout?.on('data', dataHandler);

      this.process!.stdin?.write(`${command}\n`);

      // Wait for response (simplified)
      setTimeout(() => {
        this.process!.stdout?.off('data', dataHandler);
        clearTimeout(timeout);
        resolve(output);
      }, 1000);
    });
  }

  private async writeServerProperties(properties: Record<string, string>): Promise<void> {
    const propertiesPath = path.join(this.workingDirectory, 'server.properties');

    // Default properties
    const defaultProperties = {
      'server-port': '25565',
      'max-players': '20',
      'online-mode': 'true',
      'white-list': 'false',
      'enable-rcon': 'true',
      'rcon.port': '25575',
      'rcon.password': 'minecraft',
      'difficulty': 'easy',
      'gamemode': 'survival',
      'pvp': 'true',
      'spawn-protection': '16',
      'motd': 'A Minecraft Server',
      ...properties
    };

    const propertiesContent = Object.entries(defaultProperties)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    await fs.promises.writeFile(propertiesPath, propertiesContent);
  }

  private async acceptEula(): Promise<void> {
    const eulaPath = path.join(this.workingDirectory, 'eula.txt');
    const eulaContent = `#By changing the setting below to TRUE you are indicating your agreement to our EULA (https://account.mojang.com/documents/minecraft_eula).
#${new Date().toISOString()}
eula=true`;

    await fs.promises.writeFile(eulaPath, eulaContent);
  }
}
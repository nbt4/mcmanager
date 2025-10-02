import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurseForgeService } from './curseforge.service';
import { ModpacksGateway } from './modpacks.gateway';
import { CreateModpackServerDto } from './dto/create-modpack-server.dto';
import * as AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ModpacksService {
  private readonly logger = new Logger(ModpacksService.name);
  private readonly tempDir = '/tmp/modpacks';

  constructor(
    private readonly prisma: PrismaService,
    private readonly curseforge: CurseForgeService,
    private readonly gateway: ModpacksGateway,
  ) {
    this.ensureTempDir();
  }

  private async ensureTempDir() {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create temp directory: ${error.message}`);
    }
  }

  private async findAvailablePort(requestedPort: number = 25565): Promise<number> {
    // Get all occupied ports
    const existingServers = await this.prisma.server.findMany({
      select: { port: true },
      orderBy: { port: 'asc' },
    });

    const occupiedPorts = new Set(existingServers.map(s => s.port));

    // Find the next available port starting from the requested port
    let port = requestedPort;
    while (occupiedPorts.has(port)) {
      port++;
    }

    this.logger.log(`Requested port ${requestedPort}, assigned port ${port}`);
    return port;
  }

  async searchModpacks(query?: string, gameVersion?: string, page: number = 0) {
    return this.curseforge.searchModpacks(query, gameVersion, page);
  }

  async getModpackDetails(modpackId: number) {
    const details = await this.curseforge.getModpackDetails(modpackId);

    // Check if we have this modpack in our database
    const existingModpack = await this.prisma.modpack.findUnique({
      where: { curseId: modpackId },
    });

    return {
      ...details,
      cached: !!existingModpack,
      cachedData: existingModpack,
    };
  }

  async getModpackFiles(modpackId: number, gameVersion?: string) {
    return this.curseforge.getModpackFiles(modpackId, gameVersion);
  }

  async getModpackDescription(modpackId: number) {
    return this.curseforge.getModpackDescription(modpackId);
  }

  async getFileChangelog(modpackId: number, fileId: number) {
    return this.curseforge.getFileChangelog(modpackId, fileId);
  }

  async getModList(modpackId: number, fileId: number) {
    return this.curseforge.getModListFromFile(modpackId, fileId);
  }

  async getModListFromLatest(modpackId: number) {
    return this.curseforge.getModListFromLatestFile(modpackId);
  }

  async createServerFromModpack(dto: CreateModpackServerDto) {
    const sessionId = uuidv4();
    this.logger.log(`Creating server from modpack ${dto.modpackId}, file ${dto.fileId} (session: ${sessionId})`);

    try {
      // 1. Get file details from CurseForge
      this.gateway.emitProgress({
        sessionId,
        step: 'fetching',
        progress: 5,
        message: 'Fetching modpack information...',
      });

      const fileDetails = await this.curseforge.getFileDetails(dto.modpackId, dto.fileId);

      if (!fileDetails.data || !fileDetails.data.downloadUrl) {
        throw new BadRequestException('No download URL available for this modpack file');
      }

      // 2. Download modpack file
      this.gateway.emitProgress({
        sessionId,
        step: 'downloading',
        progress: 15,
        message: 'Downloading modpack file...',
      });

      this.logger.log(`Downloading modpack from ${fileDetails.data.downloadUrl}`);
      const modpackBuffer = await this.curseforge.downloadModpackFile(fileDetails.data.downloadUrl);

      // 3. Extract and parse manifest
      this.gateway.emitProgress({
        sessionId,
        step: 'extracting',
        progress: 35,
        message: 'Extracting modpack files...',
      });

      const tempPath = path.join(this.tempDir, `modpack-${Date.now()}`);
      await fs.mkdir(tempPath, { recursive: true });

      const zip = new AdmZip(modpackBuffer);
      zip.extractAllTo(tempPath, true);

      // 4. Read and parse manifest
      this.gateway.emitProgress({
        sessionId,
        step: 'parsing',
        progress: 45,
        message: 'Reading modpack configuration...',
      });

      const manifestPath = path.join(tempPath, 'manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest = await this.curseforge.parseManifest(manifestData);

      this.logger.log(`Parsed manifest: ${manifest.name} v${manifest.version}, MC ${manifest.minecraftVersion}, Loader: ${manifest.modloaderType}`);

      // 5. Save modpack info to database
      this.gateway.emitProgress({
        sessionId,
        step: 'database',
        progress: 55,
        message: 'Saving modpack information...',
      });

      const modpack = await this.prisma.modpack.upsert({
        where: { curseId: dto.modpackId },
        create: {
          curseId: dto.modpackId,
          name: manifest.name,
          description: dto.description || '',
          authors: JSON.stringify([manifest.author]),
          gameVersion: manifest.minecraftVersion,
          modloader: manifest.modloaderType,
          downloadUrl: fileDetails.data.downloadUrl,
        },
        update: {
          name: manifest.name,
          gameVersion: manifest.minecraftVersion,
          modloader: manifest.modloaderType,
          downloadUrl: fileDetails.data.downloadUrl,
        },
      });

      // 6. Determine server type based on modloader
      let serverType = 'VANILLA';
      let version = manifest.minecraftVersion;

      if (manifest.modloaderType === 'FORGE') {
        serverType = 'FORGE';
        // Forge version format: minecraftVersion-forgeVersion
        version = `${manifest.minecraftVersion}-${manifest.modloaderVersion}`;
      } else if (manifest.modloaderType === 'FABRIC') {
        serverType = 'FABRIC';
        version = manifest.modloaderVersion || '0.15.11'; // Use latest stable if not specified
      } else if (manifest.modloaderType === 'NEOFORGE') {
        serverType = 'NEOFORGE';
        version = manifest.modloaderVersion;
      }

      // 7. Generate storage path
      const storagePath = dto.storagePath || `modpack-${dto.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

      // 8. Find available port
      this.gateway.emitProgress({
        sessionId,
        step: 'port',
        progress: 70,
        message: 'Finding available port...',
      });

      const availablePort = await this.findAvailablePort(dto.port || 25565);

      // 9. Create server record
      this.gateway.emitProgress({
        sessionId,
        step: 'creating',
        progress: 80,
        message: 'Creating server...',
      });

      const server = await this.prisma.server.create({
        data: {
          name: dto.name,
          description: dto.description || `${manifest.name} modpack server`,
          type: serverType,
          version: version,
          port: availablePort,
          memory: dto.memory,
          javaOpts: dto.javaOpts || '',
          autoStart: false,
          status: 'STOPPED',
          storageType: 'VOLUME',
          storagePath: storagePath,
          containerName: `minectrl-${storagePath}`,
          modpackId: modpack.id,
        },
        include: {
          modpack: true,
        },
      });

      // 10. Copy modpack files to server directory
      this.gateway.emitProgress({
        sessionId,
        step: 'copying',
        progress: 90,
        message: 'Copying modpack files...',
      });

      await this.copyModpackFiles(tempPath, storagePath, manifest.overrides);

      // 11. Cleanup temp directory
      this.gateway.emitProgress({
        sessionId,
        step: 'cleanup',
        progress: 95,
        message: 'Finishing up...',
      });

      await fs.rm(tempPath, { recursive: true, force: true });

      this.logger.log(`Successfully created server ${server.id} from modpack ${modpack.name}`);

      // Emit completion
      this.gateway.emitComplete(sessionId, server.id);

      return { ...server, sessionId };
    } catch (error) {
      this.logger.error(`Failed to create server from modpack: ${error.message}`, error.stack);
      this.gateway.emitError(sessionId, error.message);
      throw new BadRequestException(`Failed to create server from modpack: ${error.message}`);
    }
  }

  private async copyModpackFiles(tempPath: string, storagePath: string, overridesFolder: string) {
    try {
      const overridesPath = path.join(tempPath, overridesFolder);
      const serverDataDir = process.env.SERVERS_BASE_DIR || '/data/minecraft';
      const targetPath = path.join(serverDataDir, storagePath);

      // Create target directory
      await fs.mkdir(targetPath, { recursive: true });

      // Check if overrides folder exists
      try {
        await fs.access(overridesPath);

        // Copy all files from overrides to server directory
        const files = await fs.readdir(overridesPath, { withFileTypes: true });

        for (const file of files) {
          const sourcePath = path.join(overridesPath, file.name);
          const destPath = path.join(targetPath, file.name);

          if (file.isDirectory()) {
            await fs.cp(sourcePath, destPath, { recursive: true });
          } else {
            await fs.copyFile(sourcePath, destPath);
          }
        }

        this.logger.log(`Copied modpack files from ${overridesPath} to ${targetPath}`);
      } catch (err) {
        this.logger.warn(`No overrides folder found at ${overridesPath}, skipping file copy`);
      }

      // Save manifest for later reference
      const manifestSource = path.join(tempPath, 'manifest.json');
      const manifestDest = path.join(targetPath, 'modpack-manifest.json');
      await fs.copyFile(manifestSource, manifestDest);

    } catch (error) {
      this.logger.error(`Failed to copy modpack files: ${error.message}`);
      throw new BadRequestException('Failed to copy modpack files to server directory');
    }
  }

  async getModpackById(id: string) {
    return this.prisma.modpack.findUnique({
      where: { id },
      include: {
        servers: true,
      },
    });
  }

  async listModpacks() {
    return this.prisma.modpack.findMany({
      include: {
        _count: {
          select: { servers: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}

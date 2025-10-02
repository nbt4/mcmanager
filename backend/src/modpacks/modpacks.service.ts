import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurseForgeService } from './curseforge.service';
import { CreateModpackServerDto } from './dto/create-modpack-server.dto';
import * as AdmZip from 'adm-zip';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class ModpacksService {
  private readonly logger = new Logger(ModpacksService.name);
  private readonly tempDir = '/tmp/modpacks';

  constructor(
    private readonly prisma: PrismaService,
    private readonly curseforge: CurseForgeService,
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

  async searchModpacks(query: string, gameVersion?: string, page: number = 0) {
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

  async createServerFromModpack(dto: CreateModpackServerDto) {
    this.logger.log(`Creating server from modpack ${dto.modpackId}, file ${dto.fileId}`);

    try {
      // 1. Get file details from CurseForge
      const fileDetails = await this.curseforge.getFileDetails(dto.modpackId, dto.fileId);

      if (!fileDetails.data || !fileDetails.data.downloadUrl) {
        throw new BadRequestException('No download URL available for this modpack file');
      }

      // 2. Download modpack file
      this.logger.log(`Downloading modpack from ${fileDetails.data.downloadUrl}`);
      const modpackBuffer = await this.curseforge.downloadModpackFile(fileDetails.data.downloadUrl);

      // 3. Extract and parse manifest
      const tempPath = path.join(this.tempDir, `modpack-${Date.now()}`);
      await fs.mkdir(tempPath, { recursive: true });

      const zip = new AdmZip(modpackBuffer);
      zip.extractAllTo(tempPath, true);

      // 4. Read and parse manifest
      const manifestPath = path.join(tempPath, 'manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest = await this.curseforge.parseManifest(manifestData);

      this.logger.log(`Parsed manifest: ${manifest.name} v${manifest.version}, MC ${manifest.minecraftVersion}, Loader: ${manifest.modloaderType}`);

      // 5. Save modpack info to database
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

      // 8. Create server record
      const server = await this.prisma.server.create({
        data: {
          name: dto.name,
          description: dto.description || `${manifest.name} modpack server`,
          type: serverType,
          version: version,
          port: dto.port,
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

      // 9. Copy modpack files to server directory
      await this.copyModpackFiles(tempPath, storagePath, manifest.overrides);

      // 10. Cleanup temp directory
      await fs.rm(tempPath, { recursive: true, force: true });

      this.logger.log(`Successfully created server ${server.id} from modpack ${modpack.name}`);

      return server;
    } catch (error) {
      this.logger.error(`Failed to create server from modpack: ${error.message}`, error.stack);
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

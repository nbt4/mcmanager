import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

interface CurseForgeSearchParams {
  gameId: number; // 432 for Minecraft
  searchFilter?: string;
  classId?: number; // 4471 for modpacks
  categoryId?: number;
  gameVersion?: string;
  sortField?: number;
  sortOrder?: 'asc' | 'desc';
  pageSize?: number;
  index?: number;
}

@Injectable()
export class CurseForgeService {
  private readonly logger = new Logger(CurseForgeService.name);
  private readonly axiosInstance: AxiosInstance;
  private readonly MINECRAFT_GAME_ID = 432;
  private readonly MODPACK_CLASS_ID = 4471;
  private readonly baseURL = 'https://api.curseforge.com';
  private readonly modListCache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 1000 * 60 * 30; // 30 minutes

  constructor() {
    const apiKey = process.env.CURSEFORGE_API_KEY;

    if (!apiKey) {
      this.logger.warn('CURSEFORGE_API_KEY not set. Modpack features will be disabled.');
    }

    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'x-api-key': apiKey || '',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });
  }

  async searchModpacks(query?: string, gameVersion?: string, page: number = 0) {
    try {
      const params: CurseForgeSearchParams = {
        gameId: this.MINECRAFT_GAME_ID,
        classId: this.MODPACK_CLASS_ID,
        sortField: 2, // Popularity
        sortOrder: 'desc',
        pageSize: 20,
        index: page * 20,
      };

      // Only add search filter if query is provided
      if (query && query.trim()) {
        params.searchFilter = query;
      }

      if (gameVersion) {
        params.gameVersion = gameVersion;
      }

      const response = await this.axiosInstance.get('/v1/mods/search', { params });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to search modpacks: ${error.message}`);
      throw new BadRequestException('Failed to search CurseForge modpacks');
    }
  }

  async getModpackDetails(modpackId: number) {
    try {
      const response = await this.axiosInstance.get(`/v1/mods/${modpackId}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get modpack details: ${error.message}`);
      throw new BadRequestException('Failed to fetch modpack details');
    }
  }

  async getModpackFiles(modpackId: number, gameVersion?: string) {
    try {
      const params: any = {};
      if (gameVersion) {
        params.gameVersion = gameVersion;
      }

      const response = await this.axiosInstance.get(
        `/v1/mods/${modpackId}/files`,
        { params }
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get modpack files: ${error.message}`);
      throw new BadRequestException('Failed to fetch modpack files');
    }
  }

  async getFileDetails(modpackId: number, fileId: number) {
    try {
      const response = await this.axiosInstance.get(
        `/v1/mods/${modpackId}/files/${fileId}`
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get file details: ${error.message}`);
      throw new BadRequestException('Failed to fetch file details');
    }
  }

  async getModpackDescription(modpackId: number) {
    try {
      const response = await this.axiosInstance.get(
        `/v1/mods/${modpackId}/description`
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get modpack description: ${error.message}`);
      throw new BadRequestException('Failed to fetch modpack description');
    }
  }

  async getFileChangelog(modpackId: number, fileId: number) {
    try {
      const response = await this.axiosInstance.get(
        `/v1/mods/${modpackId}/files/${fileId}/changelog`
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get file changelog: ${error.message}`);
      throw new BadRequestException('Failed to fetch file changelog');
    }
  }

  async getModsByIds(modIds: number[]) {
    try {
      // CurseForge API supports batch lookup with POST /v1/mods
      const response = await this.axiosInstance.post('/v1/mods', {
        modIds: modIds,
      });
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get mods by IDs: ${error.message}`);
      throw new BadRequestException('Failed to fetch mod details');
    }
  }

  async downloadModpackFile(downloadUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 300000, // 5 minutes for large files
        maxContentLength: 500 * 1024 * 1024, // 500MB max
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Failed to download modpack file: ${error.message}`);
      throw new BadRequestException('Failed to download modpack file');
    }
  }

  /**
   * Get latest file for a modpack
   */
  async getLatestFile(modpackId: number) {
    try {
      const filesResponse = await this.getModpackFiles(modpackId);

      if (!filesResponse.data || filesResponse.data.length === 0) {
        throw new BadRequestException('No files found for this modpack');
      }

      // Files are usually sorted by date, but let's ensure we get the latest
      const sortedFiles = filesResponse.data.sort((a: any, b: any) => {
        return new Date(b.fileDate).getTime() - new Date(a.fileDate).getTime();
      });

      return sortedFiles[0];
    } catch (error) {
      this.logger.error(`Failed to get latest file: ${error.message}`);
      throw new BadRequestException('Failed to get latest modpack file');
    }
  }

  /**
   * Get mod list from the latest modpack file
   */
  async getModListFromLatestFile(modpackId: number) {
    try {
      const latestFile = await this.getLatestFile(modpackId);
      return this.getModListFromFile(modpackId, latestFile.id);
    } catch (error) {
      this.logger.error(`Failed to get mod list from latest file: ${error.message}`);
      throw new BadRequestException('Failed to get mod list from latest file');
    }
  }

  /**
   * Get mod list from a modpack file by downloading and parsing manifest
   */
  async getModListFromFile(modpackId: number, fileId: number) {
    const cacheKey = `modlist:${modpackId}:${fileId}`;

    // Check cache first
    const cached = this.modListCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.log(`Returning cached mod list for ${modpackId}:${fileId}`);
      return cached.data;
    }

    try {
      const fileDetails = await this.getFileDetails(modpackId, fileId);

      if (!fileDetails.data || !fileDetails.data.downloadUrl) {
        throw new BadRequestException('No download URL available for this file');
      }

      // Download the modpack file
      this.logger.log(`Downloading modpack file from ${fileDetails.data.downloadUrl}`);
      const modpackBuffer = await this.downloadModpackFile(fileDetails.data.downloadUrl);

      // Extract and parse manifest using AdmZip
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(modpackBuffer);
      const manifestEntry = zip.getEntry('manifest.json');

      if (!manifestEntry) {
        throw new BadRequestException('No manifest.json found in modpack file');
      }

      const manifestData = manifestEntry.getData().toString('utf8');
      const manifest = JSON.parse(manifestData);

      const modFiles = manifest.files || [];

      // Extract unique project IDs
      const projectIds: number[] = Array.from(
        new Set(modFiles.map((mod: any) => Number(mod.projectID)))
      );

      this.logger.log(`Fetching details for ${projectIds.length} mods`);

      // Fetch mod details in batches (CurseForge has a limit of 100 per request)
      const batchSize = 100;
      const modDetails: any[] = [];

      for (let i = 0; i < projectIds.length; i += batchSize) {
        const batch: number[] = projectIds.slice(i, i + batchSize);
        const response = await this.getModsByIds(batch);
        if (response.data) {
          modDetails.push(...response.data);
        }
      }

      // Create a map of projectID -> mod details
      const modDetailsMap = new Map(modDetails.map(mod => [mod.id, mod]));

      // Enrich mod files with names and details
      const enrichedMods = modFiles.map((mod: any) => {
        const details = modDetailsMap.get(mod.projectID);
        return {
          projectID: mod.projectID,
          fileID: mod.fileID,
          required: mod.required,
          name: details?.name || `Unknown Mod (${mod.projectID})`,
          slug: details?.slug || '',
          summary: details?.summary || '',
          logo: details?.logo?.url || null,
          websiteUrl: details?.links?.websiteUrl || null,
        };
      });

      const result = {
        modpackName: manifest.name || 'Unknown',
        version: manifest.version || '1.0.0',
        minecraftVersion: manifest.minecraft?.version || 'Unknown',
        modLoader: manifest.minecraft?.modLoaders?.[0]?.id || 'Unknown',
        mods: enrichedMods,
        modCount: enrichedMods.length,
      };

      // Cache the result
      this.modListCache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      this.logger.log(`Cached mod list for ${modpackId}:${fileId} (${enrichedMods.length} mods)`);

      return result;
    } catch (error) {
      this.logger.error(`Failed to get mod list: ${error.message}`);
      throw new BadRequestException(`Failed to get mod list: ${error.message}`);
    }
  }

  /**
   * Parse modpack manifest to extract server information
   */
  async parseManifest(manifestData: any) {
    try {
      const manifest = typeof manifestData === 'string'
        ? JSON.parse(manifestData)
        : manifestData;

      const minecraft = manifest.minecraft || {};
      const modLoaders = minecraft.modLoaders || [];

      // Detect modloader type
      let modloaderType = 'unknown';
      let modloaderVersion = '';

      if (modLoaders.length > 0) {
        const primaryLoader = modLoaders.find((l: any) => l.primary) || modLoaders[0];
        const loaderId = primaryLoader.id || '';

        if (loaderId.startsWith('forge-')) {
          modloaderType = 'FORGE';
          modloaderVersion = loaderId.replace('forge-', '');
        } else if (loaderId.startsWith('fabric-')) {
          modloaderType = 'FABRIC';
          modloaderVersion = loaderId.replace('fabric-', '');
        } else if (loaderId.startsWith('neoforge-')) {
          modloaderType = 'NEOFORGE';
          modloaderVersion = loaderId.replace('neoforge-', '');
        }
      }

      return {
        name: manifest.name || 'Unknown Modpack',
        version: manifest.version || '1.0.0',
        author: manifest.author || 'Unknown',
        minecraftVersion: minecraft.version || '1.20.1',
        modloaderType,
        modloaderVersion,
        mods: manifest.files || [],
        overrides: manifest.overrides || 'overrides',
      };
    } catch (error) {
      this.logger.error(`Failed to parse manifest: ${error.message}`);
      throw new BadRequestException('Invalid modpack manifest');
    }
  }
}

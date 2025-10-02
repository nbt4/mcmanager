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

  async downloadModpackFile(downloadUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get(downloadUrl, {
        responseType: 'arraybuffer',
        timeout: 300000, // 5 minutes for large files
      });
      return Buffer.from(response.data);
    } catch (error) {
      this.logger.error(`Failed to download modpack file: ${error.message}`);
      throw new BadRequestException('Failed to download modpack file');
    }
  }

  /**
   * Get mod list from a modpack file by downloading and parsing manifest
   */
  async getModListFromFile(modpackId: number, fileId: number) {
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

      return {
        modpackName: manifest.name || 'Unknown',
        version: manifest.version || '1.0.0',
        minecraftVersion: manifest.minecraft?.version || 'Unknown',
        modLoader: manifest.minecraft?.modLoaders?.[0]?.id || 'Unknown',
        mods: manifest.files || [],
        modCount: manifest.files?.length || 0,
      };
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

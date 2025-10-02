import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ModpacksService } from './modpacks.service';
import { SearchModpacksDto } from './dto/search-modpacks.dto';
import { CreateModpackServerDto } from './dto/create-modpack-server.dto';

@ApiTags('modpacks')
@Controller('modpacks')
export class ModpacksController {
  constructor(private readonly modpacksService: ModpacksService) {}

  @Get('search')
  @ApiOperation({ summary: 'Search CurseForge modpacks' })
  @ApiQuery({ name: 'query', required: true, description: 'Search query' })
  @ApiQuery({ name: 'gameVersion', required: false, description: 'Minecraft version filter' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (0-indexed)' })
  @ApiResponse({ status: 200, description: 'Search results' })
  async searchModpacks(@Query() searchDto: SearchModpacksDto) {
    return this.modpacksService.searchModpacks(
      searchDto.query,
      searchDto.gameVersion,
      searchDto.page || 0
    );
  }

  @Get('list')
  @ApiOperation({ summary: 'List cached modpacks' })
  @ApiResponse({ status: 200, description: 'List of modpacks in database' })
  async listModpacks() {
    return this.modpacksService.listModpacks();
  }

  @Get(':modpackId')
  @ApiOperation({ summary: 'Get modpack details from CurseForge' })
  @ApiParam({ name: 'modpackId', description: 'CurseForge modpack ID' })
  @ApiResponse({ status: 200, description: 'Modpack details' })
  async getModpackDetails(@Param('modpackId') modpackId: string) {
    return this.modpacksService.getModpackDetails(parseInt(modpackId));
  }

  @Get(':modpackId/description')
  @ApiOperation({ summary: 'Get modpack description from CurseForge' })
  @ApiParam({ name: 'modpackId', description: 'CurseForge modpack ID' })
  @ApiResponse({ status: 200, description: 'Modpack description (HTML)' })
  async getModpackDescription(@Param('modpackId') modpackId: string) {
    return this.modpacksService.getModpackDescription(parseInt(modpackId));
  }

  @Get(':modpackId/files')
  @ApiOperation({ summary: 'Get modpack files from CurseForge' })
  @ApiParam({ name: 'modpackId', description: 'CurseForge modpack ID' })
  @ApiQuery({ name: 'gameVersion', required: false, description: 'Minecraft version filter' })
  @ApiResponse({ status: 200, description: 'List of modpack files' })
  async getModpackFiles(
    @Param('modpackId') modpackId: string,
    @Query('gameVersion') gameVersion?: string
  ) {
    return this.modpacksService.getModpackFiles(parseInt(modpackId), gameVersion);
  }

  @Get(':modpackId/files/:fileId/changelog')
  @ApiOperation({ summary: 'Get file changelog from CurseForge' })
  @ApiParam({ name: 'modpackId', description: 'CurseForge modpack ID' })
  @ApiParam({ name: 'fileId', description: 'CurseForge file ID' })
  @ApiResponse({ status: 200, description: 'File changelog (HTML)' })
  async getFileChangelog(
    @Param('modpackId') modpackId: string,
    @Param('fileId') fileId: string
  ) {
    return this.modpacksService.getFileChangelog(parseInt(modpackId), parseInt(fileId));
  }

  @Get(':modpackId/mods')
  @ApiOperation({ summary: 'Get mod list from latest modpack file' })
  @ApiParam({ name: 'modpackId', description: 'CurseForge modpack ID' })
  @ApiResponse({ status: 200, description: 'List of mods in the latest modpack version' })
  async getModListFromLatest(@Param('modpackId') modpackId: string) {
    return this.modpacksService.getModListFromLatest(parseInt(modpackId));
  }

  @Get(':modpackId/files/:fileId/mods')
  @ApiOperation({ summary: 'Get mod list from specific modpack file' })
  @ApiParam({ name: 'modpackId', description: 'CurseForge modpack ID' })
  @ApiParam({ name: 'fileId', description: 'CurseForge file ID' })
  @ApiResponse({ status: 200, description: 'List of mods in the modpack' })
  async getModList(
    @Param('modpackId') modpackId: string,
    @Param('fileId') fileId: string
  ) {
    return this.modpacksService.getModList(parseInt(modpackId), parseInt(fileId));
  }

  @Post('create-server')
  @ApiOperation({ summary: 'Create server from modpack' })
  @ApiResponse({ status: 201, description: 'Server created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  async createServerFromModpack(@Body() dto: CreateModpackServerDto) {
    return this.modpacksService.createServerFromModpack(dto);
  }
}

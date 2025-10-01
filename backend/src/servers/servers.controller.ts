import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  StreamableFile,
  Req,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ServersService } from './servers.service';
import { CreateServerDto } from './dto/create-server.dto';
import { UpdateServerDto } from './dto/update-server.dto';
import { ServerEntity } from './entities/server.entity';

@ApiTags('Servers')
@ApiBearerAuth()
@Controller('servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new Minecraft server' })
  @ApiResponse({ status: 201, description: 'Server created successfully', type: ServerEntity })
  @ApiResponse({ status: 409, description: 'Server name or port already exists' })
  create(@Body() createServerDto: CreateServerDto) {
    return this.serversService.create(createServerDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all servers' })
  @ApiResponse({ status: 200, description: 'List of servers', type: [ServerEntity] })
  findAll() {
    return this.serversService.findAll();
  }

  @Get('versions/:type')
  @ApiOperation({ summary: 'Get available Minecraft versions for server type' })
  @ApiParam({ name: 'type', description: 'Server type (VANILLA, PAPER, etc.)' })
  @ApiResponse({ status: 200, description: 'List of available versions grouped by type' })
  async getVersions(@Param('type') type: string) {
    return this.serversService.getAvailableVersions(type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get server by ID' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'Server details', type: ServerEntity })
  @ApiResponse({ status: 404, description: 'Server not found' })
  findOne(@Param('id') id: string) {
    return this.serversService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update server' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'Server updated successfully', type: ServerEntity })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Server name or port already exists' })
  update(@Param('id') id: string, @Body() updateServerDto: UpdateServerDto) {
    return this.serversService.update(id, updateServerDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete server' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'Server deleted successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  remove(@Param('id') id: string) {
    return this.serversService.remove(id);
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start server' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'Server started successfully', type: ServerEntity })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Server is already running' })
  start(@Param('id') id: string) {
    return this.serversService.start(id);
  }

  @Post(':id/stop')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Stop server' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'Server stopped successfully', type: ServerEntity })
  @ApiResponse({ status: 404, description: 'Server not found' })
  @ApiResponse({ status: 409, description: 'Server is already stopped' })
  stop(@Param('id') id: string) {
    return this.serversService.stop(id);
  }

  @Post(':id/restart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restart server' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'Server restarted successfully', type: ServerEntity })
  @ApiResponse({ status: 404, description: 'Server not found' })
  restart(@Param('id') id: string) {
    return this.serversService.restart(id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get server logs' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'Server logs' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  async getLogs(@Param('id') id: string) {
    return this.serversService.getLogs(id);
  }

  @Get(':id/files')
  @ApiOperation({ summary: 'List files in server directory' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'List of files and directories' })
  async listFiles(
    @Param('id') id: string,
    @Query('path') path?: string,
  ) {
    return this.serversService.listFiles(id, path || '');
  }

  @Get(':id/files/read')
  @ApiOperation({ summary: 'Read file content' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'File content' })
  async readFile(
    @Param('id') id: string,
    @Query('path') path: string,
  ) {
    return this.serversService.readFile(id, path);
  }

  @Get(':id/files/download')
  @ApiOperation({ summary: 'Download file' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'File download' })
  async downloadFile(
    @Param('id') id: string,
    @Query('path') path: string,
    @Res() res: FastifyReply,
  ) {
    const file = await this.serversService.downloadFile(id, path);
    res.header('Content-Type', 'application/octet-stream');
    res.header('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.send(file.buffer);
  }

  @Post(':id/files/write')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Write file content' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'File written successfully' })
  async writeFile(
    @Param('id') id: string,
    @Body() body: { path: string; content: string },
  ) {
    return this.serversService.writeFile(id, body.path, body.content);
  }

  @Post(':id/files/upload')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Upload file' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'File uploaded successfully' })
  async uploadFile(
    @Param('id') id: string,
    @Query('path') path: string,
    @Req() req: FastifyRequest,
  ) {
    const data = await req.file();
    if (!data) {
      throw new Error('No file uploaded');
    }

    const buffer = await data.toBuffer();
    return this.serversService.uploadFile(id, path, {
      buffer,
      originalname: data.filename,
    });
  }

  @Post(':id/files/mkdir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create directory' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'Directory created successfully' })
  async createDirectory(
    @Param('id') id: string,
    @Body() body: { path: string },
  ) {
    return this.serversService.createDirectory(id, body.path);
  }

  @Delete(':id/files')
  @ApiOperation({ summary: 'Delete file or directory' })
  @ApiParam({ name: 'id', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'File/directory deleted successfully' })
  async deleteFile(
    @Param('id') id: string,
    @Query('path') path: string,
  ) {
    return this.serversService.deleteFile(id, path);
  }
}
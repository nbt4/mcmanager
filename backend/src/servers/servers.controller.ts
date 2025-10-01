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
} from '@nestjs/common';
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
}
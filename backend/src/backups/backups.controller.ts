import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { BackupsService } from './backups.service';

@ApiTags('Backups')
@ApiBearerAuth()
@Controller('backups')
export class BackupsController {
  constructor(private readonly backupsService: BackupsService) {}

  @Post('servers/:serverId')
  @ApiOperation({ summary: 'Create a backup for a server' })
  @ApiParam({ name: 'serverId', description: 'Server ID' })
  @ApiResponse({ status: 201, description: 'Backup created successfully' })
  @ApiResponse({ status: 404, description: 'Server not found' })
  create(
    @Param('serverId') serverId: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.backupsService.createBackup(serverId, body.name, body.description);
  }

  @Get('servers/:serverId')
  @ApiOperation({ summary: 'Get all backups for a server' })
  @ApiParam({ name: 'serverId', description: 'Server ID' })
  @ApiResponse({ status: 200, description: 'List of backups' })
  findAllByServer(@Param('serverId') serverId: string) {
    return this.backupsService.findAllByServer(serverId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get backup by ID' })
  @ApiParam({ name: 'id', description: 'Backup ID' })
  @ApiResponse({ status: 200, description: 'Backup details' })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  findOne(@Param('id') id: string) {
    return this.backupsService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete backup' })
  @ApiParam({ name: 'id', description: 'Backup ID' })
  @ApiResponse({ status: 200, description: 'Backup deleted successfully' })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  remove(@Param('id') id: string) {
    return this.backupsService.remove(id);
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restore from backup' })
  @ApiParam({ name: 'id', description: 'Backup ID' })
  @ApiResponse({ status: 200, description: 'Restore initiated' })
  @ApiResponse({ status: 404, description: 'Backup not found' })
  restore(@Param('id') id: string) {
    return this.backupsService.restore(id);
  }
}
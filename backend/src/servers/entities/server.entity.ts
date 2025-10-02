import { ApiProperty } from '@nestjs/swagger';
import { Server } from '@prisma/client';
import { ServerType, ServerStatus, StorageType, Difficulty, Gamemode } from '../../common/enums';

export class ServerEntity implements Server {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ nullable: true })
  description: string | null;

  @ApiProperty({ enum: ServerType })
  type: string;

  @ApiProperty()
  version: string;

  @ApiProperty()
  port: number;

  @ApiProperty({ description: 'Memory allocation in MB' })
  memory: number;

  @ApiProperty({ nullable: true })
  javaOpts: string | null;

  @ApiProperty()
  autoStart: boolean;

  @ApiProperty({ enum: ServerStatus })
  status: string;

  @ApiProperty({ enum: StorageType })
  storageType: string;

  @ApiProperty()
  storagePath: string;

  @ApiProperty({ nullable: true })
  containerName: string | null;

  @ApiProperty({ nullable: true })
  containerId: string | null;

  @ApiProperty({ nullable: true })
  agentUrl: string | null;

  @ApiProperty({ nullable: true })
  seed: string | null;

  @ApiProperty({ enum: Difficulty })
  difficulty: string;

  @ApiProperty({ enum: Gamemode })
  gamemode: string;

  @ApiProperty()
  pvp: boolean;

  @ApiProperty()
  whitelist: boolean;

  @ApiProperty()
  onlineMode: boolean;

  @ApiProperty()
  maxPlayers: number;

  @ApiProperty()
  motd: string;

  @ApiProperty({ nullable: true })
  modpackId: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
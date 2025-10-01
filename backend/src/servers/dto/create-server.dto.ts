import { IsString, IsNumber, IsBoolean, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServerType, StorageType, Difficulty, Gamemode } from '../../common/enums';

export class CreateServerDto {
  @ApiProperty({ description: 'Server name', example: 'My Minecraft Server' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Server description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ServerType, description: 'Server type' })
  @IsEnum(ServerType)
  type: ServerType;

  @ApiProperty({ description: 'Minecraft version', example: '1.20.4' })
  @IsString()
  version: string;

  @ApiProperty({ description: 'Server port', example: 25565, minimum: 1024, maximum: 65535 })
  @IsNumber()
  @Min(1024)
  @Max(65535)
  port: number;

  @ApiProperty({ description: 'Memory allocation in MB', example: 4096, minimum: 512 })
  @IsNumber()
  @Min(512)
  memory: number;

  @ApiPropertyOptional({ description: 'Additional Java options' })
  @IsOptional()
  @IsString()
  javaOpts?: string;

  @ApiProperty({ description: 'Auto-start server on boot', default: false })
  @IsBoolean()
  autoStart: boolean;

  @ApiProperty({ enum: StorageType, description: 'Storage type' })
  @IsEnum(StorageType)
  storageType: StorageType;

  @ApiProperty({ description: 'Storage path (volume name or bind path)' })
  @IsString()
  storagePath: string;

  @ApiPropertyOptional({ description: 'World seed' })
  @IsOptional()
  @IsString()
  seed?: string;

  @ApiProperty({ enum: Difficulty, description: 'Game difficulty', default: Difficulty.NORMAL })
  @IsEnum(Difficulty)
  difficulty: Difficulty;

  @ApiProperty({ enum: Gamemode, description: 'Default gamemode', default: Gamemode.SURVIVAL })
  @IsEnum(Gamemode)
  gamemode: Gamemode;

  @ApiProperty({ description: 'Enable PvP', default: true })
  @IsBoolean()
  pvp: boolean;

  @ApiProperty({ description: 'Enable whitelist', default: false })
  @IsBoolean()
  whitelist: boolean;

  @ApiProperty({ description: 'Enable online mode', default: true })
  @IsBoolean()
  onlineMode: boolean;

  @ApiProperty({ description: 'Maximum players', default: 20, minimum: 1, maximum: 200 })
  @IsNumber()
  @Min(1)
  @Max(200)
  maxPlayers: number;

  @ApiProperty({ description: 'Message of the day', default: 'A Minecraft Server' })
  @IsString()
  motd: string;
}
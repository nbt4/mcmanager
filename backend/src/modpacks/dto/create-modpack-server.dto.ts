import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreateModpackServerDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  modpackId: number;

  @IsNumber()
  fileId: number;

  @IsNumber()
  @Min(1024)
  @Max(65535)
  port: number;

  @IsNumber()
  @Min(1024)
  memory: number;

  @IsOptional()
  @IsString()
  javaOpts?: string;

  @IsOptional()
  @IsString()
  storagePath?: string;
}

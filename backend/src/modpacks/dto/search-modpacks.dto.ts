import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchModpacksDto {
  @IsString()
  query: string;

  @IsOptional()
  @IsString()
  gameVersion?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  page?: number = 0;
}

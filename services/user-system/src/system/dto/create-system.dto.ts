import { IsString, IsEnum, IsOptional, IsInt } from 'class-validator';
import { SystemStatus } from '@autix/database';

export class CreateSystemDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(SystemStatus)
  status?: SystemStatus;

  @IsOptional()
  @IsInt()
  sort?: number;
}

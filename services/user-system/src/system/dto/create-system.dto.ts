import { IsString, IsEnum, IsOptional, IsInt, IsBoolean } from 'class-validator';
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

  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean;
}

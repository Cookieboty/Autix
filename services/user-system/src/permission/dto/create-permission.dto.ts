import { IsString, IsEnum, IsOptional } from 'class-validator';
import { PermissionAction } from '@repo/database';

export class CreatePermissionDto {
  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsString()
  module: string;

  @IsEnum(PermissionAction)
  action: PermissionAction;

  @IsOptional()
  @IsString()
  description?: string;
}

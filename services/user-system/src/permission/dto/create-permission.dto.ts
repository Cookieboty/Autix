import { IsString, IsEnum, IsOptional } from 'class-validator';
import { PermissionAction, PermissionType } from '@autix/database';

export class CreatePermissionDto {
  @IsString()
  menuId: string;

  @IsString()
  name: string;

  @IsString()
  code: string;

  @IsEnum(PermissionType)
  type: PermissionType;

  @IsEnum(PermissionAction)
  action: PermissionAction;

  @IsOptional()
  @IsString()
  description?: string;
}

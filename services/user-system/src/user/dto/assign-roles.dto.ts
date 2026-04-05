import { IsString, IsArray, ArrayNotEmpty } from 'class-validator';

export class SystemRoleDto {
  @IsString()
  systemId: string;

  @IsArray()
  @IsString({ each: true })
  roleIds: string[];
}

export class AssignRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  systemRoles: SystemRoleDto[];
}

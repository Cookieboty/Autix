import { IsArray, IsString } from 'class-validator';

export class AssignMenusAndPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  menuIds: string[];

  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}

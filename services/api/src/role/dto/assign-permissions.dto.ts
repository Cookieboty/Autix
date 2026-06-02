import { IsArray, IsString } from 'class-validator';

export class AssignPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}
